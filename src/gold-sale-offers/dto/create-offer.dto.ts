import { IsEnum, IsNumber, IsString, IsArray, IsOptional, Min, ArrayMaxSize } from 'class-validator';

export class CreateOfferDto {
  @IsEnum(['K24', 'K22', 'K21', 'K18', 'K14'])
  karat: string;

  @IsNumber()
  @Min(0.1)
  weightGrams: number;

  @IsString()
  condition: string;

  @IsArray()
  @ArrayMaxSize(3)
  @IsString({ each: true })
  images: string[];

  @IsNumber()
  clientLat: number;

  @IsNumber()
  clientLng: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
