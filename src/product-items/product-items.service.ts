import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

@Injectable()
export class ProductItemsService {
  constructor(private prisma: PrismaService) {}

  private generateSerial(sku: string): string {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `${sku}-${hex}`;
  }

  async create(dto: {
    productId: string;
    shopId: string;
    quantity: number;
    notes?: string;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: dto.productId } });
    if (!product) throw new NotFoundException('Product not found');
    if (product.shopId !== dto.shopId) throw new ForbiddenException('Product does not belong to this shop');

    const items = await Promise.all(
      Array.from({ length: dto.quantity }).map(async () => {
        const serialNumber = this.generateSerial(product.sku);
        return this.prisma.productItem.create({
          data: {
            serialNumber,
            productId: dto.productId,
            shopId: dto.shopId,
            notes: dto.notes,
            events: [
              {
                type: 'CREATED',
                timestamp: new Date().toISOString(),
                shopId: dto.shopId,
              },
            ],
          },
        });
      }),
    );

    await this.prisma.product.update({
      where: { id: dto.productId },
      data: { stockQuantity: { increment: dto.quantity } },
    });

    return items;
  }

  async findAll(filters: { shopId?: string; productId?: string; status?: string; page?: number; limit?: number }) {
    const { shopId, productId, status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (shopId) where.shopId = shopId;
    if (productId) where.productId = productId;
    if (status) where.status = status;

    const [items, total] = await Promise.all([
      this.prisma.productItem.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          product: { select: { name: true, sku: true, category: true, karat: true, images: true } },
          shop: { select: { name: true } },
        },
      }),
      this.prisma.productItem.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const item = await this.prisma.productItem.findUnique({
      where: { id },
      include: {
        product: { select: { name: true, sku: true, category: true, karat: true, weight: true, finalPrice: true, images: true } },
        shop: { select: { name: true } },
        transfers: {
          orderBy: { createdAt: 'desc' },
          include: {
            fromShop: { select: { name: true } },
            toShop: { select: { name: true } },
            initiator: { select: { name: true, email: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    return item;
  }

  async markSold(id: string, orderId: string, shopId: string) {
    const item = await this.prisma.productItem.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.shopId !== shopId) throw new ForbiddenException('Item does not belong to this shop');
    if (item.status !== 'IN_STOCK') throw new BadRequestException(`Item is ${item.status}, cannot mark as sold`);

    const events = (item.events as any[]) || [];
    return this.prisma.productItem.update({
      where: { id },
      data: {
        status: 'SOLD',
        orderId,
        events: [
          ...events,
          { type: 'SOLD', timestamp: new Date().toISOString(), orderId, shopId },
        ],
      },
    });
  }

  async findBySerial(serialNumber: string) {
    const item = await this.prisma.productItem.findUnique({
      where: { serialNumber },
      include: {
        product: { select: { name: true, sku: true, category: true, karat: true, weight: true, finalPrice: true, images: true } },
        shop: { select: { name: true } },
        transfers: {
          orderBy: { createdAt: 'asc' },
          include: {
            fromShop: { select: { name: true } },
            toShop: { select: { name: true } },
            initiator: { select: { name: true } },
          },
        },
      },
    });
    if (!item) throw new NotFoundException('No item found with that serial number');
    return item;
  }
}
