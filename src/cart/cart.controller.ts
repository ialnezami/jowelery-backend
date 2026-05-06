import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('cart')
@Controller('cart')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CartController {
  constructor(private cart: CartService) {}

  @Get()
  getCart(@CurrentUser() user: any) {
    return this.cart.getCart(user.id);
  }

  @Post()
  addItem(@CurrentUser() user: any, @Body() dto: { productId: string; quantity?: number }) {
    return this.cart.addItem(user.id, dto.productId, dto.quantity);
  }

  @Patch(':productId')
  updateItem(@CurrentUser() user: any, @Param('productId') productId: string, @Body('quantity') quantity: number) {
    return this.cart.updateItem(user.id, productId, quantity);
  }

  @Delete(':productId')
  removeItem(@CurrentUser() user: any, @Param('productId') productId: string) {
    return this.cart.removeItem(user.id, productId);
  }

  @Delete()
  clearCart(@CurrentUser() user: any) {
    return this.cart.clearCart(user.id);
  }
}
