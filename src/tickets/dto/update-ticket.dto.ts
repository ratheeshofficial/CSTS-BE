import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../entities/ticket.entity';

export class UpdateTicketDto {
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

  @ApiPropertyOptional({
    enum: TicketStatus,
    example: TicketStatus.IN_PROGRESS,
    description: 'Required for support agents and admins.',
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({
    enum: TicketPriority,
    example: TicketPriority.HIGH,
    description: 'Required for support agents and admins.',
  })
  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;

  @ApiPropertyOptional({
    enum: TicketCategory,
    example: TicketCategory.ORDER,
    description: 'Required for support agents and admins.',
  })
  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Required for support agents and admins. Set to a support agent or admin user id, or null to unassign.',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  assignedAgentId?: string | null;
}
