import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, In } from 'typeorm';
import { TICKET_CLASSIFIER } from '../ai/ticket-classifier';
import type { TicketClassifier } from '../ai/ticket-classifier';
import { TICKET_EMBEDDER } from '../ai/ticket-embedder';
import type { TicketEmbedder } from '../ai/ticket-embedder';
import { TICKET_REPLY_SUGGESTER } from '../ai/ticket-reply-suggester';
import type { TicketReplySuggester } from '../ai/ticket-reply-suggester';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './entities/ticket.entity';
import { TicketsService } from './tickets.service';

describe('TicketsService', () => {
  let service: TicketsService;
  let ticketsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let usersService: jest.Mocked<Pick<UsersService, 'findById'>>;
  let dataSource: { query: jest.Mock };
  let ticketClassifier: jest.Mocked<Pick<TicketClassifier, 'classify'>>;
  let ticketEmbedder: jest.Mocked<Pick<TicketEmbedder, 'embed'>>;
  let ticketReplySuggester: jest.Mocked<Pick<TicketReplySuggester, 'suggest'>>;
  let queryBuilder: {
    leftJoinAndSelect: jest.Mock;
    orderBy: jest.Mock;
    andWhere: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
    getMany: jest.Mock;
  };

  const customerUser: AuthUser = {
    id: 'customer-1',
    email: 'customer@example.com',
    name: 'Customer',
    role: UserRole.CUSTOMER,
  };

  const agentUser: AuthUser = {
    id: 'agent-1',
    email: 'agent@example.com',
    name: 'Agent',
    role: UserRole.SUPPORT_AGENT,
  };

  const adminUser: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: UserRole.ADMIN,
  };

  const customerEntity: User = {
    id: 'customer-1',
    name: 'Customer',
    email: 'customer@example.com',
    passwordHash: 'hash',
    role: UserRole.CUSTOMER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdTickets: [],
    assignedTickets: [],
    comments: [],
  };

  const ticket: Ticket = {
    id: 'ticket-1',
    ticketNumber: 'TCK-1001',
    title: 'Payment failed',
    description: 'Charged twice',
    status: TicketStatus.OPEN,
    priority: TicketPriority.HIGH,
    category: TicketCategory.PAYMENT,
    customerId: 'customer-1',
    assignedAgentId: null,
    customer: customerEntity,
    assignedAgent: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
    comments: [],
  };

  beforeEach(async () => {
    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[ticket], 1]),
      getMany: jest.fn().mockResolvedValue([]),
    };

    ticketsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      remove: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
    };
    usersService = { findById: jest.fn() };
    dataSource = { query: jest.fn() };
    ticketClassifier = {
      classify: jest.fn(),
    };
    ticketEmbedder = {
      embed: jest.fn(),
    };
    ticketReplySuggester = {
      suggest: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TicketsService,
        { provide: getRepositoryToken(Ticket), useValue: ticketsRepository },
        { provide: UsersService, useValue: usersService },
        { provide: DataSource, useValue: dataSource },
        { provide: TICKET_CLASSIFIER, useValue: ticketClassifier },
        { provide: TICKET_EMBEDDER, useValue: ticketEmbedder },
        { provide: TICKET_REPLY_SUGGESTER, useValue: ticketReplySuggester },
      ],
    }).compile();

    service = module.get(TicketsService);
  });

  describe('create', () => {
    const dto = {
      title: 'Payment failed',
      description: 'Charged twice',
      priority: TicketPriority.HIGH,
      category: TicketCategory.PAYMENT,
      customerId: 'someone-else',
    };

    it('uses the authenticated customer id and ignores body customerId', async () => {
      dataSource.query.mockResolvedValue([{ n: 1001 }]);
      ticketsRepository.create.mockReturnValue(ticket);
      ticketsRepository.save.mockResolvedValue(ticket);
      ticketsRepository.findOne.mockResolvedValue(ticket);

      const result = await service.create(customerUser, dto);

      expect(ticketsRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: customerUser.id,
          status: TicketStatus.OPEN,
          ticketNumber: 'TCK-1001',
          assignedAgentId: null,
        }),
      );
      expect(usersService.findById).not.toHaveBeenCalled();
      expect(result).toEqual(ticket);
    });

    it('requires customerId when a support agent creates a ticket', async () => {
      await expect(
        service.create(agentUser, {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
        }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.create(agentUser, {
          title: dto.title,
          description: dto.description,
          priority: dto.priority,
          category: dto.category,
        }),
      ).rejects.toThrow(
        'customerId is required when creating a ticket for a customer',
      );
    });

    it('rejects customerId that is not a customer', async () => {
      usersService.findById.mockResolvedValue({
        ...customerEntity,
        id: 'agent-1',
        role: UserRole.SUPPORT_AGENT,
      });

      await expect(
        service.create(adminUser, { ...dto, customerId: 'agent-1' }),
      ).rejects.toThrow('customerId must belong to a customer');
    });
  });

  describe('findAll', () => {
    it('scopes the query to the customer and applies pagination defaults', async () => {
      const result = await service.findAll(customerUser, {});

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'ticket.customerId = :userId',
        { userId: customerUser.id },
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(10);
      expect(result.meta).toEqual({
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });
    });

    it('does not scope staff queries and applies filters and search', async () => {
      await service.findAll(agentUser, {
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        category: TicketCategory.PAYMENT,
        assignedAgentId: 'agent-1',
        search: '  checkout  ',
        page: 2,
        limit: 5,
      });

      expect(queryBuilder.andWhere).not.toHaveBeenCalledWith(
        'ticket.customerId = :userId',
        expect.anything(),
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'ticket.status = :status',
        { status: TicketStatus.OPEN },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        '(ticket.title ILIKE :search OR ticket.description ILIKE :search)',
        { search: '%checkout%' },
      );
      expect(queryBuilder.skip).toHaveBeenCalledWith(5);
      expect(queryBuilder.take).toHaveBeenCalledWith(5);
    });
  });

  describe('findOne', () => {
    it('returns the ticket when the customer owns it', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);

      await expect(service.findOne(customerUser, ticket.id)).resolves.toEqual(
        ticket,
      );
    });

    it('throws NotFoundException when the ticket is missing', async () => {
      ticketsRepository.findOne.mockResolvedValue(null);

      await expect(service.findOne(customerUser, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.findOne(customerUser, 'missing')).rejects.toThrow(
        'Ticket not found',
      );
    });

    it('throws ForbiddenException when a customer reads another customer ticket', async () => {
      ticketsRepository.findOne.mockResolvedValue({
        ...ticket,
        customerId: 'other-customer',
      });

      await expect(service.findOne(customerUser, ticket.id)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.findOne(customerUser, ticket.id)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });

  describe('suggestClassification', () => {
    const suggestion = {
      category: TicketCategory.PAYMENT,
      priority: TicketPriority.HIGH,
      reason: 'Customer was charged twice.',
    };

    it('returns a suggestion without saving the ticket', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketClassifier.classify.mockResolvedValue(suggestion);

      const result = await service.suggestClassification(agentUser, ticket.id);

      expect(ticketClassifier.classify).toHaveBeenCalledWith({
        title: ticket.title,
        description: ticket.description,
      });
      expect(ticketsRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(suggestion);
    });

    it('throws NotFoundException when the ticket is missing', async () => {
      ticketsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.suggestClassification(agentUser, 'missing'),
      ).rejects.toThrow(NotFoundException);
      expect(ticketClassifier.classify).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a customer classifies another customer ticket', async () => {
      ticketsRepository.findOne.mockResolvedValue({
        ...ticket,
        customerId: 'other-customer',
      });

      await expect(
        service.suggestClassification(customerUser, ticket.id),
      ).rejects.toThrow(ForbiddenException);
      expect(ticketClassifier.classify).not.toHaveBeenCalled();
    });

    it('maps classifier failures to BadGatewayException', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketClassifier.classify.mockRejectedValue(new Error('network down'));

      await expect(
        service.suggestClassification(agentUser, ticket.id),
      ).rejects.toThrow(BadGatewayException);
      await expect(
        service.suggestClassification(agentUser, ticket.id),
      ).rejects.toThrow('Classification service is unavailable');
      expect(ticketsRepository.save).not.toHaveBeenCalled();
    });

    it('rethrows BadGatewayException from the classifier', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketClassifier.classify.mockRejectedValue(
        new BadGatewayException('Classification service returned invalid JSON'),
      );

      await expect(
        service.suggestClassification(agentUser, ticket.id),
      ).rejects.toThrow('Classification service returned invalid JSON');
    });
  });

  describe('findSimilar', () => {
    const peerHigh: Ticket = {
      ...ticket,
      id: 'ticket-2',
      ticketNumber: 'TCK-1002',
      title: 'Double billed',
      description: 'Two charges on my card',
    };

    const peerLow: Ticket = {
      ...ticket,
      id: 'ticket-3',
      ticketNumber: 'TCK-1003',
      title: 'App crash',
      description: 'The app closes on login',
      category: TicketCategory.TECHNICAL,
    };

    it('ranks peers by cosine similarity without saving', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([peerLow, peerHigh]);
      ticketEmbedder.embed.mockResolvedValue([
        [1, 0],
        [0, 1],
        [1, 0],
      ]);

      const result = await service.findSimilar(agentUser, ticket.id, 5);

      expect(ticketsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { createdAt: 'DESC' },
          take: 50,
        }),
      );
      expect(ticketEmbedder.embed).toHaveBeenCalledWith([
        'Payment failed\nCharged twice',
        'App crash\nThe app closes on login',
        'Double billed\nTwo charges on my card',
      ]);
      expect(ticketsRepository.save).not.toHaveBeenCalled();
      expect(result.data.map((item) => item.id)).toEqual([
        peerHigh.id,
        peerLow.id,
      ]);
      expect(result.data[0].score).toBe(1);
      expect(result.data[1].score).toBe(0);
    });

    it('returns an empty list and skips embedding when there are no peers', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([]);

      await expect(service.findSimilar(agentUser, ticket.id)).resolves.toEqual({
        data: [],
      });
      expect(ticketEmbedder.embed).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the ticket is missing', async () => {
      ticketsRepository.findOne.mockResolvedValue(null);

      await expect(service.findSimilar(agentUser, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(ticketEmbedder.embed).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a customer reads another customer ticket', async () => {
      ticketsRepository.findOne.mockResolvedValue({
        ...ticket,
        customerId: 'other-customer',
      });

      await expect(
        service.findSimilar(customerUser, ticket.id),
      ).rejects.toThrow(ForbiddenException);
      expect(ticketEmbedder.embed).not.toHaveBeenCalled();
    });

    it('scopes customer peer search to their own tickets', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([]);

      await service.findSimilar(customerUser, ticket.id);

      expect(ticketsRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            customerId: customerUser.id,
          }),
        }),
      );
    });

    it('maps embedder failures to BadGatewayException', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([peerHigh]);
      ticketEmbedder.embed.mockRejectedValue(new Error('network down'));

      await expect(service.findSimilar(agentUser, ticket.id)).rejects.toThrow(
        BadGatewayException,
      );
      await expect(service.findSimilar(agentUser, ticket.id)).rejects.toThrow(
        'Embedding service is unavailable',
      );
      expect(ticketsRepository.save).not.toHaveBeenCalled();
    });
  });

  describe('suggestReply', () => {
    const resolvedPeer: Ticket = {
      ...ticket,
      id: 'ticket-resolved',
      ticketNumber: 'TCK-1002',
      title: 'Double billed',
      description: 'Two charges on my card. Refund issued.',
      status: TicketStatus.RESOLVED,
    };

    const closedPeer: Ticket = {
      ...ticket,
      id: 'ticket-closed',
      ticketNumber: 'TCK-1003',
      title: 'App crash',
      description: 'The app closes on login',
      status: TicketStatus.CLOSED,
      category: TicketCategory.TECHNICAL,
    };

    const suggestion = {
      reply: 'Sorry about the double charge. We will refund the extra payment.',
      usedTicketIds: [resolvedPeer.id],
    };

    it('drafts a reply from resolved peers without saving', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([closedPeer, resolvedPeer]);
      ticketEmbedder.embed.mockResolvedValue([
        [1, 0],
        [0, 1],
        [1, 0],
      ]);
      ticketReplySuggester.suggest.mockResolvedValue(suggestion);

      const result = await service.suggestReply(agentUser, ticket.id);

      const [[findCall]] = ticketsRepository.find.mock.calls as [
        [{ where: { status?: unknown } }],
      ];
      expect(findCall.where.status).toEqual(
        In([TicketStatus.RESOLVED, TicketStatus.CLOSED]),
      );
      expect(ticketReplySuggester.suggest).toHaveBeenCalledWith({
        title: ticket.title,
        description: ticket.description,
        similarTickets: [
          {
            id: resolvedPeer.id,
            title: resolvedPeer.title,
            description: resolvedPeer.description,
          },
          {
            id: closedPeer.id,
            title: closedPeer.title,
            description: closedPeer.description,
          },
        ],
      });
      expect(ticketsRepository.save).not.toHaveBeenCalled();
      expect(result).toEqual(suggestion);
    });

    it('still suggests a reply when there are no resolved peers', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([]);
      ticketReplySuggester.suggest.mockResolvedValue({
        reply: 'I am not sure we have seen this before. We will look into it.',
        usedTicketIds: [],
      });

      const result = await service.suggestReply(agentUser, ticket.id);

      expect(ticketEmbedder.embed).not.toHaveBeenCalled();
      expect(ticketReplySuggester.suggest).toHaveBeenCalledWith({
        title: ticket.title,
        description: ticket.description,
        similarTickets: [],
      });
      expect(result.usedTicketIds).toEqual([]);
    });

    it('throws NotFoundException when the ticket is missing', async () => {
      ticketsRepository.findOne.mockResolvedValue(null);

      await expect(service.suggestReply(agentUser, 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(ticketReplySuggester.suggest).not.toHaveBeenCalled();
    });

    it('throws ForbiddenException when a customer drafts another customer ticket', async () => {
      ticketsRepository.findOne.mockResolvedValue({
        ...ticket,
        customerId: 'other-customer',
      });

      await expect(
        service.suggestReply(customerUser, ticket.id),
      ).rejects.toThrow(ForbiddenException);
      expect(ticketReplySuggester.suggest).not.toHaveBeenCalled();
    });

    it('maps suggester failures to BadGatewayException', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([]);
      ticketReplySuggester.suggest.mockRejectedValue(new Error('network down'));

      await expect(service.suggestReply(agentUser, ticket.id)).rejects.toThrow(
        BadGatewayException,
      );
      await expect(service.suggestReply(agentUser, ticket.id)).rejects.toThrow(
        'Reply service is unavailable',
      );
      expect(ticketsRepository.save).not.toHaveBeenCalled();
    });

    it('rethrows BadGatewayException from the suggester', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);
      ticketsRepository.find.mockResolvedValue([]);
      ticketReplySuggester.suggest.mockRejectedValue(
        new BadGatewayException('Reply service returned invalid JSON'),
      );

      await expect(service.suggestReply(agentUser, ticket.id)).rejects.toThrow(
        'Reply service returned invalid JSON',
      );
    });
  });

  describe('update', () => {
    it('lets a customer replace title and description', async () => {
      ticketsRepository.findOne.mockResolvedValue({ ...ticket });
      ticketsRepository.save.mockResolvedValue(ticket);

      await service.update(customerUser, ticket.id, {
        title: 'Updated title',
        description: 'Updated description',
      });

      expect(ticketsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Updated title',
          description: 'Updated description',
        }),
      );
    });

    it('forbids a customer from setting staff-only fields', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);

      await expect(
        service.update(customerUser, ticket.id, {
          title: 'Updated title',
          description: 'Updated description',
          status: TicketStatus.CLOSED,
        }),
      ).rejects.toThrow('Insufficient permissions');
    });

    it('requires staff to send status, priority, category, and assignedAgentId', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);

      await expect(
        service.update(agentUser, ticket.id, {
          title: 'Updated title',
          description: 'Updated description',
        }),
      ).rejects.toThrow(
        'status, priority, category, and assignedAgentId are required',
      );
    });

    it('sets resolvedAt when staff moves a ticket to RESOLVED', async () => {
      ticketsRepository.findOne.mockResolvedValue({
        ...ticket,
        resolvedAt: null,
      });
      ticketsRepository.save.mockImplementation(async (value) => value);
      usersService.findById.mockResolvedValue({
        ...customerEntity,
        id: agentUser.id,
        role: UserRole.SUPPORT_AGENT,
      });

      await service.update(agentUser, ticket.id, {
        title: ticket.title,
        description: ticket.description,
        status: TicketStatus.RESOLVED,
        priority: TicketPriority.HIGH,
        category: TicketCategory.PAYMENT,
        assignedAgentId: agentUser.id,
      });

      expect(ticketsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TicketStatus.RESOLVED,
          resolvedAt: expect.any(Date),
        }),
      );
    });
  });

  describe('remove', () => {
    it('removes an existing ticket', async () => {
      ticketsRepository.findOne.mockResolvedValue(ticket);

      await service.remove(ticket.id);

      expect(ticketsRepository.remove).toHaveBeenCalledWith(ticket);
    });

    it('throws NotFoundException when the ticket is missing', async () => {
      ticketsRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('missing')).rejects.toThrow(
        'Ticket not found',
      );
    });
  });
});
