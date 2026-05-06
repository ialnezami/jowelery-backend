import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AddressService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.address.findMany({ where: { userId } });
  }

  async create(userId: string, data: any) {
    if (data.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.create({ data: { ...data, userId } });
  }

  async update(id: string, userId: string, data: any) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr) throw new NotFoundException();
    if (addr.userId !== userId) throw new ForbiddenException();
    if (data.isDefault) {
      await this.prisma.address.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.address.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    const addr = await this.prisma.address.findUnique({ where: { id } });
    if (!addr) throw new NotFoundException();
    if (addr.userId !== userId) throw new ForbiddenException();
    return this.prisma.address.delete({ where: { id } });
  }
}
