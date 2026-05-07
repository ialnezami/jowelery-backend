import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';
import axios from 'axios';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);
  private readonly from: string;

  constructor(private config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.from = config.get<string>('SMTP_FROM') || 'Jowelery <noreply@jowelery.com>';

    if (host && user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port: config.get<number>('SMTP_PORT') || 587,
        secure: config.get<boolean>('SMTP_SECURE') || false,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only');
    }
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[EMAIL STUB] To: ${to} | Subject: ${subject}`);
      return;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err: any) {
      // Log but never throw — email failure must not break the business operation
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }

  async sendOrderConfirmed(to: string, payload: {
    name: string;
    orderNumber: string;
    total: number;
    currency: string;
    items: Array<{ name: string; quantity: number; price: number }>;
  }): Promise<void> {
    const itemRows = payload.items
      .map(i => `<tr><td style="padding:6px 0">${i.name}</td><td style="padding:6px 0;text-align:right">×${i.quantity}</td><td style="padding:6px 0;text-align:right">${payload.currency} ${(i.price * i.quantity).toFixed(2)}</td></tr>`)
      .join('');

    await this.send(to, `Order Confirmed — ${payload.orderNumber}`, `
      ${this.layout(`
        <h2 style="color:#B8912A;margin:0 0 8px">Order Confirmed ✓</h2>
        <p>Hi ${payload.name}, your order <strong>${payload.orderNumber}</strong> has been confirmed.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <thead><tr style="border-bottom:1px solid #eee">
            <th style="text-align:left;padding:6px 0">Item</th>
            <th style="text-align:right;padding:6px 0">Qty</th>
            <th style="text-align:right;padding:6px 0">Price</th>
          </tr></thead>
          <tbody>${itemRows}</tbody>
          <tfoot><tr style="border-top:1px solid #eee">
            <td colspan="2" style="padding:10px 0;font-weight:700">Total</td>
            <td style="padding:10px 0;text-align:right;font-weight:700;color:#B8912A">${payload.currency} ${payload.total.toFixed(2)}</td>
          </tr></tfoot>
        </table>
        <p style="color:#6B7280;font-size:13px">We'll notify you when your order ships.</p>
      `)}
    `);
  }

  async sendOrderShipped(to: string, payload: {
    name: string;
    orderNumber: string;
  }): Promise<void> {
    await this.send(to, `Your Order ${payload.orderNumber} Has Shipped`, `
      ${this.layout(`
        <h2 style="color:#B8912A;margin:0 0 8px">Your Order is on the Way 🚚</h2>
        <p>Hi ${payload.name}, your order <strong>${payload.orderNumber}</strong> has been shipped and is on its way to you.</p>
        <p style="color:#6B7280;font-size:13px">You can track your order status in the Jowelery app.</p>
      `)}
    `);
  }

  async sendOrderDelivered(to: string, payload: {
    name: string;
    orderNumber: string;
  }): Promise<void> {
    await this.send(to, `Order ${payload.orderNumber} Delivered`, `
      ${this.layout(`
        <h2 style="color:#B8912A;margin:0 0 8px">Order Delivered ✓</h2>
        <p>Hi ${payload.name}, your order <strong>${payload.orderNumber}</strong> has been delivered. Enjoy your jewellery!</p>
        <p style="color:#6B7280;font-size:13px">If you have any questions, please contact us.</p>
      `)}
    `);
  }

  async sendOrderCancelled(to: string, payload: {
    name: string;
    orderNumber: string;
  }): Promise<void> {
    await this.send(to, `Order ${payload.orderNumber} Cancelled`, `
      ${this.layout(`
        <h2 style="color:#B8912A;margin:0 0 8px">Order Cancelled</h2>
        <p>Hi ${payload.name}, your order <strong>${payload.orderNumber}</strong> has been cancelled.</p>
        <p style="color:#6B7280;font-size:13px">If you did not request this cancellation, please contact us immediately.</p>
      `)}
    `);
  }

  async sendPasswordReset(to: string, payload: {
    name: string;
    resetLink: string;
  }): Promise<void> {
    await this.send(to, 'Reset Your Jowelery Password', `
      ${this.layout(`
        <h2 style="color:#B8912A;margin:0 0 8px">Password Reset Request</h2>
        <p>Hi ${payload.name}, we received a request to reset your password.</p>
        <p><a href="${payload.resetLink}" style="display:inline-block;background:#B8912A;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a></p>
        <p style="color:#6B7280;font-size:13px">This link expires in 1 hour. If you did not request a reset, ignore this email.</p>
      `)}
    `);
  }

  async sendPushNotification(pushToken: string, title: string, body: string, data?: Record<string, any>): Promise<void> {
    if (!pushToken?.startsWith('ExponentPushToken')) return;
    try {
      await axios.post(EXPO_PUSH_URL, { to: pushToken, title, body, data, sound: 'default' }, {
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        timeout: 5000,
      });
    } catch (err: any) {
      this.logger.error(`Push notification failed for ${pushToken}: ${err.message}`);
    }
  }

  private layout(content: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <body style="font-family:Georgia,serif;background:#FAF6EF;margin:0;padding:24px">
        <div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #E5D8C0">
          <div style="text-align:center;margin-bottom:24px">
            <span style="font-size:28px;color:#B8912A">✦</span>
            <div style="font-size:14px;font-weight:700;letter-spacing:4px;color:#1F2937;margin-top:4px">JOWELERY</div>
          </div>
          ${content}
          <hr style="border:none;border-top:1px solid #E5D8C0;margin:24px 0">
          <p style="color:#9CA3AF;font-size:11px;text-align:center;letter-spacing:1px">SECURE · TRUSTED · AUTHENTIC</p>
        </div>
      </body>
      </html>
    `;
  }
}
