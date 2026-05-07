import { Controller, Get, Post, Put, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { RecipientsService } from './recipients.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('recipients')
@Controller('recipients')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecipientsController {
  constructor(private recipients: RecipientsService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.recipients.findAll(user.id);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() dto: any) {
    return this.recipients.create(user.id, dto);
  }

  @Put(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.recipients.update(id, user.id, dto);
  }

  @Patch(':id')
  updatePartial(@CurrentUser() user: any, @Param('id') id: string, @Body() dto: any) {
    return this.recipients.update(id, user.id, dto);
  }

  @Put(':id/set-default')
  setDefault(@CurrentUser() user: any, @Param('id') id: string) {
    return this.recipients.update(id, user.id, { isDefault: true });
  }

  @Delete(':id')
  remove(@CurrentUser() user: any, @Param('id') id: string) {
    return this.recipients.remove(id, user.id);
  }
}
