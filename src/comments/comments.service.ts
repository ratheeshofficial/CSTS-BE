import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { AuthUser } from '../auth/decorators/current-user.decorator';
import { TicketsService } from '../tickets/tickets.service';
import { UserRole } from '../users/entities/user.entity';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment.dto';
import { Comment } from './entities/comment.entity';

const COMMENT_RELATIONS = {
  author: true,
} as const;

@Injectable()
export class CommentsService {
  constructor(
    @InjectRepository(Comment)
    private readonly commentsRepository: Repository<Comment>,
    private readonly ticketsService: TicketsService,
  ) {}

  async create(
    user: AuthUser,
    ticketId: string,
    dto: CreateCommentDto,
  ): Promise<Comment> {
    await this.ticketsService.findOne(user, ticketId);

    const comment = this.commentsRepository.create({
      ticketId,
      authorId: user.id,
      message: dto.message,
    });

    const saved = await this.commentsRepository.save(comment);
    return this.findOneOrFail(saved.id);
  }

  async findAll(user: AuthUser, ticketId: string): Promise<Comment[]> {
    await this.ticketsService.findOne(user, ticketId);

    return this.commentsRepository.find({
      where: { ticketId },
      relations: COMMENT_RELATIONS,
      order: { createdAt: 'ASC' },
    });
  }

  async update(
    user: AuthUser,
    id: string,
    dto: UpdateCommentDto,
  ): Promise<Comment> {
    const comment = await this.findOneOrFail(id);
    this.assertAuthorOrAdmin(user, comment);

    comment.message = dto.message;
    await this.commentsRepository.save(comment);
    return this.findOneOrFail(id);
  }

  async remove(user: AuthUser, id: string): Promise<void> {
    const comment = await this.findOneOrFail(id);
    this.assertAuthorOrAdmin(user, comment);
    await this.commentsRepository.remove(comment);
  }

  private async findOneOrFail(id: string): Promise<Comment> {
    const comment = await this.commentsRepository.findOne({
      where: { id },
      relations: COMMENT_RELATIONS,
    });
    if (!comment) {
      throw new NotFoundException('Comment not found');
    }
    return comment;
  }

  private assertAuthorOrAdmin(user: AuthUser, comment: Comment): void {
    if (user.role !== UserRole.ADMIN && comment.authorId !== user.id) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }
}
