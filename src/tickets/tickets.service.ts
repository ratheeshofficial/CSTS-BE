import {
  BadGatewayException,
  BadRequestException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
import { cosineSimilarity } from '../ai/cosine-similarity';
import {
  TICKET_CLASSIFIER,
  type TicketClassificationResult,
  type TicketClassifier,
} from '../ai/ticket-classifier';
import { TICKET_EMBEDDER, type TicketEmbedder } from '../ai/ticket-embedder';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { SimilarTicketsResponseDto } from './dto/similar-ticket.dto';
import { User, UserRole } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { QueryTicketsDto } from './dto/query-tickets.dto';
import { UpdateTicketDto } from './dto/update-ticket.dto';
import {
  Ticket,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from './entities/ticket.entity';

const TICKET_RELATIONS = {
  customer: true,
  assignedAgent: true,
} as const;

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.OPEN,
  TicketStatus.ASSIGNED,
  TicketStatus.IN_PROGRESS,
];

const RESOLVED_STATUSES: TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

const SIMILAR_CANDIDATE_CAP = 50;

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket)
    private readonly ticketsRepository: Repository<Ticket>,
    private readonly usersService: UsersService,
    private readonly dataSource: DataSource,
    @Inject(TICKET_CLASSIFIER)
    private readonly ticketClassifier: TicketClassifier,
    @Inject(TICKET_EMBEDDER)
    private readonly ticketEmbedder: TicketEmbedder,
  ) {}

  async create(user: AuthUser, dto: CreateTicketDto) {
    const customerId = await this.resolveCustomerId(user, dto.customerId);
    const ticketNumber = await this.nextTicketNumber();

    const ticket = this.ticketsRepository.create({
      ticketNumber,
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      category: dto.category,
      status: TicketStatus.OPEN,
      customerId,
      assignedAgentId: null,
      resolvedAt: null,
    });

    const saved = await this.ticketsRepository.save(ticket);
    return this.findOneOrFail(saved.id);
  }

  async findAll(user: AuthUser, query: QueryTicketsDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const qb = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.customer', 'customer')
      .leftJoinAndSelect('ticket.assignedAgent', 'assignedAgent')
      .orderBy('ticket.createdAt', 'DESC');

    if (user.role === UserRole.CUSTOMER) {
      qb.andWhere('ticket.customerId = :userId', { userId: user.id });
    }

    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }

    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    }

    if (query.category) {
      qb.andWhere('ticket.category = :category', { category: query.category });
    }

    if (query.assignedAgentId) {
      qb.andWhere('ticket.assignedAgentId = :assignedAgentId', {
        assignedAgentId: query.assignedAgentId,
      });
    }

    const search = query.search?.trim();
    if (search) {
      qb.andWhere(
        '(ticket.title ILIKE :search OR ticket.description ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    qb.skip((page - 1) * limit).take(limit);

    const [data, total] = await qb.getManyAndCount();

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  async findOne(user: AuthUser, id: string): Promise<Ticket> {
    const ticket = await this.findOneOrFail(id);
    this.assertCustomerAccess(user, ticket);
    return ticket;
  }

  async suggestClassification(
    user: AuthUser,
    id: string,
  ): Promise<TicketClassificationResult> {
    const ticket = await this.findOne(user, id);

    try {
      return await this.ticketClassifier.classify({
        title: ticket.title,
        description: ticket.description,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException('Classification service is unavailable');
    }
  }

  async findSimilar(
    user: AuthUser,
    id: string,
    limit = 5,
  ): Promise<SimilarTicketsResponseDto> {
    const ticket = await this.findOne(user, id);
    const candidates = await this.findSimilarCandidates(user, ticket.id);
    if (candidates.length === 0) {
      return { data: [] };
    }

    let vectors: number[][];
    try {
      vectors = await this.ticketEmbedder.embed([
        this.toEmbeddingText(ticket),
        ...candidates.map((candidate) => this.toEmbeddingText(candidate)),
      ]);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new BadGatewayException('Embedding service is unavailable');
    }

    if (vectors.length !== candidates.length + 1) {
      throw new BadGatewayException(
        'Embedding service returned invalid vectors',
      );
    }

    const [sourceVector, ...candidateVectors] = vectors;
    const ranked = candidates
      .map((candidate, index) => ({
        id: candidate.id,
        ticketNumber: candidate.ticketNumber,
        title: candidate.title,
        status: candidate.status,
        category: candidate.category,
        priority: candidate.priority,
        score: this.roundScore(
          cosineSimilarity(sourceVector, candidateVectors[index]),
        ),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, limit);

    return { data: ranked };
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateTicketDto,
  ): Promise<Ticket> {
    const ticket = await this.findOneOrFail(id);
    this.assertCustomerAccess(user, ticket);
    if (user.role === UserRole.CUSTOMER) {
      this.assertCustomerReplaceBody(dto);
      ticket.title = dto.title;
      ticket.description = dto.description;
    } else {
      this.assertStaffReplaceBody(dto);
      await this.assertAssignableAgent(dto.assignedAgentId ?? null);
      this.applyResolvedAt(ticket, dto.status);
      ticket.title = dto.title;
      ticket.description = dto.description;
      ticket.status = dto.status;
      ticket.priority = dto.priority;
      ticket.category = dto.category;
      ticket.assignedAgentId = dto.assignedAgentId ?? null;
    }

    await this.ticketsRepository.save(ticket);
    return this.findOneOrFail(id);
  }

  async remove(id: string): Promise<void> {
    const ticket = await this.ticketsRepository.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    await this.ticketsRepository.remove(ticket);
  }

  private async findOneOrFail(id: string): Promise<Ticket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id },
      relations: TICKET_RELATIONS,
    });
    if (!ticket) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  private async findSimilarCandidates(
    user: AuthUser,
    sourceTicketId: string,
  ): Promise<Ticket[]> {
    const where: FindOptionsWhere<Ticket> = {
      id: Not(sourceTicketId),
    };

    if (user.role === UserRole.CUSTOMER) {
      where.customerId = user.id;
    }

    return this.ticketsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: SIMILAR_CANDIDATE_CAP,
    });
  }

  private toEmbeddingText(
    ticket: Pick<Ticket, 'title' | 'description'>,
  ): string {
    return `${ticket.title}\n${ticket.description}`;
  }

  private roundScore(score: number): number {
    return Math.round(score * 10000) / 10000;
  }

  private assertCustomerAccess(user: AuthUser, ticket: Ticket): void {
    if (user.role === UserRole.CUSTOMER && ticket.customerId !== user.id) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async resolveCustomerId(
    user: AuthUser,
    requestedCustomerId?: string,
  ): Promise<string> {
    if (user.role === UserRole.CUSTOMER) {
      return user.id;
    }

    if (!requestedCustomerId) {
      throw new BadRequestException(
        'customerId is required when creating a ticket for a customer',
      );
    }

    const customer = await this.requireUser(requestedCustomerId);
    if (customer.role !== UserRole.CUSTOMER) {
      throw new BadRequestException('customerId must belong to a customer');
    }

    return customer.id;
  }

  private assertCustomerReplaceBody(dto: UpdateTicketDto): void {
    if (
      dto.status !== undefined ||
      dto.priority !== undefined ||
      dto.category !== undefined ||
      dto.assignedAgentId !== undefined
    ) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private assertStaffReplaceBody(
    dto: UpdateTicketDto,
  ): asserts dto is UpdateTicketDto & {
    status: TicketStatus;
    priority: TicketPriority;
    category: TicketCategory;
  } {
    if (
      dto.status === undefined ||
      dto.priority === undefined ||
      dto.category === undefined ||
      dto.assignedAgentId === undefined
    ) {
      throw new BadRequestException(
        'status, priority, category, and assignedAgentId are required',
      );
    }
  }

  private applyResolvedAt(ticket: Ticket, nextStatus: TicketStatus): void {
    if (RESOLVED_STATUSES.includes(nextStatus)) {
      if (!ticket.resolvedAt) {
        ticket.resolvedAt = new Date();
      }
      return;
    }

    if (OPEN_STATUSES.includes(nextStatus)) {
      ticket.resolvedAt = null;
    }
  }

  private async assertAssignableAgent(
    assignedAgentId: string | null,
  ): Promise<void> {
    if (!assignedAgentId) {
      return;
    }

    const agent = await this.requireUser(assignedAgentId);
    if (
      agent.role !== UserRole.SUPPORT_AGENT &&
      agent.role !== UserRole.ADMIN
    ) {
      throw new BadRequestException(
        'assignedAgentId must belong to a support agent or admin',
      );
    }
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.usersService.findById(id);
    if (!user || !user.isActive) {
      throw new BadRequestException('User not found or inactive');
    }
    return user;
  }

  private async nextTicketNumber(): Promise<string> {
    const rows = await this.dataSource.query<Array<{ n: string | number }>>(
      `SELECT nextval('ticket_number_seq') AS n`,
    );
    return `TCK-${rows[0].n}`;
  }
}
