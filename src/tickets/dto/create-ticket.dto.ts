import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TicketCategory, TicketPriority } from '../entities/ticket.entity';

export class CreateTicketDto {
  @ApiProperty({ example: 'Payment failed on checkout', minLength: 3 })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example: 'I was charged twice when placing order #1234.',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  description!: string;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.MEDIUM })
  @IsEnum(TicketPriority)
  priority!: TicketPriority;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.PAYMENT })
  @IsEnum(TicketCategory)
  category!: TicketCategory;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required for support agents and admins. Ignored for customers.',
  })
  @IsOptional()
  @IsUUID()
  customerId?: string;
}
