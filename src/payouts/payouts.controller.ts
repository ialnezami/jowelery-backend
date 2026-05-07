import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PayoutsService } from './payouts.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('payouts')
@Controller('payouts')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth()
export class PayoutsController {
  constructor(private service: PayoutsService) {}

  @Get()
  findAll(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  @Post('calculate')
  calculate(@Body() body: { shopId: string; periodStart: string; periodEnd: string }) {
    return this.service.calculateCommission(body.shopId, body.periodStart, body.periodEnd);
  }

  @Patch(':id/mark-paid')
  markPaid(@Param('id') id: string, @Body('notes') notes: string) {
    return this.service.markPaid(id, notes);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
