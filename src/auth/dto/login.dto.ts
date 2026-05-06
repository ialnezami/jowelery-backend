import { IsEmail, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'client@jowelery.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'base123' })
  @IsString()
  @MinLength(6)
  password: string;
}
