import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GoldRatesService } from './gold-rates.service';
import { GoldRatesScheduler } from './gold-rates.scheduler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('gold-rates')
@Controller('gold-rates')
export class GoldRatesController {
  constructor(private goldRates: GoldRatesService, private scheduler: GoldRatesScheduler) {}

  @Get()
  getCurrent() {
    return this.goldRates.getCurrent();
  }

  @Get('history')
  getHistory(@Query('karat') karat?: string, @Query('limit') limit?: number) {
    return this.goldRates.getHistory(karat, limit);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  setRate(@Body() dto: { karat: string; rate: number; currency?: string }) {
    return this.goldRates.setRate(dto.karat, dto.rate, dto.currency);
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  async syncNow() {
    await this.scheduler.syncGoldRates();
    return this.goldRates.getCurrent();
  }
}
