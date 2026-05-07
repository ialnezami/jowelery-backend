import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(private prisma: PrismaService) {}

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
    const { items, shopId: providedShopId, shippingMethod, shippingAddress, paymentMethod, notes, currency = 'USD' } = data;
    if (!items?.length) throw new BadRequestException('Order must contain at least one item');
    let shopId = providedShopId;
    let total = 0;
    const orderItems: any[] = [];

    for (const item of items) {
      const product = await this.prisma.product.findUnique({ where: { id: item.productId } });
      if (!product) throw new NotFoundException(`Product ${item.productId} not found`);
      if (!shopId) shopId = product.shopId;
      total += product.finalPrice * item.quantity;
      orderItems.push({ productId: item.productId, quantity: item.quantity, priceAtPurchase: product.finalPrice, currency });
    }

    if (!shopId) throw new BadRequestException('Could not determine shopId from order items');

    return this.prisma.order.create({
      data: {
        userId, shopId,
        orderNumber: `JOW-${uuidv4().slice(0, 8).toUpperCase()}`,
        total, currency,
        status: 'PENDING_PAYMENT',
        paymentMethod, shippingMethod, shippingAddress, notes,
        items: { create: orderItems },
      },
      include: { items: true },
    });
  }

  async updateStatus(id: string, status: string, userId: string, userRole: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');

    if (userRole === 'CLIENT') {
      if (status !== 'CANCELLED') throw new ForbiddenException('Clients can only cancel orders');
      if (order.userId !== userId) throw new ForbiddenException();
    }

    return this.prisma.order.update({ where: { id }, data: { status: status as any } });
  }
}
