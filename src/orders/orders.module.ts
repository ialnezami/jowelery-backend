import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { EmailModule } from '../email/email.module';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [EmailModule, CouponsModule],
  providers: [OrdersService],
  controllers: [OrdersController],
})
export class OrdersModule {}
