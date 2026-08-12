import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';

const KARATS = ['K24', 'K22', 'K21', 'K18', 'K14'] as const;
const GOLD_RATES_KEY = 'gold_rates:all';
const GOLD_RATES_TTL = 300;

@Injectable()
export class GoldRatesService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async getCurrent() {
    const cached = await this.cache.get<Record<string, any>>(GOLD_RATES_KEY);
    if (cached) return cached;

    const rates: Record<string, any> = {};
    for (const karat of KARATS) {
      const row = await this.prisma.goldRate.findFirst({
        where: { karat: karat as any },
        orderBy: { timestamp: 'desc' },
      });
      if (row) rates[karat] = row;
    }

    await this.cache.set(GOLD_RATES_KEY, rates, GOLD_RATES_TTL);
    return rates;
  }

  async setRate(karat: string, rate: number, currency: string = 'USD') {
    const result = await this.prisma.goldRate.create({
      data: { karat: karat as any, rate, currency },
    });
    await this.cache.del(GOLD_RATES_KEY);
    return result;
  }

  async getHistory(karat?: string, limit: number = 30) {
    return this.prisma.goldRate.findMany({
      where: karat ? { karat: karat as any } : undefined,
      orderBy: { timestamp: 'desc' },
      take: Number(limit),
    });
  }
}
