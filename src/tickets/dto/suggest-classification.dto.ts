import { ApiProperty } from '@nestjs/swagger';
import { TicketCategory, TicketPriority } from '../entities/ticket.entity';

export class SuggestClassificationDto {
  @ApiProperty({ enum: TicketCategory, example: TicketCategory.PAYMENT })
  category!: TicketCategory;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  priority!: TicketPriority;

  @ApiProperty({
    example: 'Customer was charged twice for the same order.',
  })
  reason!: string;
}
