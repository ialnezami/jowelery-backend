import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ItemTransfersService } from './item-transfers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('item-transfers')
@Controller('item-transfers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SHOP_ADMIN')
@ApiBearerAuth()
export class ItemTransfersController {
  constructor(private service: ItemTransfersService) {}

  @Get()
  findAll(@Query() query: any, @CurrentUser() user: any) {
    return this.service.findAll({
      shopId: query.shopId,
      role: user.role,
      direction: query.direction,
      status: query.status,
      page: query.page ? +query.page : 1,
      limit: query.limit ? +query.limit : 20,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  initiate(
    @Body() dto: { itemId: string; toShopId: string; notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.initiate({
      itemId: dto.itemId,
      toShopId: dto.toShopId,
      initiatedBy: user.id,
      initiatorUserId: user.id,
      initiatorRole: user.role,
      notes: dto.notes,
    });
  }

  @Patch(':id/confirm')
  confirm(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.confirm(id, user.id, user.role);
  }

  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: { notes?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.reject(id, user.id, user.role, dto.notes);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.cancel(id, user.id, user.role);
  }
}
