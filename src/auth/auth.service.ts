import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { randomBytes } from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const token = this.signToken(user.id, user.email, user.role);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const hashed = await bcrypt.hash(dto.password, 12);
    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hashed, name: dto.name, phone: dto.phone, role: 'CLIENT' },
    });

    const token = this.signToken(user.id, user.email, user.role);
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }

  async verifyToken(token: string) {
    try {
      const payload = this.jwt.verify(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, name: true, role: true },
      });
      if (!user) throw new UnauthorizedException();
      return { valid: true, user };
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return { message: 'If that email exists, a reset link was sent' };

    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt: new Date(Date.now() + 3600 * 1000) },
    });

    return { message: 'Password reset email sent', token };
  }

  async resetPassword(token: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({ where: { token } });
    if (!record || record.used || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    await this.prisma.user.update({ where: { id: record.userId }, data: { password: hashed } });
    await this.prisma.passwordResetToken.update({ where: { id: record.id }, data: { used: true } });

    return { message: 'Password reset successfully' };
  }

  private signToken(userId: string, email: string, role: string) {
    return this.jwt.sign({ sub: userId, email, role });
  }
}
