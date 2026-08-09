import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

const TWELVE_DATA_API = 'https://api.twelvedata.com/exchange_rate';

// Default currencies to seed if none exist
const DEFAULT_CURRENCIES = [
  { code: 'USD', symbol: '$',   name: 'US Dollar',       exchangeRateToBase: 1.0 },
  { code: 'EUR', symbol: '€',   name: 'Euro',            exchangeRateToBase: 0.92 },
  { code: 'GBP', symbol: '£',   name: 'British Pound',   exchangeRateToBase: 0.79 },
  { code: 'AED', symbol: 'AED', name: 'UAE Dirham',      exchangeRateToBase: 3.67 },
  { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal',     exchangeRateToBase: 3.75 },
  { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar',   exchangeRateToBase: 0.31 },
  { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal',    exchangeRateToBase: 3.64 },
  { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar',  exchangeRateToBase: 0.376 },
  { code: 'OMR', symbol: 'OMR', name: 'Omani Rial',      exchangeRateToBase: 0.385 },
];

@Injectable()
export class CurrenciesService {
  private readonly logger = new Logger(CurrenciesService.name);

  constructor(private prisma: PrismaService) {}

  async findAll() {
    const currencies = await this.prisma.currency.findMany({
      where: { isActive: true },
      orderBy: { code: 'asc' },
    });

    // Seed defaults if empty
    if (currencies.length === 0) {
      await this.seed();
      return this.prisma.currency.findMany({ where: { isActive: true }, orderBy: { code: 'asc' } });
    }

    return currencies;
  }

  async syncRates() {
    try {
      await this.seed();

      const currencies = await this.prisma.currency.findMany();
      const apiKey = process.env.TWELVE_DATA_API_KEY;

      for (const currency of currencies) {
        if (currency.code === 'USD') continue;
        try {
          const { data } = await axios.get(TWELVE_DATA_API, {
            params: { symbol: `USD/${currency.code}`, apikey: apiKey },
            timeout: 8000,
          });
          const rate = parseFloat(data.rate);
          if (!isNaN(rate) && rate > 0) {
            await this.prisma.currency.update({
              where: { code: currency.code },
              data: { exchangeRateToBase: rate },
            });
          }
        } catch {
          this.logger.warn(`Failed to fetch rate for ${currency.code}, keeping existing`);
        }
      }

      this.logger.log(`Exchange rates synced for ${currencies.length} currencies`);
      return { synced: currencies.length, timestamp: new Date() };
    } catch (err: any) {
      this.logger.error('Failed to sync exchange rates', err.message);
      throw err;
    }
  }

  private async seed() {
    for (const c of DEFAULT_CURRENCIES) {
      await this.prisma.currency.upsert({
        where: { code: c.code },
        create: c,
        update: {},
      });
    }
  }
}
