import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItemTransfersService {
  constructor(private prisma: PrismaService) {}

  private async resolveShopId(userId: string, role: string): Promise<string | null> {
    if (role === 'SUPER_ADMIN') return null;
    const shop = await this.prisma.shop.findFirst({ where: { adminId: userId } });
    if (!shop) throw new ForbiddenException('No shop found for this admin account');
    return shop.id;
  }

  async initiate(dto: {
    itemId: string;
    toShopId: string;
    initiatedBy: string;
    initiatorUserId: string;
    initiatorRole: string;
    notes?: string;
  }) {
    const initiatorShopId = await this.resolveShopId(dto.initiatorUserId, dto.initiatorRole);
    if (!initiatorShopId) throw new ForbiddenException('SUPER_ADMIN must specify fromShopId');

    const item = await this.prisma.productItem.findUnique({ where: { id: dto.itemId } });
    if (!item) throw new NotFoundException('Item not found');
    if (item.shopId !== initiatorShopId) throw new ForbiddenException('Item does not belong to your shop');
    if (item.status !== 'IN_STOCK') throw new BadRequestException(`Item is ${item.status} and cannot be transferred`);

    const toShop = await this.prisma.shop.findUnique({ where: { id: dto.toShopId } });
    if (!toShop) throw new NotFoundException('Destination shop not found');
    if (dto.toShopId === initiatorShopId) throw new BadRequestException('Cannot transfer to the same shop');

    const pendingTransfer = await this.prisma.itemTransfer.findFirst({
      where: { itemId: dto.itemId, status: 'PENDING' },
    });
    if (pendingTransfer) throw new BadRequestException('A transfer is already pending for this item');

    const events = (item.events as any[]) || [];

    const [transfer] = await this.prisma.$transaction([
      this.prisma.itemTransfer.create({
        data: {
          itemId: dto.itemId,
          fromShopId: initiatorShopId,
          toShopId: dto.toShopId,
          initiatedBy: dto.initiatedBy,
          notes: dto.notes,
        },
        include: {
          item: { select: { serialNumber: true } },
          fromShop: { select: { name: true } },
          toShop: { select: { name: true } },
          initiator: { select: { name: true, email: true } },
        },
      }),
      this.prisma.productItem.update({
        where: { id: dto.itemId },
        data: {
          status: 'IN_TRANSIT',
          events: [
            ...events,
            {
              type: 'TRANSFER_INITIATED',
              timestamp: new Date().toISOString(),
              fromShopId: initiatorShopId,
              toShopId: dto.toShopId,
              initiatedBy: dto.initiatedBy,
            },
          ],
        },
      }),
    ]);

    return transfer;
  }

  async confirm(transferId: string, userId: string, userRole: string) {
    const userShopId = await this.resolveShopId(userId, userRole);
    const transfer = await this.prisma.itemTransfer.findUnique({
      where: { id: transferId },
      include: { item: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (userShopId && transfer.toShopId !== userShopId) throw new ForbiddenException('Only the receiving shop can confirm this transfer');
    if (transfer.status !== 'PENDING') throw new BadRequestException(`Transfer is ${transfer.status}`);

    const events = (transfer.item.events as any[]) || [];

    const [updated] = await this.prisma.$transaction([
      this.prisma.itemTransfer.update({
        where: { id: transferId },
        data: { status: 'CONFIRMED', resolvedAt: new Date() },
        include: {
          item: { select: { serialNumber: true } },
          fromShop: { select: { name: true } },
          toShop: { select: { name: true } },
        },
      }),
      this.prisma.productItem.update({
        where: { id: transfer.itemId },
        data: {
          shopId: transfer.toShopId,
          status: 'IN_STOCK',
          events: [
            ...events,
            {
              type: 'TRANSFER_CONFIRMED',
              timestamp: new Date().toISOString(),
              fromShopId: transfer.fromShopId,
              toShopId: transfer.toShopId,
              confirmedBy: userId,
            },
          ],
        },
      }),
    ]);

    return updated;
  }

  async reject(transferId: string, userId: string, userRole: string, notes?: string) {
    const userShopId = await this.resolveShopId(userId, userRole);
    const transfer = await this.prisma.itemTransfer.findUnique({
      where: { id: transferId },
      include: { item: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (userShopId && transfer.toShopId !== userShopId) throw new ForbiddenException('Only the receiving shop can reject this transfer');
    if (transfer.status !== 'PENDING') throw new BadRequestException(`Transfer is ${transfer.status}`);

    const events = (transfer.item.events as any[]) || [];

    const [updated] = await this.prisma.$transaction([
      this.prisma.itemTransfer.update({
        where: { id: transferId },
        data: { status: 'REJECTED', resolvedAt: new Date(), notes: notes ?? transfer.notes },
        include: {
          item: { select: { serialNumber: true } },
          fromShop: { select: { name: true } },
          toShop: { select: { name: true } },
        },
      }),
      this.prisma.productItem.update({
        where: { id: transfer.itemId },
        data: {
          status: 'IN_STOCK',
          events: [
            ...events,
            {
              type: 'TRANSFER_REJECTED',
              timestamp: new Date().toISOString(),
              fromShopId: transfer.fromShopId,
              toShopId: transfer.toShopId,
              rejectedBy: userId,
              notes,
            },
          ],
        },
      }),
    ]);

    return updated;
  }

  async cancel(transferId: string, userId: string, userRole: string) {
    const userShopId = await this.resolveShopId(userId, userRole);
    const transfer = await this.prisma.itemTransfer.findUnique({
      where: { id: transferId },
      include: { item: true },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    if (userShopId && transfer.fromShopId !== userShopId) throw new ForbiddenException('Only the originating shop can cancel this transfer');
    if (transfer.status !== 'PENDING') throw new BadRequestException(`Transfer is ${transfer.status} and cannot be cancelled`);

    const events = (transfer.item.events as any[]) || [];

    const [updated] = await this.prisma.$transaction([
      this.prisma.itemTransfer.update({
        where: { id: transferId },
        data: { status: 'CANCELLED', resolvedAt: new Date() },
        include: {
          item: { select: { serialNumber: true } },
          fromShop: { select: { name: true } },
          toShop: { select: { name: true } },
        },
      }),
      this.prisma.productItem.update({
        where: { id: transfer.itemId },
        data: {
          status: 'IN_STOCK',
          events: [
            ...events,
            {
              type: 'TRANSFER_CANCELLED',
              timestamp: new Date().toISOString(),
              fromShopId: transfer.fromShopId,
              toShopId: transfer.toShopId,
              cancelledBy: userId,
            },
          ],
        },
      }),
    ]);

    return updated;
  }

  async findAll(filters: {
    shopId?: string;
    role: string;
    direction?: 'incoming' | 'outgoing' | 'all';
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { shopId, role, direction = 'all', status, page = 1, limit = 20 } = filters;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status) where.status = status;

    if (role !== 'SUPER_ADMIN' && shopId) {
      if (direction === 'incoming') where.toShopId = shopId;
      else if (direction === 'outgoing') where.fromShopId = shopId;
      else where.OR = [{ fromShopId: shopId }, { toShopId: shopId }];
    } else if (shopId) {
      if (direction === 'incoming') where.toShopId = shopId;
      else if (direction === 'outgoing') where.fromShopId = shopId;
    }

    const [transfers, total] = await Promise.all([
      this.prisma.itemTransfer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          item: { select: { serialNumber: true, status: true, product: { select: { name: true, sku: true, images: true } } } },
          fromShop: { select: { name: true } },
          toShop: { select: { name: true } },
          initiator: { select: { name: true, email: true } },
        },
      }),
      this.prisma.itemTransfer.count({ where }),
    ]);

    return { transfers, total, page, limit };
  }

  async findOne(id: string) {
    const transfer = await this.prisma.itemTransfer.findUnique({
      where: { id },
      include: {
        item: {
          include: {
            product: { select: { name: true, sku: true, category: true, karat: true, weight: true, images: true } },
          },
        },
        fromShop: { select: { name: true } },
        toShop: { select: { name: true } },
        initiator: { select: { name: true, email: true } },
      },
    });
    if (!transfer) throw new NotFoundException('Transfer not found');
    return transfer;
  }
}
