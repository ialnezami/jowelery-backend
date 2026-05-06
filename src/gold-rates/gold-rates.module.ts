import { Module } from '@nestjs/common';
import { GoldRatesService } from './gold-rates.service';
import { GoldRatesController } from './gold-rates.controller';

@Module({ providers: [GoldRatesService], controllers: [GoldRatesController] })
export class GoldRatesModule {}
