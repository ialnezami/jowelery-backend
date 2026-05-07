import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getShopIdForAdmin(userId: string): Promise<string | undefined> {
    const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
    return shop?.id;
  }

  async getDashboard(shopId?: string) {
    const orderWhere: any = { status: { notIn: ['CANCELLED'] } };
    const productWhere: any = { isActive: true };
    if (shopId) { orderWhere.shopId = shopId; productWhere.shopId = shopId; }

    const [totalOrders, revenueAgg, totalProducts, totalUsers, recentOrders] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.aggregate({ where: orderWhere, _sum: { total: true } }),
      this.prisma.product.count({ where: productWhere }),
      shopId ? Promise.resolve(0) : this.prisma.user.count({ where: { role: 'CLIENT' } }),
      this.prisma.order.findMany({
        where: orderWhere,
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      }),
    ]);

    const totalRevenue = revenueAgg._sum.total || 0;

    return {
      totalOrders,
      totalRevenue,
      totalProducts,
      totalUsers,
      averageOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      recentOrders,
    };
  }

  async getOrdersByStatus(shopId?: string) {
    const where: any = {};
    if (shopId) where.shopId = shopId;

    const statuses = await this.prisma.order.groupBy({
      by: ['status'],
      where,
      _count: { status: true },
    });

    return statuses.map((s) => ({ status: s.status, count: s._count.status }));
  }

  async getTopProducts(shopId?: string, limit = 10) {
    const groups = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: shopId ? { order: { shopId } } : undefined,
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: Number(limit),
    });

    // Enrich with product names in one query
    const ids = groups.map((g) => g.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    });
    const nameMap = Object.fromEntries(products.map((p) => [p.id, p.name]));

    return groups.map((g) => ({
      productId: g.productId,
      productName: nameMap[g.productId] || 'Unknown',
      quantitySold: g._sum.quantity || 0,
    }));
  }

  async getRevenueByShop() {
    const shops = await this.prisma.shop.findMany({
      select: { id: true, name: true },
    });

    const results = await Promise.all(
      shops.map(async (shop) => {
        const agg = await this.prisma.order.aggregate({
          where: { shopId: shop.id, status: { notIn: ['CANCELLED'] } },
          _sum: { total: true },
          _count: { id: true },
        });
        return {
          shopId: shop.id,
          shopName: shop.name,
          totalRevenue: agg._sum.total || 0,
          totalOrders: agg._count.id,
        };
      }),
    );

    return results.sort((a, b) => b.totalRevenue - a.totalRevenue);
  }
}
