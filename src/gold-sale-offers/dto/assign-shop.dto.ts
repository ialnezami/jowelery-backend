import { IsString } from 'class-validator';

export class AssignShopDto {
  @IsString()
  shopId: string;
}
