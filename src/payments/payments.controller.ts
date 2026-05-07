import { Controller, Post, Body, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
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
  async webhook(@Body() body: any, @Res() res: Response) {
    const result = await this.payments.handleWebhook(body);
    // Adyen expects plain text `[accepted]` — not JSON
    res.setHeader('Content-Type', 'text/plain');
    res.send(result);
  }
}
