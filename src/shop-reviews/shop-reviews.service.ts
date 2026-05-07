import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ShopReviewsService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, data: { shopId: string; rating: number; comment: string }) {
    const { shopId, rating, comment } = data;

    if (rating < 1 || rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    if (!comment?.trim()) {
      throw new BadRequestException('Comment is required');
    }

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    // Only users with a DELIVERED or COMPLETED order from this shop may review
    const eligibleOrder = await this.prisma.order.findFirst({
      where: { userId, shopId, status: { in: ['DELIVERED', 'COMPLETED'] } },
    });
    if (!eligibleOrder) {
      throw new ForbiddenException('You must have a delivered or completed order from this shop to leave a review');
    }

    const existing = await this.prisma.shopReview.findUnique({
      where: { userId_shopId: { userId, shopId } },
    });
    if (existing) throw new ConflictException('You have already reviewed this shop');

    return this.prisma.shopReview.create({
      data: { userId, shopId, rating, comment: comment.trim() },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async findByShop(shopId: string, query: { page?: number; limit?: number }) {
    const { page = 1, limit = 20 } = query;

    const shop = await this.prisma.shop.findUnique({ where: { id: shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    const [reviews, total, aggregation, distribution] = await Promise.all([
      this.prisma.shopReview.findMany({
        where: { shopId },
        include: { user: { select: { id: true, name: true } } },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.shopReview.count({ where: { shopId } }),
      this.prisma.shopReview.aggregate({
        where: { shopId },
        _avg: { rating: true },
      }),
      this.prisma.shopReview.groupBy({
        by: ['rating'],
        where: { shopId },
        _count: { rating: true },
      }),
    ]);

    const dist: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    distribution.forEach((d) => {
      dist[d.rating] = d._count.rating;
    });

    return {
      reviews,
      total,
      page: Number(page),
      averageRating: aggregation._avg.rating ? Number(aggregation._avg.rating.toFixed(1)) : 0,
      distribution: dist,
    };
  }

  async findMyReview(userId: string, shopId: string) {
    return this.prisma.shopReview.findUnique({
      where: { userId_shopId: { userId, shopId } },
    });
  }

  async update(
    id: string,
    userId: string,
    userRole: string,
    data: { rating?: number; comment?: string },
  ) {
    const review = await this.prisma.shopReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId && userRole !== 'SUPER_ADMIN') throw new ForbiddenException();

    if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }
    if (data.comment !== undefined && !data.comment.trim()) {
      throw new BadRequestException('Comment cannot be empty');
    }

    return this.prisma.shopReview.update({
      where: { id },
      data: {
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.comment !== undefined && { comment: data.comment.trim() }),
      },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async remove(id: string, userId: string, userRole: string) {
    const review = await this.prisma.shopReview.findUnique({ where: { id } });
    if (!review) throw new NotFoundException('Review not found');
    if (review.userId !== userId && userRole !== 'SUPER_ADMIN') throw new ForbiddenException();
    return this.prisma.shopReview.delete({ where: { id } });
  }
}
