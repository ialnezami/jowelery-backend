import { Module } from '@nestjs/common';
import { ShopReviewsService } from './shop-reviews.service';
import { ShopReviewsController } from './shop-reviews.controller';

@Module({
  controllers: [ShopReviewsController],
  providers: [ShopReviewsService],
})
export class ShopReviewsModule {}
