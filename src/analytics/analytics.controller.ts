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

  @Get('dashboard')
  getDashboard(@CurrentUser() user: any, @Query('shopId') shopId?: string) {
    const id = user.role === 'SUPER_ADMIN' ? shopId : undefined;
    return this.analytics.getDashboard(id);
  }

  @Get('orders-by-status')
  getOrdersByStatus(@CurrentUser() user: any, @Query('shopId') shopId?: string) {
    const id = user.role === 'SUPER_ADMIN' ? shopId : undefined;
    return this.analytics.getOrdersByStatus(id);
  }

  @Get('top-products')
  getTopProducts(@CurrentUser() user: any, @Query('shopId') shopId?: string, @Query('limit') limit?: number) {
    const id = user.role === 'SUPER_ADMIN' ? shopId : undefined;
    return this.analytics.getTopProducts(id, limit);
  }
}
