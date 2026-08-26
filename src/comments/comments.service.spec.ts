import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { TicketsService } from '../tickets/tickets.service';
import { UserRole } from '../users/entities/user.entity';
import { Comment } from './entities/comment.entity';
import { CommentsService } from './comments.service';

describe('CommentsService', () => {
  let service: CommentsService;
  let commentsRepository: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
  };
  let ticketsService: jest.Mocked<Pick<TicketsService, 'findOne'>>;

  const author: AuthUser = {
    id: 'customer-1',
    email: 'customer@example.com',
    name: 'Customer',
    role: UserRole.CUSTOMER,
  };

  const otherCustomer: AuthUser = {
    id: 'customer-2',
    email: 'other@example.com',
    name: 'Other',
    role: UserRole.CUSTOMER,
  };

  const agent: AuthUser = {
    id: 'agent-1',
    email: 'agent@example.com',
    name: 'Agent',
    role: UserRole.SUPPORT_AGENT,
  };

  const admin: AuthUser = {
    id: 'admin-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: UserRole.ADMIN,
  };

  const comment: Comment = {
    id: 'comment-1',
    ticketId: 'ticket-1',
    authorId: author.id,
    message: 'Please help',
    createdAt: new Date(),
    updatedAt: new Date(),
    ticket: {} as Comment['ticket'],
    author: {} as Comment['author'],
  };

  beforeEach(async () => {
    commentsRepository = {
      create: jest.fn(),
      save: jest.fn(),
      find: jest.fn(),
      findOne: jest.fn(),
      remove: jest.fn(),
    };
    ticketsService = {
      findOne: jest.fn().mockResolvedValue({ id: 'ticket-1' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentsRepository },
        { provide: TicketsService, useValue: ticketsService },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('checks ticket access then saves the comment', async () => {
      commentsRepository.create.mockReturnValue(comment);
      commentsRepository.save.mockResolvedValue(comment);
      commentsRepository.findOne.mockResolvedValue(comment);

      const result = await service.create(author, 'ticket-1', {
        message: 'Please help',
      });

      expect(ticketsService.findOne).toHaveBeenCalledWith(author, 'ticket-1');
      expect(commentsRepository.create).toHaveBeenCalledWith({
        ticketId: 'ticket-1',
        authorId: author.id,
        message: 'Please help',
      });
      expect(result).toEqual(comment);
    });

    it('propagates ticket access failures', async () => {
      ticketsService.findOne.mockRejectedValue(
        new ForbiddenException('Insufficient permissions'),
      );

      await expect(
        service.create(otherCustomer, 'ticket-1', { message: 'Hi' }),
      ).rejects.toThrow('Insufficient permissions');
    });
  });

  describe('findAll', () => {
    it('checks ticket access and lists comments in createdAt order', async () => {
      commentsRepository.find.mockResolvedValue([comment]);

      await expect(service.findAll(author, 'ticket-1')).resolves.toEqual([
        comment,
      ]);
      expect(ticketsService.findOne).toHaveBeenCalledWith(author, 'ticket-1');
      expect(commentsRepository.find).toHaveBeenCalledWith({
        where: { ticketId: 'ticket-1' },
        relations: { author: true },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('update', () => {
    it('lets the author update their comment', async () => {
      commentsRepository.findOne.mockResolvedValue({ ...comment });
      commentsRepository.save.mockResolvedValue(comment);

      await service.update(author, comment.id, { message: 'Updated' });

      expect(commentsRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ message: 'Updated' }),
      );
    });

    it('lets an admin update any comment', async () => {
      commentsRepository.findOne.mockResolvedValue({ ...comment });
      commentsRepository.save.mockResolvedValue(comment);

      await expect(
        service.update(admin, comment.id, { message: 'Admin edit' }),
      ).resolves.toBeDefined();
    });

    it('forbids a non-author customer from updating', async () => {
      commentsRepository.findOne.mockResolvedValue(comment);

      await expect(
        service.update(otherCustomer, comment.id, { message: 'Nope' }),
      ).rejects.toThrow(ForbiddenException);
      await expect(
        service.update(otherCustomer, comment.id, { message: 'Nope' }),
      ).rejects.toThrow('Insufficient permissions');
    });

    it('forbids a non-author agent from updating', async () => {
      commentsRepository.findOne.mockResolvedValue(comment);

      await expect(
        service.update(agent, comment.id, { message: 'Nope' }),
      ).rejects.toThrow('Insufficient permissions');
    });

    it('throws NotFoundException when the comment is missing', async () => {
      commentsRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update(author, 'missing', { message: 'Nope' }),
      ).rejects.toThrow('Comment not found');
    });
  });

  describe('remove', () => {
    it('lets the author delete their comment', async () => {
      commentsRepository.findOne.mockResolvedValue(comment);

      await service.remove(author, comment.id);

      expect(commentsRepository.remove).toHaveBeenCalledWith(comment);
    });

    it('lets an admin delete any comment', async () => {
      commentsRepository.findOne.mockResolvedValue(comment);

      await service.remove(admin, comment.id);

      expect(commentsRepository.remove).toHaveBeenCalledWith(comment);
    });

    it('forbids unauthorized delete', async () => {
      commentsRepository.findOne.mockResolvedValue(comment);

      await expect(service.remove(agent, comment.id)).rejects.toThrow(
        'Insufficient permissions',
      );
    });
  });
});
