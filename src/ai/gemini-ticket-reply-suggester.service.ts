import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type {
  TicketReplySuggestInput,
  TicketReplySuggestResult,
  TicketReplySuggester,
} from './ticket-reply-suggester';

const DEFAULT_MODEL = 'gemini-3.6-flash';

const REPLY_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    usedTicketIds: {
      type: 'array',
      items: { type: 'string' },
    },
  },
  required: ['reply', 'usedTicketIds'],
} as const;

@Injectable()
export class GeminiTicketReplySuggesterService implements TicketReplySuggester {
  private client: GoogleGenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async suggest(
    input: TicketReplySuggestInput,
  ): Promise<TicketReplySuggestResult> {
    const client = this.getClient();
    const model =
      this.configService.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;

    let raw: string | undefined;
    try {
      const response = await client.models.generateContent({
        model,
        contents: this.buildPrompt(input),
        config: {
          temperature: 0.2,
          systemInstruction:
            'You are a support agent drafting a customer reply. Reply with valid JSON only. Use only the given tickets. If none fit, say you are unsure. Never invent order IDs or other customers’ details.',
          responseMimeType: 'application/json',
          responseJsonSchema: REPLY_SCHEMA,
        },
      });
      raw = response.text;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Reply service is unavailable');
    }

    return this.parseResult(raw, input);
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadGatewayException('Reply service is not configured');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  private buildPrompt(input: TicketReplySuggestInput): string {
    console.log('input', input);
    const similarLines =
      input.similarTickets.length === 0
        ? ['None.']
        : input.similarTickets.map(
            (ticket, index) =>
              `${index + 1}. id=${ticket.id} title=${ticket.title} description=${ticket.description}`,
          );

    return [
      'Draft a support reply for this ticket.',
      `Ticket title: ${input.title}`,
      `Ticket description: ${input.description}`,
      'Similar resolved tickets:',
      ...similarLines,
      'If there are no similar tickets, draft a cautious reply and set usedTicketIds to [].',
      'usedTicketIds must be ids from the similar tickets list.',
      'Return JSON only with keys reply and usedTicketIds.',
    ].join('\n');
  }

  private parseResult(
    raw: string | undefined,
    input: TicketReplySuggestInput,
  ): TicketReplySuggestResult {
    if (!raw?.trim()) {
      throw new BadGatewayException('Reply service returned invalid JSON');
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadGatewayException('Reply service returned invalid JSON');
    }

    if (!this.isObject(parsed)) {
      throw new BadGatewayException('Reply service returned invalid JSON');
    }

    const reply = parsed.reply;
    const usedTicketIds = parsed.usedTicketIds;

    if (
      typeof reply !== 'string' ||
      reply.trim().length === 0 ||
      !Array.isArray(usedTicketIds)
    ) {
      throw new BadGatewayException('Reply service returned invalid JSON');
    }

    const allowedIds = new Set(input.similarTickets.map((ticket) => ticket.id));
    const filteredIds = usedTicketIds.filter(
      (id): id is string => typeof id === 'string' && allowedIds.has(id),
    );

    return {
      reply: reply.trim(),
      usedTicketIds: filteredIds,
    };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
