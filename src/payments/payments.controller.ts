import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private payments: PaymentsService) {}

  @Post('session')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createSession(@Body() dto: any) {
    return this.payments.createPaymentSession(dto);
  }

  @Post('webhook')
  webhook(@Body() notification: any) {
    return this.payments.handleWebhook(notification);
  }
}
