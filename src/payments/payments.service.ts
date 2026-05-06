import { Injectable } from '@nestjs/common';
import { Client, CheckoutAPI } from '@adyen/api-library';

@Injectable()
export class PaymentsService {
  private checkout: CheckoutAPI;

  constructor() {
    const client = new Client({
      apiKey: process.env.ADYEN_API_KEY!,
      environment: process.env.NODE_ENV === 'production' ? 'LIVE' : 'TEST',
    });
    this.checkout = new CheckoutAPI(client);
  }

  async createPaymentSession(data: { amount: number; currency: string; orderId: string; returnUrl: string }) {
    return this.checkout.PaymentsApi.sessions({
      amount: { value: Math.round(data.amount * 100), currency: data.currency },
      merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT!,
      reference: data.orderId,
      returnUrl: data.returnUrl,
      channel: 'Web',
    });
  }

  async handleWebhook(notification: any) {
    return { received: true };
  }
}
