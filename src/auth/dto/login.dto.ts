import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'ratheesh@yopmail.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123@asAS', format: 'password' })
  @IsString()
  @MinLength(1)
  password!: string;
}
