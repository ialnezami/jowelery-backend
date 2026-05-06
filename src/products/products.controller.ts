import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private products: ProductsService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.products.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.products.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  create(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: Partial<CreateProductDto>, @CurrentUser() user: any) {
    return this.products.update(id, dto, user.id, user.role);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN', 'SUPER_ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.products.remove(id, user.id, user.role);
  }

  @Post('recalculate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  recalculate(@Query('shopId') shopId?: string) {
    return this.products.recalculatePrices(shopId);
  }
}
