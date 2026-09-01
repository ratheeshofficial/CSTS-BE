import { GoogleGenAI } from '@google/genai';
import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TicketEmbedder } from './ticket-embedder';

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-2';
const OUTPUT_DIMENSIONALITY = 768;

@Injectable()
export class GeminiTicketEmbedderService implements TicketEmbedder {
  private client: GoogleGenAI | null = null;

  constructor(private readonly configService: ConfigService) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) {
      return [];
    }

    const client = this.getClient();
    const model =
      this.configService.get<string>('GEMINI_EMBEDDING_MODEL')?.trim() ||
      DEFAULT_EMBEDDING_MODEL;

    let embeddings: unknown;
    try {
      const response = await client.models.embedContent({
        model,
        contents: texts.map((text) => ({ parts: [{ text }] })),
        config: {
          taskType: 'SEMANTIC_SIMILARITY',
          outputDimensionality: OUTPUT_DIMENSIONALITY,
        },
      });
      embeddings = response.embeddings;

      if (
        Array.isArray(embeddings) &&
        embeddings.length !== texts.length &&
        texts.length > 1
      ) {
        embeddings = await Promise.all(
          texts.map(async (text) => {
            const single = await client.models.embedContent({
              model,
              contents: text,
              config: {
                taskType: 'SEMANTIC_SIMILARITY',
                outputDimensionality: OUTPUT_DIMENSIONALITY,
              },
            });
            const first = single.embeddings?.[0];
            if (!first) {
              throw new BadGatewayException(
                'Embedding service returned invalid vectors',
              );
            }
            return first;
          }),
        );
      }
    } catch (error) {
      if (error instanceof BadGatewayException) {
        throw error;
      }
      throw new BadGatewayException('Embedding service is unavailable');
    }

    return this.parseEmbeddings(embeddings, texts.length);
  }

  private getClient(): GoogleGenAI {
    const apiKey = this.configService.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) {
      throw new BadGatewayException('Embedding service is not configured');
    }
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey });
    }
    return this.client;
  }

  private parseEmbeddings(
    embeddings: unknown,
    expectedCount: number,
  ): number[][] {
    if (!Array.isArray(embeddings) || embeddings.length !== expectedCount) {
      throw new BadGatewayException(
        'Embedding service returned invalid vectors',
      );
    }

    return embeddings.map((item) => {
      const values = this.isObject(item) ? item.values : undefined;
      if (!this.isNumberArray(values) || values.length === 0) {
        throw new BadGatewayException(
          'Embedding service returned invalid vectors',
        );
      }
      return values;
    });
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private isNumberArray(value: unknown): value is number[] {
    return (
      Array.isArray(value) &&
      value.length > 0 &&
      value.every(
        (entry) => typeof entry === 'number' && Number.isFinite(entry),
      )
    );
  }
}
