import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: { role?: string; page?: number; limit?: number }) {
    const { role, page = 1, limit = 20 } = query;
    const where: any = {};
    if (role) where.role = role;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        select: { id: true, email: true, name: true, role: true, createdAt: true },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total };
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, role: true, languagePreference: true, currencyPreference: true, createdAt: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, data: any) {
    if (data.password) data.password = await bcrypt.hash(data.password, 12);
    return this.prisma.user.update({
      where: { id },
      data,
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
  }
}
