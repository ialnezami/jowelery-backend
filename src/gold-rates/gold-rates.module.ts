import { Module } from '@nestjs/common';
import { GoldRatesService } from './gold-rates.service';
import { GoldRatesController } from './gold-rates.controller';
import { GoldRatesScheduler } from './gold-rates.scheduler';
import { CommonCacheModule } from '../common/cache/cache.module';

@Module({
  imports: [CommonCacheModule],
  providers: [GoldRatesService, GoldRatesScheduler],
  controllers: [GoldRatesController],
})
export class GoldRatesModule {}
