import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { ShopsModule } from './shops/shops.module';
import { OrdersModule } from './orders/orders.module';
import { CartModule } from './cart/cart.module';
import { WishlistModule } from './wishlist/wishlist.module';
import { GoldRatesModule } from './gold-rates/gold-rates.module';
import { PaymentsModule } from './payments/payments.module';
import { UploadModule } from './upload/upload.module';
import { SystemConfigModule } from './system-config/system-config.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AddressModule } from './address/address.module';
import { RecipientsModule } from './recipients/recipients.module';
import { ShopReviewsModule } from './shop-reviews/shop-reviews.module';
import { CurrenciesModule } from './currencies/currencies.module';
import { CouponsModule } from './coupons/coupons.module';
import { PayoutsModule } from './payouts/payouts.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    ProductsModule,
    ShopsModule,
    OrdersModule,
    CartModule,
    WishlistModule,
    GoldRatesModule,
    PaymentsModule,
    UploadModule,
    SystemConfigModule,
    AnalyticsModule,
    AddressModule,
    RecipientsModule,
    ShopReviewsModule,
    CurrenciesModule,
    CouponsModule,
    PayoutsModule,
  ],
})
export class AppModule {}
