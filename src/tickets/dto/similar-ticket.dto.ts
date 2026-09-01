import { ApiProperty } from '@nestjs/swagger';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../entities/ticket.entity';

export class SimilarTicketDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'TCK-1002' })
  ticketNumber!: string;

  @ApiProperty({ example: 'Charged twice at checkout' })
  title!: string;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.RESOLVED })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.PAYMENT })
  category!: TicketCategory;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.HIGH })
  priority!: TicketPriority;

  @ApiProperty({
    example: 0.91,
    description: 'Cosine similarity to the source ticket (0 to 1)',
  })
  score!: number;
}

export class SimilarTicketsResponseDto {
  @ApiProperty({ type: [SimilarTicketDto] })
  data!: SimilarTicketDto[];
}
