import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WishlistService } from './wishlist.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('wishlist')
@Controller('wishlist')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class WishlistController {
  constructor(private wishlist: WishlistService) {}

  @Get()
  get(@CurrentUser() user: any) {
    return this.wishlist.getWishlist(user.id);
  }

  @Post()
  add(@CurrentUser() user: any, @Body('productId') productId: string) {
    return this.wishlist.addItem(user.id, productId);
  }

  @Delete(':productId')
  remove(@CurrentUser() user: any, @Param('productId') productId: string) {
    return this.wishlist.removeItem(user.id, productId);
  }
}
