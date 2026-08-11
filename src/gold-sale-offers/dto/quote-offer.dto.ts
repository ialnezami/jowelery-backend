import { IsNumber, Min } from 'class-validator';

export class QuoteOfferDto {
  @IsNumber()
  @Min(0)
  shopQuote: number;
}
