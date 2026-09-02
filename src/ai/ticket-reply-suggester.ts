export const TICKET_REPLY_SUGGESTER = 'TICKET_REPLY_SUGGESTER';

export type TicketReplyExample = {
  id: string;
  title: string;
  description: string;
};

export type TicketReplySuggestInput = {
  title: string;
  description: string;
  similarTickets: TicketReplyExample[];
};

export type TicketReplySuggestResult = {
  reply: string;
  usedTicketIds: string[];
};

export interface TicketReplySuggester {
  suggest(input: TicketReplySuggestInput): Promise<TicketReplySuggestResult>;
}
