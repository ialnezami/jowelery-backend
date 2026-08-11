import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { haversineKm } from './haversine';
import { CreateOfferDto } from './dto/create-offer.dto';
import { AssignShopDto } from './dto/assign-shop.dto';
import { QuoteOfferDto } from './dto/quote-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-status.dto';

@Injectable()
export class GoldSaleOffersService {
  constructor(private prisma: PrismaService) {}

  private async getDeduction(): Promise<number> {
    const config = await this.prisma.systemConfig.findFirst({
      where: { key: 'main_config' },
    });
    return config?.goldBuybackDeductionPerGram ?? 2.0;
  }

  private async getGoldRate(karat: string): Promise<number> {
    const row = await this.prisma.goldRate.findFirst({
      where: { karat: karat as any },
      orderBy: { timestamp: 'desc' },
    });
    if (!row) throw new BadRequestException(`No gold rate found for ${karat}`);
    return row.rate;
  }

  async create(clientId: string, dto: CreateOfferDto) {
    const [goldRate, deduction] = await Promise.all([
      this.getGoldRate(dto.karat),
      this.getDeduction(),
    ]);

    const estimatedPrice = Math.max(0, (goldRate - deduction) * dto.weightGrams);

    const offer = await this.prisma.goldSaleOffer.create({
      data: {
        clientId,
        karat: dto.karat as any,
        weightGrams: dto.weightGrams,
        condition: dto.condition,
        images: dto.images,
        estimatedPrice,
        clientLat: dto.clientLat,
        clientLng: dto.clientLng,
        notes: dto.notes,
      },
      include: { client: { select: { id: true, name: true, email: true } } },
    });

    const allShops = await this.prisma.shop.findMany({
      where: { status: 'ACTIVE', lat: { not: null }, lng: { not: null } },
      select: { id: true, name: true, logo: true, city: true, country: true, phone: true, address: true, lat: true, lng: true },
    });

    const nearbyShops = allShops
      .map((s) => ({
        ...s,
        distanceKm: haversineKm(dto.clientLat, dto.clientLng, s.lat!, s.lng!),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return { offer, nearbyShops, estimatedPrice };
  }

  async findAll(userId: string, userRole: string) {
    const where: any = {};
    if (userRole === 'CLIENT') {
      where.clientId = userId;
    } else if (userRole === 'SHOP_ADMIN') {
      const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
      if (!shop) return [];
      where.shopId = shop.id;
    }

    return this.prisma.goldSaleOffer.findMany({
      where,
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        shop: { select: { id: true, name: true, logo: true, address: true, phone: true, city: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, userId: string, userRole: string) {
    const offer = await this.prisma.goldSaleOffer.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true } },
        shop: { select: { id: true, name: true, logo: true, address: true, phone: true, city: true, lat: true, lng: true } },
      },
    });
    if (!offer) throw new NotFoundException('Offer not found');

    if (userRole === 'CLIENT' && offer.clientId !== userId) throw new ForbiddenException();
    if (userRole === 'SHOP_ADMIN') {
      const shop = await this.prisma.shop.findUnique({ where: { adminId: userId } });
      if (!shop || offer.shopId !== shop.id) throw new ForbiddenException();
    }

    return offer;
  }

  async assignShop(id: string, clientId: string, dto: AssignShopDto) {
    const offer = await this.prisma.goldSaleOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.clientId !== clientId) throw new ForbiddenException();
    if (offer.status !== 'PENDING_SHOP') throw new BadRequestException('Offer is not awaiting shop selection');

    const shop = await this.prisma.shop.findUnique({ where: { id: dto.shopId } });
    if (!shop) throw new NotFoundException('Shop not found');

    return this.prisma.goldSaleOffer.update({
      where: { id },
      data: { shopId: dto.shopId, status: 'PENDING_QUOTE' },
    });
  }

  async submitQuote(id: string, adminId: string, dto: QuoteOfferDto) {
    const offer = await this.prisma.goldSaleOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.status !== 'PENDING_QUOTE') throw new BadRequestException('Offer is not awaiting a quote');

    const shop = await this.prisma.shop.findUnique({ where: { adminId } });
    if (!shop || offer.shopId !== shop.id) throw new ForbiddenException();

    return this.prisma.goldSaleOffer.update({
      where: { id },
      data: { shopQuote: dto.shopQuote, status: 'QUOTED' },
    });
  }

  async respond(id: string, clientId: string, dto: RespondOfferDto) {
    const offer = await this.prisma.goldSaleOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.clientId !== clientId) throw new ForbiddenException();
    if (offer.status !== 'QUOTED') throw new BadRequestException('Offer is not in QUOTED status');

    return this.prisma.goldSaleOffer.update({
      where: { id },
      data: { status: dto.accept ? 'ACCEPTED' : 'REJECTED' },
    });
  }

  async updateStatus(id: string, adminId: string, dto: UpdateOfferStatusDto) {
    const offer = await this.prisma.goldSaleOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');

    const shop = await this.prisma.shop.findUnique({ where: { adminId } });
    if (!shop || offer.shopId !== shop.id) throw new ForbiddenException();

    const validTransitions: Record<string, string> = {
      ACCEPTED: 'IN_REVIEW',
      IN_REVIEW: 'PAID',
    };
    if (validTransitions[offer.status] !== dto.status) {
      throw new BadRequestException(`Cannot transition from ${offer.status} to ${dto.status}`);
    }

    return this.prisma.goldSaleOffer.update({ where: { id }, data: { status: dto.status } });
  }

  async cancel(id: string, clientId: string) {
    const offer = await this.prisma.goldSaleOffer.findUnique({ where: { id } });
    if (!offer) throw new NotFoundException('Offer not found');
    if (offer.clientId !== clientId) throw new ForbiddenException();
    if (!['PENDING_SHOP', 'PENDING_QUOTE'].includes(offer.status)) {
      throw new BadRequestException('Offer cannot be cancelled at this stage');
    }

    return this.prisma.goldSaleOffer.update({ where: { id }, data: { status: 'CANCELLED' } });
  }
}
