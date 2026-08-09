import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import axios from 'axios';
import { GoldRatesService } from './gold-rates.service';

// Troy ounce to grams conversion
const TROY_OZ_TO_GRAMS = 31.1035;

// Karat purity factors relative to K24
const KARAT_PURITY: Record<string, number> = {
  K24: 1.0,
  K22: 0.9167,
  K21: 0.875,
  K18: 0.75,
  K14: 0.5833,
};

@Injectable()
export class GoldRatesScheduler {
  private readonly logger = new Logger(GoldRatesScheduler.name);

  constructor(private goldRates: GoldRatesService) {}

  // Runs every hour
  @Cron(CronExpression.EVERY_HOUR)
  async syncGoldRates() {
    const apiKey = process.env.TWELVE_DATA_API_KEY;
    if (!apiKey) {
      this.logger.warn('TWELVE_DATA_API_KEY not set — skipping gold rate sync');
      return;
    }

    try {
      const { data } = await axios.get('https://api.twelvedata.com/price', {
        params: { symbol: 'XAU/USD', apikey: apiKey },
        timeout: 8000,
      });

      const pricePerOz = parseFloat(data.price);
      if (isNaN(pricePerOz) || pricePerOz <= 0) {
        this.logger.warn('Invalid gold price received from Twelve Data', data);
        return;
      }

      const pricePerGramUSD = pricePerOz / TROY_OZ_TO_GRAMS;

      for (const [karat, purity] of Object.entries(KARAT_PURITY)) {
        const rate = parseFloat((pricePerGramUSD * purity).toFixed(4));
        await this.goldRates.setRate(karat, rate, 'USD');
      }

      this.logger.log(`Gold rates updated — XAU/USD: $${pricePerOz}/oz ($${pricePerGramUSD.toFixed(4)}/g)`);
    } catch (err) {
      this.logger.error('Failed to fetch gold price from Twelve Data', err?.message);
    }
  }
}
