import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CouponsService } from './coupons.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('coupons')
@Controller('coupons')
export class CouponsController {
  constructor(private service: CouponsService) {}

  @Post('validate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  validate(@Body() body: { code: string; orderTotal: number }) {
    return this.service.validate(body.code, body.orderTotal);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  update(@Param('id') id: string, @Body() dto: any) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
