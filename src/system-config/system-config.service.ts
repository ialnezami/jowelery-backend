import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../common/cache/cache.service';

const SYSTEM_CONFIG_KEY = 'system_config:main';
const SYSTEM_CONFIG_TTL = 600;

@Injectable()
export class SystemConfigService {
  constructor(
    private prisma: PrismaService,
    private cache: CacheService,
  ) {}

  async get() {
    const cached = await this.cache.get<any>(SYSTEM_CONFIG_KEY);
    if (cached) return cached;

    const config = await this.prisma.systemConfig.findFirst({ where: { key: 'main_config' } });
    if (config) await this.cache.set(SYSTEM_CONFIG_KEY, config, SYSTEM_CONFIG_TTL);
    return config;
  }

  async update(data: any) {
    const existing = await this.prisma.systemConfig.findFirst({ where: { key: 'main_config' } });
    let result: any;
    if (existing) {
      result = await this.prisma.systemConfig.update({ where: { id: existing.id }, data });
    } else {
      result = await this.prisma.systemConfig.create({ data: { key: 'main_config', ...data } });
    }
    await this.cache.del(SYSTEM_CONFIG_KEY);
    return result;
  }
}
