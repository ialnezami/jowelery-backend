import { IsString, IsNumber, IsEnum, IsOptional, IsArray, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateProductDto {
  @ApiProperty()
  @IsString()
  shopId: string;

  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty({ required: false })
  @IsOptional()
  nameTranslations?: { en?: string; ar?: string };

  @ApiProperty({ enum: ['RINGS', 'NECKLACES', 'BRACELETS', 'EARRINGS', 'BARS', 'COINS'] })
  @IsEnum(['RINGS', 'NECKLACES', 'BRACELETS', 'EARRINGS', 'BARS', 'COINS'])
  category: string;

  @ApiProperty({ enum: ['K24', 'K22', 'K21', 'K18', 'K14'] })
  @IsEnum(['K24', 'K22', 'K21', 'K18', 'K14'])
  karat: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  weight: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  makingCharges: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  descriptionTranslations?: { en?: string; ar?: string };

  @ApiProperty({ required: false, default: 0 })
  @IsOptional()
  @IsNumber()
  stockQuantity?: number;

  @ApiProperty()
  @IsString()
  sku: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  images?: string[];
}
