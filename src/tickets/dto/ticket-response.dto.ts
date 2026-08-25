import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../entities/ticket.entity';

export class TicketUserSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;
}

export class TicketResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'TCK-1001' })
  ticketNumber!: string;

  @ApiProperty({ example: 'Payment failed on checkout' })
  title!: string;

  @ApiProperty()
  description!: string;

  @ApiProperty({ enum: TicketStatus, example: TicketStatus.OPEN })
  status!: TicketStatus;

  @ApiProperty({ enum: TicketPriority, example: TicketPriority.MEDIUM })
  priority!: TicketPriority;

  @ApiProperty({ enum: TicketCategory, example: TicketCategory.PAYMENT })
  category!: TicketCategory;

  @ApiProperty({ format: 'uuid' })
  customerId!: string;

  @ApiPropertyOptional({ type: TicketUserSummaryDto })
  customer?: TicketUserSummaryDto;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  assignedAgentId!: string | null;

  @ApiPropertyOptional({ type: TicketUserSummaryDto, nullable: true })
  assignedAgent?: TicketUserSummaryDto | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;

  @ApiPropertyOptional({ nullable: true })
  resolvedAt!: Date | null;
}

export class PaginationMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({ example: 0 })
  total!: number;

  @ApiProperty({ example: 0 })
  totalPages!: number;
}

export class PaginatedTicketsDto {
  @ApiProperty({ type: [TicketResponseDto] })
  data!: TicketResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
