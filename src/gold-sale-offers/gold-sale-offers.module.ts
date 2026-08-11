import { Module } from '@nestjs/common';
import { GoldSaleOffersService } from './gold-sale-offers.service';
import { GoldSaleOffersController } from './gold-sale-offers.controller';

@Module({
  controllers: [GoldSaleOffersController],
  providers: [GoldSaleOffersService],
})
export class GoldSaleOffersModule {}
