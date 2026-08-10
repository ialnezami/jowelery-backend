import { Module } from '@nestjs/common';
import { ItemTransfersService } from './item-transfers.service';
import { ItemTransfersController } from './item-transfers.controller';

@Module({ controllers: [ItemTransfersController], providers: [ItemTransfersService], exports: [ItemTransfersService] })
export class ItemTransfersModule {}
