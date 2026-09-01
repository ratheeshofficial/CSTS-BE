export const TICKET_EMBEDDER = 'TICKET_EMBEDDER';

export interface TicketEmbedder {
  embed(texts: string[]): Promise<number[][]>;
}
