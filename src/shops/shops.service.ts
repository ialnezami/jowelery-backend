import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';

const SHOPS_LIST_KEY = 'shops:list';
const SHOPS_LIST_TTL = 300;

@Injectable()
export class ShopsService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async findAll(query: { status?: string; page?: number; limit?: number }) {
    const cached = await this.cache.get<any>(SHOPS_LIST_KEY);
    if (cached) return cached;

    const { status = 'ACTIVE', page = 1, limit = 20 } = query;
    const where: any = {};
    if (status) where.status = status;

    const [shops, total] = await Promise.all([
      this.prisma.shop.findMany({
        where,
        select: {
          id: true, name: true, logo: true, banner: true, description: true,
          city: true, country: true, status: true,
          admin: { select: { id: true, name: true, email: true } },
          _count: { select: { products: true, orders: true } },
        },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.shop.count({ where }),
    ]);

    const result = { shops, total, page };
    await this.cache.set(SHOPS_LIST_KEY, result, SHOPS_LIST_TTL);
    return result;
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
    const { adminId, ...rest } = data;
    let shop: any;
    if (!adminId) {
      shop = await this.prisma.shop.create({ data });
    } else {
      shop = await this.prisma.$transaction(async (tx) => {
        const s = await tx.shop.create({ data: { ...rest, adminId } });
        await tx.user.update({ where: { id: adminId }, data: { role: 'SHOP_ADMIN' } });
        return s;
      });
    }
    await this.cache.del(SHOPS_LIST_KEY);
    return shop;
  }

  async update(id: string, data: any, userId: string, userRole: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id } });
    if (!shop) throw new NotFoundException('Shop not found');
    if (userRole === 'SHOP_ADMIN' && shop.adminId !== userId) throw new ForbiddenException('Not your shop');

    const incomingAdminId = data.adminId;
    const adminChanging = incomingAdminId && incomingAdminId !== shop.adminId;

    let result: any;
    if (!adminChanging) {
      result = await this.prisma.shop.update({ where: { id }, data });
    } else {
      result = await this.prisma.$transaction(async (tx) => {
        const updated = await tx.shop.update({ where: { id }, data });

        await tx.user.update({ where: { id: incomingAdminId }, data: { role: 'SHOP_ADMIN' } });

        if (shop.adminId) {
          const stillAdmin = await tx.shop.findFirst({ where: { adminId: shop.adminId } });
          if (!stillAdmin) {
            await tx.user.update({ where: { id: shop.adminId }, data: { role: 'CLIENT' } });
          }
        }

        return updated;
      });
    }
    await this.cache.del(SHOPS_LIST_KEY);
    return result;
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
