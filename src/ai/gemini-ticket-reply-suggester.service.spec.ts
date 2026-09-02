import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GoogleGenAI } from '@google/genai';
import { GeminiTicketReplySuggesterService } from './gemini-ticket-reply-suggester.service';
import type { TicketReplySuggestInput } from './ticket-reply-suggester';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

const MockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

describe('GeminiTicketReplySuggesterService', () => {
  let service: GeminiTicketReplySuggesterService;
  let configService: { get: jest.Mock };
  let generateContent: jest.Mock;

  const input: TicketReplySuggestInput = {
    title: 'Charged twice at checkout',
    description: 'I was billed twice for order 1234.',
    similarTickets: [
      {
        id: 'ticket-resolved',
        title: 'Double billed',
        description: 'Two charges on my card. Refund issued.',
      },
    ],
  };

  beforeEach(async () => {
    generateContent = jest.fn();
    MockedGoogleGenAI.mockReset();
    MockedGoogleGenAI.mockImplementation(
      () =>
        ({
          models: { generateContent },
        }) as unknown as GoogleGenAI,
    );

    configService = {
      get: jest.fn((key: string) => {
        if (key === 'GEMINI_API_KEY') {
          return 'test-key';
        }
        if (key === 'GEMINI_MODEL') {
          return 'gemini-3.6-flash';
        }
        return undefined;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeminiTicketReplySuggesterService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(GeminiTicketReplySuggesterService);
  });

  it('returns a draft reply and used ticket ids', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        reply:
          'Sorry about the double charge. We will refund the extra payment.',
        usedTicketIds: ['ticket-resolved'],
      }),
    });

    const result = await service.suggest(input);

    expect(MockedGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      reply: 'Sorry about the double charge. We will refund the extra payment.',
      usedTicketIds: ['ticket-resolved'],
    });
  });

  it('drops usedTicketIds that were not in the similar tickets list', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: 'We can look into this for you.',
        usedTicketIds: ['ticket-resolved', 'invented-id'],
      }),
    });

    await expect(service.suggest(input)).resolves.toEqual({
      reply: 'We can look into this for you.',
      usedTicketIds: ['ticket-resolved'],
    });
  });

  it('throws 502 when the API key is missing', async () => {
    configService.get.mockImplementation(() => undefined);

    await expect(service.suggest(input)).rejects.toThrow(BadGatewayException);
    await expect(service.suggest(input)).rejects.toThrow(
      'Reply service is not configured',
    );
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('throws 502 when Gemini is unavailable', async () => {
    generateContent.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(service.suggest(input)).rejects.toThrow(
      'Reply service is unavailable',
    );
  });

  it('throws 502 when the response is not JSON', async () => {
    generateContent.mockResolvedValue({ text: 'not json' });

    await expect(service.suggest(input)).rejects.toThrow(
      'Reply service returned invalid JSON',
    );
  });

  it('throws 502 when the reply is empty', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        reply: '   ',
        usedTicketIds: [],
      }),
    });

    await expect(service.suggest(input)).rejects.toThrow(
      'Reply service returned invalid JSON',
    );
  });
});
