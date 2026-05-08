import { Module } from '@nestjs/common';
import { CurrenciesService } from './currencies.service';
import { CurrenciesController } from './currencies.controller';
import { CurrenciesScheduler } from './currencies.scheduler';

@Module({
  controllers: [CurrenciesController],
  providers: [CurrenciesService, CurrenciesScheduler],
  exports: [CurrenciesService],
})
export class CurrenciesModule {}
