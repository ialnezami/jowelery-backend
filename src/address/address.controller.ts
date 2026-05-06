import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AddressService } from './address.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('address')
@Controller('address')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class AddressController {
  constructor(private address: AddressService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.address.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: any) {
    return this.address.create(user.id, dto);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.address.update(id, user.id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.address.remove(id, user.id);
  }
}
