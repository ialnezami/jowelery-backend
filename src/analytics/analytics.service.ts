import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboard(shopId?: string) {
    const orderWhere: any = { status: { notIn: ['CANCELLED'] } };
    const productWhere: any = { isActive: true };
    if (shopId) { orderWhere.shopId = shopId; productWhere.shopId = shopId; }

    const [totalOrders, revenueAgg, totalProducts, totalUsers] = await Promise.all([
      this.prisma.order.count({ where: orderWhere }),
      this.prisma.order.aggregate({ where: orderWhere, _sum: { total: true } }),
      this.prisma.product.count({ where: productWhere }),
      shopId ? Promise.resolve(0) : this.prisma.user.count({ where: { role: 'CLIENT' } }),
    ]);

    return {
      totalOrders,
      totalRevenue: revenueAgg._sum.total || 0,
      totalProducts,
      totalUsers,
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

  async getTopProducts(shopId?: string, limit: number = 10) {
    return this.prisma.orderItem.groupBy({
      by: ['productId'],
      where: shopId ? { order: { shopId } } : undefined,
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: Number(limit),
    });
  }
}
