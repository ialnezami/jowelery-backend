import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, CheckoutAPI, EnvironmentEnum } from '@adyen/api-library';
import { CreateCheckoutSessionRequest } from '@adyen/api-library/lib/src/typings/checkout/createCheckoutSessionRequest';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class PaymentsService {
  private checkout: CheckoutAPI;
  private readonly logger = new Logger(PaymentsService.name);
  private readonly hmacKey: string | undefined;

  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private config: ConfigService,
  ) {
    const apiKey = config.get<string>('ADYEN_API_KEY');
    this.hmacKey = config.get<string>('ADYEN_HMAC_KEY');

    const client = new Client({
      apiKey: apiKey || '',
      environment: config.get('NODE_ENV') === 'production' ? EnvironmentEnum.LIVE : EnvironmentEnum.TEST,
    });
    this.checkout = new CheckoutAPI(client);
  }

  async createPaymentSession(data: {
    amount: number;
    currency: string;
    orderId: string;
    returnUrl: string;
  }) {
    return this.checkout.PaymentsApi.sessions({
      amount: { value: Math.round(data.amount * 100), currency: data.currency },
      merchantAccount: this.config.get<string>('ADYEN_MERCHANT_ACCOUNT') || '',
      reference: data.orderId,
      returnUrl: data.returnUrl,
      channel: CreateCheckoutSessionRequest.ChannelEnum.Web,
    });
  }

  async handleWebhook(body: any): Promise<string> {
    const items: any[] = body?.notificationItems ?? [];

    for (const wrapper of items) {
      const item = wrapper?.NotificationRequestItem ?? wrapper;
      if (!item) continue;

      // Verify HMAC signature when key is configured
      if (this.hmacKey && !this.verifyHmac(item, this.hmacKey)) {
        this.logger.warn(`HMAC verification failed for notification: ${item.pspReference}`);
        continue;
      }

      const { eventCode, success, merchantReference, pspReference, amount } = item;
      this.logger.log(`Adyen webhook: ${eventCode} | success=${success} | ref=${merchantReference}`);

      try {
        if (eventCode === 'AUTHORISATION' && String(success) === 'true') {
          await this.handleAuthorisationSuccess(merchantReference, pspReference, amount);
        } else if (eventCode === 'CANCELLATION' || (eventCode === 'AUTHORISATION' && String(success) === 'false')) {
          await this.handlePaymentFailed(merchantReference, pspReference);
        } else if (eventCode === 'REFUND' && String(success) === 'true') {
          await this.handleRefundSuccess(merchantReference, pspReference, amount);
        }
      } catch (err: any) {
        // Log but never throw — Adyen retries if we return non-200
        this.logger.error(`Error processing webhook ${eventCode}: ${err.message}`);
      }
    }

    // Adyen requires exactly this string to stop retrying
    return '[accepted]';
  }

  private async handleAuthorisationSuccess(orderId: string, pspReference: string, amount: any) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, finalPrice: true } } } },
      },
    });
    if (!order) {
      this.logger.warn(`Order not found for webhook reference: ${orderId}`);
      return;
    }

    // Idempotency: only advance if still pending
    if (order.status !== 'PENDING_PAYMENT') {
      this.logger.log(`Order ${orderId} already at status ${order.status} — skipping`);
      return;
    }

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'PAYMENT_CONFIRMED', paymentStatus: 'paid' },
      }),
      this.prisma.transaction.create({
        data: {
          orderId,
          amount: amount?.value ? amount.value / 100 : order.total,
          currency: amount?.currency ?? order.currency,
          paymentMethod: order.paymentMethod ?? 'card',
          status: 'completed',
          transactionId: pspReference,
        },
      }),
    ]);

    // Send confirmation email — fire-and-forget
    if (order.user?.email) {
      const orderNumber = (order as any).orderNumber || orderId.slice(-8).toUpperCase();
      this.email.sendOrderConfirmed(order.user.email, {
        name: order.user.name || order.user.email,
        orderNumber,
        total: order.total,
        currency: order.currency || 'USD',
        items: (order.items as any[]).map((i) => ({
          name: i.product?.name || 'Product',
          quantity: i.quantity,
          price: i.priceAtPurchase,
        })),
      }).catch(() => {});
    }
  }

  private async handlePaymentFailed(orderId: string, pspReference: string) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.status !== 'PENDING_PAYMENT') return;

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'CANCELLED', paymentStatus: 'failed' },
      }),
      this.prisma.transaction.create({
        data: {
          orderId,
          amount: order.total,
          currency: order.currency,
          paymentMethod: order.paymentMethod ?? 'card',
          status: 'failed',
          transactionId: pspReference,
        },
      }),
    ]);
  }

  private async handleRefundSuccess(orderId: string, pspReference: string, amount: any) {
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return;

    await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id: orderId },
        data: { status: 'REFUNDED', paymentStatus: 'refunded' },
      }),
      this.prisma.transaction.create({
        data: {
          orderId,
          amount: amount?.value ? amount.value / 100 : order.total,
          currency: amount?.currency ?? order.currency,
          paymentMethod: order.paymentMethod ?? 'card',
          status: 'refunded',
          transactionId: pspReference,
        },
      }),
    ]);
  }

  private verifyHmac(notification: any, hmacKey: string): boolean {
    try {
      const dataToSign = [
        notification.pspReference,
        notification.originalReference ?? '',
        notification.merchantAccountCode,
        notification.merchantReference,
        notification.amount?.value?.toString() ?? '',
        notification.amount?.currency ?? '',
        notification.eventCode,
        notification.success?.toString() ?? '',
      ].join(':');

      const key = Buffer.from(hmacKey, 'hex');
      const hmac = crypto.createHmac('sha256', key).update(dataToSign).digest('base64');
      return hmac === notification.additionalData?.hmacSignature;
    } catch {
      return false;
    }
  }
}
