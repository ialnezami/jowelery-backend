import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShopsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { status?: string; page?: number; limit?: number }) {
    const { status = 'ACTIVE', page = 1, limit = 20 } = query;
    const where: any = {};
    if (status) where.status = status;

    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        select: { id: true, name: true, logo: true, banner: true, description: true, city: true, country: true, status: true },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.shop.count({ where }),
    ]);

    return { shops, total, page };
  }

  async findOne(id: string) {
    const shop = await this.prisma.shop.findUnique({
      where: { id },
      include: {
        admin: { select: { id: true, name: true, email: true } },
        _count: { select: { products: true, orders: true } },
      },
    });
    if (!shop) throw new NotFoundException('Shop not found');
    return shop;
  }

  async create(data: any) {
    return this.prisma.shop.create({ data });
  }

  async update(id: string, data: any, userId: string, userRole: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (userRole === 'SHOP_ADMIN' && shop.adminId !== userId) throw new ForbiddenException('Not your shop');
    return this.prisma.shop.update({ where: { id }, data });
  }

  async getMyShop(adminId: string) {
    const shop = await this.prisma.shop.findUnique({ where: { adminId } });
    if (!shop) throw new NotFoundException('No shop found for this admin');
    return shop;
  }

  async getCustomers(userId: string, userRole: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;

    let shopId: string | undefined;
    if (userRole === 'SHOP_ADMIN') {
      const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
      if (!shop) throw new NotFoundException('No shop found for this admin');
      shopId = shop.id;
    }

    const where: any = { status: { in: ['DELIVERED', 'COMPLETED', 'PROCESSING', 'PAYMENT_CONFIRMED', 'SHIPPED'] } };
    if (shopId) where.shopId = shopId;

    const orders = await this.prisma.order.findMany({
      where,
      select: {
        userId: true,
        total: true,
        user: { select: { id: true, name: true, email: true, createdAt: true } },
      },
    });

    // Aggregate per customer
    const customerMap = new Map<string, { id: string; name: string | null; email: string; totalSpent: number; orderCount: number; joinedAt: Date }>();
    for (const order of orders) {
      const existing = customerMap.get(order.userId);
      if (existing) {
        existing.totalSpent += order.total;
        existing.orderCount += 1;
      } else {
        customerMap.set(order.userId, {
          id: order.user.id,
          name: order.user.name,
          email: order.user.email,
          totalSpent: order.total,
          orderCount: 1,
          joinedAt: order.user.createdAt,
        });
      }
    }

    const customers = Array.from(customerMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const total = customers.length;
    const start = (Number(page) - 1) * Number(limit);
    return { customers: customers.slice(start, start + Number(limit)), total, page: Number(page) };
  }
}
