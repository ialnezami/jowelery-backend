import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ShopReviewsService } from './shop-reviews.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('shop-reviews')
@Controller('shop-reviews')
export class ShopReviewsController {
  constructor(private service: ShopReviewsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(
    @CurrentUser() user: any,
    @Body() body: { shopId: string; rating: number; comment: string },
  ) {
    return this.service.create(user.id, body);
  }

  @Get('shop/:shopId')
  findByShop(@Param('shopId') shopId: string, @Query() query: any) {
    return this.service.findByShop(shopId, query);
  }

  @Get('my-review/:shopId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findMyReview(@Param('shopId') shopId: string, @CurrentUser() user: any) {
    return this.service.findMyReview(user.id, shopId);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  update(
    @Param('id') id: string,
    @Body() body: { rating?: number; comment?: string },
    @CurrentUser() user: any,
  ) {
    return this.service.update(id, user.id, user.role, body);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.remove(id, user.id, user.role);
  }
}
