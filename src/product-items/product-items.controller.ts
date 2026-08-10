import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductItemsService } from './product-items.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('product-items')
@Controller('product-items')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ProductItemsController {
  constructor(private service: ProductItemsService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('SHOP_ADMIN')
  create(@Body() dto: { productId: string; shopId: string; quantity: number; notes?: string }) {
    return this.service.create(dto);
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SHOP_ADMIN')
  findAll(@Query() query: any, @CurrentUser() user: any) {
    const shopId = user.role === 'SUPER_ADMIN' ? query.shopId : (query.shopId || undefined);
    return this.service.findAll({
      shopId,
      productId: query.productId,
      status: query.status,
      page: query.page ? +query.page : 1,
      limit: query.limit ? +query.limit : 20,
    });
  }

  @Get('by-serial/:serial')
  @UseGuards(RolesGuard)
  @Roles('SHOP_ADMIN')
  findBySerial(@Param('serial') serial: string) {
    return this.service.findBySerial(serial);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SHOP_ADMIN')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Patch(':id/sold')
  @UseGuards(RolesGuard)
  @Roles('SHOP_ADMIN')
  markSold(
    @Param('id') id: string,
    @Body() dto: { orderId: string; shopId: string },
    @CurrentUser() user: any,
  ) {
    return this.service.markSold(id, dto.orderId, dto.shopId);
  }
}
