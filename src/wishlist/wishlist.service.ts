import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class WishlistService {
  constructor(private prisma: PrismaService) {}

  async getWishlist(userId: string) {
    return this.prisma.wishlistItem.findMany({
      where: { userId },
      include: { product: { include: { shop: { select: { id: true, name: true } } } } },
    });
  }

  async addItem(userId: string, productId: string) {
    return this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
  }

  async removeItem(userId: string, productId: string) {
    return this.prisma.wishlistItem.delete({ where: { userId_productId: { userId, productId } } });
  }
}
