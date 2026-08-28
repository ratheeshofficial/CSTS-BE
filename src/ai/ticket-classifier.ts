import {
  TicketCategory,
  TicketPriority,
} from '../tickets/entities/ticket.entity';

export const TICKET_CLASSIFIER = 'TICKET_CLASSIFIER';

export type TicketClassificationInput = {
  title: string;
  description: string;
};

export type TicketClassificationResult = {
  category: TicketCategory;
  priority: TicketPriority;
  reason: string;
};

export interface TicketClassifier {
  classify(
    input: TicketClassificationInput,
  ): Promise<TicketClassificationResult>;
}
