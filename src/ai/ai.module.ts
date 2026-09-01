import { Module } from '@nestjs/common';
import { GeminiTicketClassifierService } from './gemini-ticket-classifier.service';
import { GeminiTicketEmbedderService } from './gemini-ticket-embedder.service';
import { TICKET_CLASSIFIER } from './ticket-classifier';
import { TICKET_EMBEDDER } from './ticket-embedder';

@Module({
  providers: [
    GeminiTicketClassifierService,
    {
      provide: TICKET_CLASSIFIER,
      useExisting: GeminiTicketClassifierService,
    },
    GeminiTicketEmbedderService,
    {
      provide: TICKET_EMBEDDER,
      useExisting: GeminiTicketEmbedderService,
    },
  ],
  exports: [TICKET_CLASSIFIER, TICKET_EMBEDDER],
})
export class AiModule {}
