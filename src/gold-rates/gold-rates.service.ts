import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const KARATS = ['K24', 'K22', 'K21', 'K18', 'K14'] as const;

@Injectable()
export class GoldRatesService {
  constructor(private prisma: PrismaService) {}

  async getCurrent() {
    const rates: Record<string, any> = {};
    for (const karat of KARATS) {
      rates[karat] = await this.prisma.goldRate.findFirst({
        where: { karat: karat as any },
        orderBy: { timestamp: 'desc' },
      });
    }
    return rates;
  }

  async setRate(karat: string, rate: number, currency: string = 'USD') {
    return this.prisma.goldRate.create({ data: { karat: karat as any, rate, currency } });
  }

  async getHistory(karat?: string, limit: number = 30) {
    return this.prisma.goldRate.findMany({
      where: karat ? { karat: karat as any } : undefined,
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
    });
  }
}
