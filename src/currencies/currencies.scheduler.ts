import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { CurrenciesService } from './currencies.service';

@Injectable()
export class CurrenciesScheduler {
  private readonly logger = new Logger(CurrenciesScheduler.name);

  constructor(private readonly currencies: CurrenciesService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async syncRates() {
    this.logger.log('Running scheduled currency rate sync');
    try {
      const result = await this.currencies.syncRates();
      this.logger.log(`Currency rates synced: ${result.synced} currencies`);
    } catch (err: any) {
      this.logger.error(`Scheduled currency sync failed: ${err.message}`);
    }
  }
}
