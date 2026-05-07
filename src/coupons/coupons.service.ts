import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    code: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    minOrderAmount?: number;
    maxUses?: number;
    expiresAt?: string;
  }) {
    if (!['PERCENTAGE', 'FIXED'].includes(data.discountType)) {
      throw new BadRequestException('discountType must be PERCENTAGE or FIXED');
    }
    if (data.discountValue <= 0) {
      throw new BadRequestException('discountValue must be positive');
    }
    if (data.discountType === 'PERCENTAGE' && data.discountValue > 100) {
      throw new BadRequestException('Percentage discount cannot exceed 100');
    }

    const code = data.code.toUpperCase().trim();
    const existing = await this.prisma.coupon.findUnique({ where: { code } });
    if (existing) throw new ConflictException('Coupon code already exists');

    return this.prisma.coupon.create({
      data: {
        ...data,
        code,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });
  }

  async findAll(query: { isActive?: string; page?: number; limit?: number }) {
    const { isActive, page = 1, limit = 50 } = query;
    const where: any = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const [coupons, total] = await Promise.all([
      this.prisma.coupon.findMany({
        where,
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.coupon.count({ where }),
    ]);

    return { coupons, total, page: Number(page) };
  }

  async validate(code: string, orderTotal: number): Promise<{
    valid: boolean;
    discountAmount: number;
    coupon?: any;
    error?: string;
  }> {
    const coupon = await this.prisma.coupon.findUnique({
      where: { code: code.toUpperCase().trim() },
    });

    if (!coupon) return { valid: false, discountAmount: 0, error: 'Invalid coupon code' };
    if (!coupon.isActive) return { valid: false, discountAmount: 0, error: 'Coupon is no longer active' };
    if (coupon.expiresAt && new Date() > coupon.expiresAt) {
      return { valid: false, discountAmount: 0, error: 'Coupon has expired' };
    }
    if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) {
      return { valid: false, discountAmount: 0, error: 'Coupon usage limit reached' };
    }
    if (coupon.minOrderAmount && orderTotal < coupon.minOrderAmount) {
      return {
        valid: false,
        discountAmount: 0,
        error: `Minimum order amount is $${coupon.minOrderAmount.toFixed(2)}`,
      };
    }

    const discountAmount =
      coupon.discountType === 'PERCENTAGE'
        ? Math.min((orderTotal * coupon.discountValue) / 100, orderTotal)
        : Math.min(coupon.discountValue, orderTotal);

    return { valid: true, discountAmount: Number(discountAmount.toFixed(2)), coupon };
  }

  async update(id: string, data: Partial<{
    discountValue: number;
    minOrderAmount: number;
    maxUses: number;
    expiresAt: string;
    isActive: boolean;
  }>) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');

    return this.prisma.coupon.update({
      where: { id },
      data: {
        ...data,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      },
    });
  }

  async remove(id: string) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('Coupon not found');
    return this.prisma.coupon.delete({ where: { id } });
  }

  async incrementUsage(code: string) {
    await this.prisma.coupon.update({
      where: { code },
      data: { usedCount: { increment: 1 } },
    });
  }
}
