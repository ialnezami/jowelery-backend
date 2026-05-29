import {
  Injectable,
  ForbiddenException,
  BadRequestException,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';
import { AdminReplyDto } from './dto/admin-reply.dto';

const GUEST_MSG_LIMIT = 3;
const HISTORY_WINDOW = 10;

const SYSTEM_PROMPT = `You are a helpful customer support assistant for Jowelery, a gold jewelry marketplace.

You can help customers with:
- Gold pricing: prices are calculated as (goldRatePerGram × karat_purity × weight) + (makingCharges × weight)
- Karat options: 24K (pure gold, purity 1.0), 22K (0.9167), 21K (0.875), 18K (0.75), 14K (0.5833)
- Product categories: Rings, Necklaces, Bracelets, Earrings, Bars, Coins
- Order status and delivery questions
- Shop information and contact details
- General questions about the platform

Rules:
- Respond in the same language the user writes in (Arabic, English, French, or Urdu)
- Be concise and friendly
- If you cannot answer confidently, say you will connect them with the support team — do NOT fabricate order details, prices, or shop data
- Keep responses under 300 words`;

@Injectable()
export class ChatService {
  private readonly anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  private readonly logger = new Logger(ChatService.name);

  constructor(private prisma: PrismaService) {}

  async sendMessage(dto: SendMessageDto, userId?: string) {
    const { sessionToken, message } = dto;
    const sanitized = message.replace(/<[^>]*>/g, '').trim();

    let session = await this.prisma.chatSession.findUnique({
      where: { sessionToken },
      include: { messages: { orderBy: { createdAt: 'asc' }, take: HISTORY_WINDOW } },
    });

    if (!session) {
      session = await this.prisma.chatSession.create({
        data: { sessionToken, userId: userId ?? null },
        include: { messages: true },
      });
    } else if (!session.userId && userId) {
      session = await this.prisma.chatSession.update({
        where: { id: session.id },
        data: { userId },
        include: { messages: { orderBy: { createdAt: 'asc' }, take: HISTORY_WINDOW } },
      });
    }

    if (session.status === 'CLOSED') {
      throw new BadRequestException('Session is closed');
    }

    if (!session.userId && session.guestMsgCount >= GUEST_MSG_LIMIT) {
      throw new ForbiddenException({ code: 'GUEST_LIMIT', message: 'Guest message limit reached' });
    }

    if (session.status === 'HUMAN') {
      await this.prisma.chatMessage.create({
        data: { sessionId: session.id, role: 'USER', content: sanitized },
      });
      return { reply: 'Your message has been sent to our support agent. They will reply shortly.', isHuman: true };
    }

    if (!session.userId) {
      await this.prisma.chatSession.update({
        where: { id: session.id },
        data: { guestMsgCount: { increment: 1 } },
      });
    }

    const history = session.messages.map((m) => ({
      role: m.role === 'USER' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    }));

    let aiReply: string;
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 512,
        system: SYSTEM_PROMPT,
        messages: [...history, { role: 'user', content: sanitized }],
      });
      aiReply = (response.content[0] as { text: string }).text;
    } catch (err) {
      this.logger.error('Anthropic API error', err);
      throw new BadRequestException('AI service unavailable, please try again');
    }

    await this.prisma.$transaction([
      this.prisma.chatMessage.create({
        data: { sessionId: session.id, role: 'USER', content: sanitized },
      }),
      this.prisma.chatMessage.create({
        data: { sessionId: session.id, role: 'AI', content: aiReply },
      }),
    ]);

    const updatedSession = await this.prisma.chatSession.findUnique({ where: { id: session.id } });

    return {
      reply: aiReply,
      isHuman: false,
      guestMsgCount: updatedSession?.guestMsgCount ?? 0,
    };
  }

  async linkSession(sessionToken: string, userId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { sessionToken } });
    if (!session) return;
    if (session.userId) return;
    await this.prisma.chatSession.update({
      where: { id: session.id },
      data: { userId },
    });
  }

  async getSessions(status?: string) {
    const where: any = {};
    if (status && status !== 'ALL') where.status = status;
    return this.prisma.chatSession.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async getSession(id: string) {
    const session = await this.prisma.chatSession.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!session) throw new NotFoundException('Session not found');
    return session;
  }

  async claimSession(id: string, agentId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'HUMAN') throw new ConflictException('Session already claimed');
    if (session.status === 'CLOSED') throw new BadRequestException('Session is closed');
    return this.prisma.chatSession.update({
      where: { id },
      data: { status: 'HUMAN', agentId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
  }

  async agentReply(id: string, dto: AdminReplyDto, agentId: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'CLOSED') throw new BadRequestException('Session is closed');
    if (session.status !== 'HUMAN') throw new BadRequestException('Claim the session before replying');
    const sanitized = dto.message.replace(/<[^>]*>/g, '').trim();
    return this.prisma.chatMessage.create({
      data: { sessionId: id, role: 'AGENT', content: sanitized },
    });
  }

  async closeSession(id: string) {
    const session = await this.prisma.chatSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status === 'CLOSED') return session;
    return this.prisma.chatSession.update({ where: { id }, data: { status: 'CLOSED' } });
  }
}
