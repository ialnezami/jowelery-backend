import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('analytics')
@Controller('analytics')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SHOP_ADMIN', 'SUPER_ADMIN')
@ApiBearerAuth()
export class AnalyticsController {
  constructor(private analytics: AnalyticsService) {}

  private async resolveShopId(user: any, queryShopId?: string): Promise<string | undefined> {
    if (user.role === 'SUPER_ADMIN') return queryShopId;
    return this.analytics.getShopIdForAdmin(user.id);
  }

  @Get('dashboard')
  async getDashboard(@CurrentUser() user: any, @Query('shopId') shopId?: string) {
    const id = await this.resolveShopId(user, shopId);
    return this.analytics.getDashboard(id);
  }

  @Get('orders-by-status')
  async getOrdersByStatus(@CurrentUser() user: any, @Query('shopId') shopId?: string) {
    const id = await this.resolveShopId(user, shopId);
    return this.analytics.getOrdersByStatus(id);
  }

  @Get('top-products')
  async getTopProducts(@CurrentUser() user: any, @Query('shopId') shopId?: string, @Query('limit') limit?: number) {
    const id = await this.resolveShopId(user, shopId);
    return this.analytics.getTopProducts(id, limit);
  }

  @Get('revenue-by-shop')
  @Roles('SUPER_ADMIN')
  getRevenueByShop() {
    return this.analytics.getRevenueByShop();
  }
}
