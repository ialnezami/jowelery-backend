import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('currencies')
@Controller('currencies')
export class CurrenciesController {
  constructor(private service: CurrenciesService) {}

  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Post('sync')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  @ApiBearerAuth()
  syncRates() {
    return this.service.syncRates();
  }
}
