import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private prisma: PrismaService) {}

  async getCart(userId: string) {
    return this.prisma.cartItem.findMany({
      where: { userId },
      include: { product: { include: { shop: { select: { id: true, name: true } } } } },
    });
  }

  async addItem(userId: string, productId: string, quantity: number = 1) {
    return this.prisma.cartItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });
  }

  async updateItem(userId: string, productId: string, quantity: number) {
    if (quantity <= 0) return this.removeItem(userId, productId);
    return this.prisma.cartItem.update({
      where: { userId_productId: { userId, productId } },
      data: { quantity },
    });
  }

  async removeItem(userId: string, productId: string) {
    return this.prisma.cartItem.delete({ where: { userId_productId: { userId, productId } } });
  }

  async clearCart(userId: string) {
    return this.prisma.cartItem.deleteMany({ where: { userId } });
  }
}
