import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';

const KARAT_PURITY: Record<string, number> = {
  K24: 1.0, K22: 0.9167, K21: 0.875, K18: 0.75, K14: 0.5833,
};

@Injectable()
export class ProductsService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: {
    shopId?: string; category?: string; karat?: string;
    minPrice?: number; maxPrice?: number; search?: string;
    page?: number; limit?: number;
  }) {
    const { shopId, category, karat, minPrice, maxPrice, search, page = 1, limit = 20 } = query;
    const where: any = { isActive: true };
    if (shopId) where.shopId = shopId;
    if (category) where.category = category;
    if (karat) where.karat = karat;
    if (minPrice || maxPrice) {
      where.finalPrice = {};
      if (minPrice) where.finalPrice.gte = Number(minPrice);
      if (maxPrice) where.finalPrice.lte = Number(maxPrice);
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: { shop: { select: { id: true, name: true } } },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page: Number(page), limit: Number(limit), pages: Math.ceil(total / Number(limit)) };
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { shop: { select: { id: true, name: true, logo: true } } },
    });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(dto: CreateProductDto) {
    const goldRate = await this.prisma.goldRate.findFirst({
      where: { karat: dto.karat as any },
      orderBy: { timestamp: 'desc' },
    });

    const ratePerGram = goldRate?.rate || 0;
    const purity = KARAT_PURITY[dto.karat];
    const finalPrice = (ratePerGram * purity * dto.weight) + (dto.makingCharges * dto.weight);

    return this.prisma.product.create({
      data: { ...dto, karat: dto.karat as any, category: dto.category as any, finalPrice, basePricePerGram: ratePerGram },
    });
  }

  async update(id: string, dto: Partial<CreateProductDto>, userId: string, userRole: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { shop: true } });
    if (!product) throw new NotFoundException('Product not found');
    if (userRole === 'SHOP_ADMIN' && product.shop.adminId !== userId) throw new ForbiddenException('Not your product');
    return this.prisma.product.update({ where: { id }, data: dto as any });
  }

  async remove(id: string, userId: string, userRole: string) {
    const product = await this.prisma.product.findUnique({ where: { id }, include: { shop: true } });
    if (!product) throw new NotFoundException('Product not found');
    if (userRole === 'SHOP_ADMIN' && product.shop.adminId !== userId) throw new ForbiddenException('Not your product');
    return this.prisma.product.update({ where: { id }, data: { isActive: false } });
  }

  async recalculatePrices(shopId?: string) {
    const where: any = { isActive: true };
    if (shopId) where.shopId = shopId;
    const products = await this.prisma.product.findMany({ where });
    const updates = [];

    for (const product of products) {
      const goldRate = await this.prisma.goldRate.findFirst({
        where: { karat: product.karat },
        orderBy: { timestamp: 'desc' },
      });
      if (!goldRate) continue;
      const purity = KARAT_PURITY[product.karat];
      const finalPrice = (goldRate.rate * purity * product.weight) + (product.makingCharges * product.weight);
      updates.push(this.prisma.product.update({ where: { id: product.id }, data: { finalPrice, basePricePerGram: goldRate.rate } }));
    }

    await Promise.all(updates);
    return { updated: updates.length };
  }
}
