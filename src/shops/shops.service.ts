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
}
