import { IsEnum } from 'class-validator';

export class UpdateOfferStatusDto {
  @IsEnum(['IN_REVIEW', 'PAID'])
  status: 'IN_REVIEW' | 'PAID';
}
