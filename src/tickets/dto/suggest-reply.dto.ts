import { ApiProperty } from '@nestjs/swagger';

export class SuggestReplyDto {
  @ApiProperty({
    example: 'Sorry about the double charge. We will refund the extra payment.',
  })
  reply!: string;

  @ApiProperty({
    type: [String],
    example: ['3fa85f64-5717-4562-b3fc-2c963f66afa6'],
    description: 'Similar resolved ticket ids used to draft the reply',
  })
  usedTicketIds!: string[];
}
