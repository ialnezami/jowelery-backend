import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RecipientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.recipient.findMany({ where: { userId } });
  }

  async create(userId: string, data: any) {
    if (data.isDefault) {
      await this.prisma.recipient.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.recipient.create({ data: { ...data, userId } });
  }

  async update(id: string, userId: string, data: any) {
    const rec = await this.prisma.recipient.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException();
    if (rec.userId !== userId) throw new ForbiddenException();
    if (data.isDefault) {
      await this.prisma.recipient.updateMany({ where: { userId }, data: { isDefault: false } });
    }
    return this.prisma.recipient.update({ where: { id }, data });
  }

  async remove(id: string, userId: string) {
    const rec = await this.prisma.recipient.findUnique({ where: { id } });
    if (!rec) throw new NotFoundException();
    if (rec.userId !== userId) throw new ForbiddenException();
    return this.prisma.recipient.delete({ where: { id } });
  }
}
