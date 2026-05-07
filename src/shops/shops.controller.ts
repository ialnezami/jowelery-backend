import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopsService } from './shops.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('shops')
@Controller('shops')
export class ShopsController {
  constructor(private shops: ShopsService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.shops.findAll(query);
  }

  @Get('my-shop')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  getMyShop(@CurrentUser() user: any) {
    return this.shops.getMyShop(user.id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.shops.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  create(@Body() dto: any) {
    return this.shops.create(dto);
  }

  @Get('customers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  getCustomers(@CurrentUser() user: any, @Query() query: any) {
    if (user.role === 'CLIENT') throw new ForbiddenException();
    return this.shops.getCustomers(user.id, user.role, query);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: any, @CurrentUser() user: any) {
    return this.shops.update(id, dto, user.id, user.role);
  }
}
