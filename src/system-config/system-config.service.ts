import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SystemConfigService {
  constructor(private prisma: PrismaService) {}

  async get() {
    return this.prisma.systemConfig.findFirst({ where: { key: 'main_config' } });
  }

  async update(data: any) {
    const existing = await this.prisma.systemConfig.findFirst({ where: { key: 'main_config' } });
    if (existing) {
      return this.prisma.systemConfig.update({ where: { id: existing.id }, data });
    }
    return this.prisma.systemConfig.create({ data: { key: 'main_config', ...data } });
  }
}
