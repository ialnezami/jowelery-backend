import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { CouponsService } from '../coupons/coupons.service';
import { v4 as uuidv4 } from 'uuid';

const EMAIL_TRIGGER_STATUSES = new Set(['PAYMENT_CONFIRMED', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

@Injectable()
export class OrdersService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private coupons: CouponsService,
  ) {}

  async findAll(userId: string, userRole: string, query: { shopId?: string; status?: string; page?: number; limit?: number }) {
    const { shopId, status, page = 1, limit = 20 } = query;
    const where: any = {};

    if (userRole === 'CLIENT') where.userId = userId;
    else if (userRole === 'SHOP_ADMIN') {
      const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
      if (shop) where.shopId = shop.id;
    }

    if (shopId && userRole === 'SUPER_ADMIN') where.shopId = shopId;
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: { select: { id: true, name: true, images: true } } } },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return { orders, total, page };
  }

  async findOne(id: string, userId: string, userRole: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        shop: { select: { id: true, name: true, logo: true } },
        items: { include: { product: true } },
        transactions: true,
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (userRole === 'CLIENT' && order.userId !== userId) throw new ForbiddenException();
    if (userRole === 'SHOP_ADMIN') {
      const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
      if (!shop || order.shopId !== shop.id) throw new ForbiddenException();
    }

    return order;
  }

  async create(userId: string, data: any) {
    const { items, shopId: providedShopId, shippingMethod, shippingAddress, paymentMethod, notes, currency = 'USD', couponCode } = data;
    if (!items?.length) throw new BadRequestException('Order must contain at least one item');
    let shopId = providedShopId;
    let subtotal = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
      if (!shopId) shopId = product.shopId;
      subtotal += product.finalPrice * item.quantity;
      orderItems.push({ productId: item.productId, quantity: item.quantity, priceAtPurchase: product.finalPrice, currency });
    }

    if (!shopId) throw new BadRequestException('Could not determine shopId from order items');

    let discountAmount = 0;
    let appliedCouponCode: string | undefined;

    if (couponCode) {
      const result = await this.coupons.validate(couponCode, subtotal);
      if (!result.valid) throw new BadRequestException(result.error || 'Invalid coupon');
      discountAmount = result.discountAmount;
      appliedCouponCode = result.coupon.code;
    }

    const total = Math.max(0, subtotal - discountAmount);

    const order = await this.prisma.order.create({
      data: {
        userId, shopId,
        orderNumber: `JOW-${uuidv4().slice(0, 8).toUpperCase()}`,
        total, currency,
        status: 'PENDING_PAYMENT',
        paymentMethod, shippingMethod, shippingAddress, notes,
        couponCode: appliedCouponCode,
        discountAmount,
        items: { create: orderItems },
      },
      include: { items: true },
    });

    if (appliedCouponCode) {
      this.coupons.incrementUsage(appliedCouponCode).catch(() => {});
    }

    return order;
  }

  async updateStatus(id: string, status: string, userId: string, userRole: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, finalPrice: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    if (userRole === 'CLIENT') {
      if (status !== 'CANCELLED') throw new ForbiddenException('Clients can only cancel orders');
      if (order.userId !== userId) throw new ForbiddenException();
    }

    const updated = await this.prisma.order.update({ where: { id }, data: { status: status as any } });

    // Fire-and-forget email + push — never block the response
    if (EMAIL_TRIGGER_STATUSES.has(status) && order.user?.email) {
      this.triggerStatusEmail(status, order).catch(() => {});
    }
    this.triggerPushNotification(status, order).catch(() => {});

    return updated;
  }

  async refund(id: string, userId: string, userRole: string, reason?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!order) throw new NotFoundException('Order not found');

    const refundableStatuses = ['PAYMENT_CONFIRMED', 'PROCESSING', 'READY_FOR_PICKUP', 'SHIPPED', 'DELIVERED', 'COMPLETED'];
    if (!refundableStatuses.includes(order.status)) {
      throw new BadRequestException(`Cannot refund an order with status ${order.status}`);
    }

    if (userRole === 'SHOP_ADMIN') {
      const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
      if (!shop || order.shopId !== shop.id) throw new ForbiddenException();
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.order.update({
        where: { id },
        data: { status: 'REFUNDED', paymentStatus: 'refunded', notes: reason ? `Refund reason: ${reason}` : undefined },
      }),
      this.prisma.transaction.create({
        data: {
          orderId: id,
          amount: order.total,
          currency: order.currency,
          paymentMethod: order.paymentMethod ?? 'card',
          status: 'refunded',
          metadata: reason ? { reason } : undefined,
        },
      }),
    ]);

    return updated;
  }

  private async triggerStatusEmail(status: string, order: any) {
    const { email, name } = order.user;
    const displayName = name || email;
    const orderNumber = order.orderNumber || order.id.slice(-8).toUpperCase();

    switch (status) {
      case 'PAYMENT_CONFIRMED':
        await this.email.sendOrderConfirmed(email, {
          name: displayName,
          orderNumber,
          total: order.total,
          currency: order.currency || 'USD',
          items: order.items.map((i: any) => ({
            name: i.product?.name || 'Product',
            quantity: i.quantity,
            price: i.priceAtPurchase,
          })),
        });
        break;
      case 'SHIPPED':
        await this.email.sendOrderShipped(email, { name: displayName, orderNumber });
        break;
      case 'DELIVERED':
        await this.email.sendOrderDelivered(email, { name: displayName, orderNumber });
        break;
      case 'CANCELLED':
        await this.email.sendOrderCancelled(email, { name: displayName, orderNumber });
        break;
    }
  }

  private async triggerPushNotification(status: string, order: any) {
    const pushToken = await this.prisma.user.findUnique({
      where: { id: order.userId ?? order.user?.id },
      select: { pushToken: true },
    });
    if (!pushToken?.pushToken) return;
    const orderNumber = order.orderNumber || order.id.slice(-8).toUpperCase();
    const messages: Record<string, { title: string; body: string }> = {
      PAYMENT_CONFIRMED: { title: 'Order Confirmed ✓', body: `Your order ${orderNumber} is confirmed.` },
      PROCESSING:        { title: 'Order Processing', body: `Your order ${orderNumber} is being prepared.` },
      READY_FOR_PICKUP:  { title: 'Ready for Pickup!', body: `Your order ${orderNumber} is ready to pick up.` },
      SHIPPED:           { title: 'Order Shipped 🚚', body: `Your order ${orderNumber} is on its way!` },
      OUT_FOR_DELIVERY:  { title: 'Out for Delivery 📦', body: `Your order ${orderNumber} is out for delivery.` },
      DELIVERED:         { title: 'Order Delivered ✓', body: `Your order ${orderNumber} has been delivered.` },
      COMPLETED:         { title: 'Order Completed', body: `Your order ${orderNumber} is complete. Thank you!` },
      CANCELLED:         { title: 'Order Cancelled', body: `Your order ${orderNumber} has been cancelled.` },
    };
    const msg = messages[status];
    if (msg) {
      await this.email.sendPushNotification(pushToken.pushToken, msg.title, msg.body, { orderId: order.id });
    }
  }
}
