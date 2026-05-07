import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PayoutsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { shopId?: string; status?: string; page?: number; limit?: number }) {
    const { shopId, status, page = 1, limit = 20 } = query;
    const where: any = {};
    if (shopId) where.shopId = shopId;
    if (status) where.status = status;

    const [payouts, total] = await Promise.all([
      this.prisma.payout.findMany({
        where,
        include: { shop: { select: { id: true, name: true } } },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.payout.count({ where }),
    ]);

    return { payouts, total, page: Number(page) };
  }

  async create(data: {
    shopId: string;
    amount: number;
    currency?: string;
    periodStart: string;
    periodEnd: string;
    notes?: string;
  }) {
    if (data.amount <= 0) throw new BadRequestException('Amount must be positive');

    const shop = await this.prisma.shop.findUnique({ where: { id: data.shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    return this.prisma.payout.create({
      data: {
        ...data,
        currency: data.currency || 'USD',
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
      },
      include: { shop: { select: { id: true, name: true } } },
    });
  }

  async markPaid(id: string, notes?: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'PAID') throw new BadRequestException('Payout is already marked as paid');

    return this.prisma.payout.update({
      where: { id },
      data: { status: 'PAID', paidAt: new Date(), notes: notes || payout.notes },
      include: { shop: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string) {
    const payout = await this.prisma.payout.findUnique({ where: { id } });
    if (!payout) throw new NotFoundException('Payout not found');
    if (payout.status === 'PAID') throw new BadRequestException('Cannot delete a paid payout');
    return this.prisma.payout.delete({ where: { id } });
  }

  // Calculate commission owed to a shop for a given period
  async calculateCommission(shopId: string, periodStart: string, periodEnd: string) {
    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    const orders = await this.prisma.order.findMany({
      where: {
        shopId,
        status: { in: ['DELIVERED', 'COMPLETED'] },
        createdAt: { gte: new Date(periodStart), lte: new Date(periodEnd) },
      },
      select: { id: true, total: true, orderNumber: true, createdAt: true },
    });

    const grossRevenue = orders.reduce((sum, o) => sum + o.total, 0);
    const commission = Number((grossRevenue * shop.commissionRate).toFixed(2));

    return {
      shopId,
      shopName: shop.name,
      commissionRate: shop.commissionRate,
      grossRevenue: Number(grossRevenue.toFixed(2)),
      commissionOwed: commission,
      orderCount: orders.length,
      periodStart,
      periodEnd,
    };
  }
}
