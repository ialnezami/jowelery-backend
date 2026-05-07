import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('orders')
@Controller('orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private orders: OrdersService) {}

  @Get()
  findAll(@CurrentUser() user: any, @Query() query: any) {
    return this.orders.findAll(user.id, user.role, query);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.orders.findOne(id, user.id, user.role);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: any) {
    return this.orders.create(user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body('status') status: string, @CurrentUser() user: any) {
    return this.orders.updateStatus(id, status, user.id, user.role);
  }

  @Patch(':id/refund')
  refund(@Param('id') id: string, @Body('reason') reason: string, @CurrentUser() user: any) {
    if (user.role === 'CLIENT') throw new ForbiddenException('Clients cannot process refunds');
    return this.orders.refund(id, user.id, user.role, reason);
  }
}
