import { GoogleGenAI } from '@google/genai';
import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GeminiTicketEmbedderService } from './gemini-ticket-embedder.service';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

const MockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

describe('GeminiTicketEmbedderService', () => {
  let service: GeminiTicketEmbedderService;
  let configService: { get: jest.Mock };
  let embedContent: jest.Mock;

  beforeEach(async () => {
    embedContent = jest.fn();
    MockedGoogleGenAI.mockReset();
    MockedGoogleGenAI.mockImplementation(
      () =>
        ({
          models: { embedContent },
        }) as unknown as GoogleGenAI,
    );

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'test-key';
        }
        if (key === 'GEMINI_EMBEDDING_MODEL') {
          return 'gemini-embedding-2';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiTicketEmbedderService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(GeminiTicketEmbedderService);
  });

  it('returns embedding vectors from Gemini', async () => {
    embedContent.mockResolvedValue({
      embeddings: [{ values: [0.1, 0.2] }, { values: [0.3, 0.4] }],
    });

    const result = await service.embed(['first', 'second']);

    expect(MockedGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(embedContent).toHaveBeenCalledTimes(1);
    expect(embedContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: [
          { parts: [{ text: 'first' }] },
          { parts: [{ text: 'second' }] },
        ],
      }),
    );
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('throws 502 when the API key is missing', async () => {
    configService.get.mockImplementation(() => undefined);

    await expect(service.embed(['first'])).rejects.toThrow(BadGatewayException);
    await expect(service.embed(['first'])).rejects.toThrow(
      'Embedding service is not configured',
    );
    expect(embedContent).not.toHaveBeenCalled();
  });

  it('throws 502 when Gemini is unavailable', async () => {
    embedContent.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.embed(['first'])).rejects.toThrow(
      'Embedding service is unavailable',
    );
  });

  it('embeds each text separately when Gemini returns a single aggregated vector', async () => {
    embedContent
      .mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2] }],
      })
      .mockResolvedValueOnce({
        embeddings: [{ values: [0.1, 0.2] }],
      })
      .mockResolvedValueOnce({
        embeddings: [{ values: [0.3, 0.4] }],
      });

    const result = await service.embed(['first', 'second']);

    expect(embedContent).toHaveBeenCalledTimes(3);
    expect(result).toEqual([
      [0.1, 0.2],
      [0.3, 0.4],
    ]);
  });

  it('throws 502 when a single-text response has no vector', async () => {
    embedContent.mockResolvedValue({
      embeddings: [],
    });

    await expect(service.embed(['first'])).rejects.toThrow(
      'Embedding service returned invalid vectors',
    );
  });
});
