import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import {
  TicketCategory,
  TicketPriority,
} from '../tickets/entities/ticket.entity';
import type {
  TicketClassificationInput,
  TicketClassificationResult,
  TicketClassifier,
} from './ticket-classifier';

const DEFAULT_MODEL = 'gemini-3.6-flash';

const CATEGORIES = Object.values(TicketCategory);
const PRIORITIES = Object.values(TicketPriority);

const CLASSIFICATION_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    priority: { type: 'string', enum: PRIORITIES },
    reason: { type: 'string' },
  },
  required: ['category', 'priority', 'reason'],
} as const;

@Injectable()
export class GeminiTicketClassifierService implements TicketClassifier {
  private client: GoogleGenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async classify(
    input: TicketClassificationInput,
  ): Promise<TicketClassificationResult> {
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
            'You are a support-ticket classifier. Reply with valid JSON only.',
          responseMimeType: 'application/json',
          responseJsonSchema: CLASSIFICATION_SCHEMA,
        },
      });
      raw = response.text;
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Classification service is unavailable');
    }

    return this.parseResult(raw);
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadGatewayException('Classification service is not configured');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  private buildPrompt(input: TicketClassificationInput): string {
    return [
      'Classify this customer support ticket.',
      `Allowed category: ${CATEGORIES.join(', ')}`,
      `Allowed priority: ${PRIORITIES.join(', ')}`,
      `Ticket title: ${input.title}`,
      `Ticket description: ${input.description}`,
      'Return JSON only with keys category, priority, and reason.',
    ].join('\n');
  }

  private parseResult(raw: string | undefined): TicketClassificationResult {
    if (!raw?.trim()) {
      throw new BadGatewayException(
        'Classification service returned invalid JSON',
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new BadGatewayException(
        'Classification service returned invalid JSON',
      );
    }

    if (!this.isObject(parsed)) {
      throw new BadGatewayException(
        'Classification service returned invalid JSON',
      );
    }

    const category = parsed.category;
    const priority = parsed.priority;
    const reason = parsed.reason;

    if (
      !this.isTicketCategory(category) ||
      !this.isTicketPriority(priority) ||
      typeof reason !== 'string' ||
      reason.trim().length === 0
    ) {
      throw new BadGatewayException(
        'Classification service returned invalid JSON',
      );
    }

    return {
      category,
      priority,
      reason: reason.trim(),
    };
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isTicketCategory(value: unknown): value is TicketCategory {
    return (
      typeof value === 'string' && CATEGORIES.includes(value as TicketCategory)
    );
  }

  private isTicketPriority(value: unknown): value is TicketPriority {
    return (
      typeof value === 'string' && PRIORITIES.includes(value as TicketPriority)
    );
  }
}
