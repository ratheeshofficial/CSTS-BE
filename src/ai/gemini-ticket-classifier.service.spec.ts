import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { GoogleGenAI } from '@google/genai';
import {
  TicketCategory,
  TicketPriority,
} from '../tickets/entities/ticket.entity';
import { GeminiTicketClassifierService } from './gemini-ticket-classifier.service';

jest.mock('@google/genai', () => ({
  GoogleGenAI: jest.fn(),
}));

const MockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;

describe('GeminiTicketClassifierService', () => {
  let service: GeminiTicketClassifierService;
  let configService: { get: jest.Mock };
  let generateContent: jest.Mock;

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
        GeminiTicketClassifierService,
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(GeminiTicketClassifierService);
  });

  it('returns parsed category, priority, and reason', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        category: TicketCategory.PAYMENT,
        priority: TicketPriority.HIGH,
        reason: 'Charged twice for the same order.',
      }),
    });

    const result = await service.classify({
      title: 'Payment failed',
      description: 'Charged twice',
    });

    expect(MockedGoogleGenAI).toHaveBeenCalledWith({ apiKey: 'test-key' });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      category: TicketCategory.PAYMENT,
      priority: TicketPriority.HIGH,
      reason: 'Charged twice for the same order.',
    });
  });

  it('throws 502 when the API key is missing', async () => {
    configService.get.mockImplementation(() => undefined);

    await expect(
      service.classify({
        title: 'Payment failed',
        description: 'Charged twice',
      }),
    ).rejects.toThrow(BadGatewayException);
    await expect(
      service.classify({
        title: 'Payment failed',
        description: 'Charged twice',
      }),
    ).rejects.toThrow('Classification service is not configured');
    expect(generateContent).not.toHaveBeenCalled();
  });

  it('throws 502 when Gemini is unavailable', async () => {
    generateContent.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(
      service.classify({
        title: 'Payment failed',
        description: 'Charged twice',
      }),
    ).rejects.toThrow('Classification service is unavailable');
  });

  it('throws 502 when the response is not JSON', async () => {
    generateContent.mockResolvedValue({ text: 'not json' });

    await expect(
      service.classify({
        title: 'Payment failed',
        description: 'Charged twice',
      }),
    ).rejects.toThrow('Classification service returned invalid JSON');
  });

  it('throws 502 when category or priority is not a known enum', async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify({
        category: 'BILLING',
        priority: 'CRITICAL',
        reason: 'Looks urgent',
      }),
    });

    await expect(
      service.classify({
        title: 'Payment failed',
        description: 'Charged twice',
      }),
    ).rejects.toThrow('Classification service returned invalid JSON');
  });
});
