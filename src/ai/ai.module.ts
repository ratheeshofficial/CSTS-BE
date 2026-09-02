import { Module } from '@nestjs/common';
import { GeminiTicketClassifierService } from './gemini-ticket-classifier.service';
import { GeminiTicketEmbedderService } from './gemini-ticket-embedder.service';
import { GeminiTicketReplySuggesterService } from './gemini-ticket-reply-suggester.service';
import { TICKET_CLASSIFIER } from './ticket-classifier';
import { TICKET_EMBEDDER } from './ticket-embedder';
import { TICKET_REPLY_SUGGESTER } from './ticket-reply-suggester';

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
    GeminiTicketReplySuggesterService,
    {
      provide: TICKET_REPLY_SUGGESTER,
      useExisting: GeminiTicketReplySuggesterService,
    },
  ],
  exports: [TICKET_CLASSIFIER, TICKET_EMBEDDER, TICKET_REPLY_SUGGESTER],
})
export class AiModule {}
