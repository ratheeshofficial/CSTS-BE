import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CommentAuthorSummaryDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Jane Doe' })
  name!: string;

  @ApiProperty({ example: 'jane@example.com' })
  email!: string;
}

export class CommentResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ format: 'uuid' })
  ticketId!: string;

  @ApiProperty({ format: 'uuid' })
  authorId!: string;

  @ApiPropertyOptional({ type: CommentAuthorSummaryDto })
  author?: CommentAuthorSummaryDto;

  @ApiProperty({
    example: 'I still cannot complete checkout after retrying.',
  })
  message!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}
