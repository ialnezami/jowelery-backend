import { Controller, Get, Patch, Put, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private users: UsersService) {}

  @Get()
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  findAll(@Query() query: any) {
    return this.users.findAll(query);
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.users.findOne(user.id);
  }

  @Patch('me')
  updateMe(@CurrentUser() user: any, @Body() dto: any) {
    return this.users.update(user.id, dto);
  }

  @Get('profile')
  getProfile(@CurrentUser() user: any) {
    return this.users.findOne(user.id);
  }

  @Put('profile')
  updateProfile(@CurrentUser() user: any, @Body() dto: any) {
    return this.users.update(user.id, dto);
  }

  @Post('change-email')
  changeEmail(@CurrentUser() user: any, @Body() dto: { currentPassword: string; newEmail: string }) {
    return this.users.changeEmail(user.id, dto.currentPassword, dto.newEmail);
  }

  @Post('change-password')
  changePassword(@CurrentUser() user: any, @Body() dto: { currentPassword: string; newPassword: string }) {
    return this.users.changePassword(user.id, dto.currentPassword, dto.newPassword);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.users.findOne(id);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.users.update(id, dto);
  }
}
