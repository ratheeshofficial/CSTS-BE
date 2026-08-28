import { Module } from '@nestjs/common';
import { GeminiTicketClassifierService } from './gemini-ticket-classifier.service';
import { TICKET_CLASSIFIER } from './ticket-classifier';

@Module({
  providers: [
    GeminiTicketClassifierService,
    {
      provide: TICKET_CLASSIFIER,
      useExisting: GeminiTicketClassifierService,
    },
  ],
  exports: [TICKET_CLASSIFIER],
})
export class AiModule {}
