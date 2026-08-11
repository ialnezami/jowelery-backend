import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
import { GoldSaleOffersService } from './gold-sale-offers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateOfferDto } from './dto/create-offer.dto';
import { AssignShopDto } from './dto/assign-shop.dto';
import { QuoteOfferDto } from './dto/quote-offer.dto';
import { RespondOfferDto } from './dto/respond-offer.dto';
import { UpdateOfferStatusDto } from './dto/update-status.dto';

@Controller('gold-sale-offers')
@UseGuards(JwtAuthGuard)
export class GoldSaleOffersController {
  constructor(private readonly service: GoldSaleOffersService) {}

  @Post()
  create(@Request() req: any, @Body() dto: CreateOfferDto) {
    return this.service.create(req.user.id, dto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.service.findAll(req.user.id, req.user.role);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user.id, req.user.role);
  }

  @Patch(':id/assign-shop')
  assignShop(@Param('id') id: string, @Request() req: any, @Body() dto: AssignShopDto) {
    return this.service.assignShop(id, req.user.id, dto);
  }

  @Patch(':id/quote')
  submitQuote(@Param('id') id: string, @Request() req: any, @Body() dto: QuoteOfferDto) {
    return this.service.submitQuote(id, req.user.id, dto);
  }

  @Patch(':id/respond')
  respond(@Param('id') id: string, @Request() req: any, @Body() dto: RespondOfferDto) {
    return this.service.respond(id, req.user.id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateOfferStatusDto) {
    return this.service.updateStatus(id, req.user.id, dto);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @Request() req: any) {
    return this.service.cancel(id, req.user.id);
  }
}
