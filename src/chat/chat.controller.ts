import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';
import { OptionalJwtGuard } from '../auth/guards/optional-jwt.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('chat')
@Controller('chat')
export class ChatController {
  constructor(private chat: ChatService) {}

  @Post()
  @UseGuards(OptionalJwtGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  sendMessage(@Body() dto: SendMessageDto, @CurrentUser() user?: any) {
    return this.chat.sendMessage(dto, user?.id);
  }

  @Post('link')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  linkSession(@Body('sessionToken') sessionToken: string, @CurrentUser() user: any) {
    if (!sessionToken?.trim()) return;
    return this.chat.linkSession(sessionToken, user.id);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  getSessions(@Query('status') status?: string) {
    return this.chat.getSessions(status);
  }

  @Get('sessions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  getSession(@Param('id') id: string) {
    return this.chat.getSession(id);
  }

  @Put('sessions/:id/claim')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  claimSession(@Param('id') id: string, @CurrentUser() user: any) {
    return this.chat.claimSession(id, user.id);
  }

  @Post('sessions/:id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  agentReply(@Param('id') id: string, @Body() dto: AdminReplyDto, @CurrentUser() user: any) {
    return this.chat.agentReply(id, dto, user.id);
  }

  @Delete('sessions/:id/reply')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SHOP_ADMIN')
  @ApiBearerAuth()
  closeSession(@Param('id') id: string) {
    return this.chat.closeSession(id);
  }
}
