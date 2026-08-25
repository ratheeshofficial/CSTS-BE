import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Ticket } from '../../tickets/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';

@Entity('comments')
export class Comment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index('IDX_comments_ticketId')
  @Column({ type: 'uuid' })
  ticketId!: string;

  @ManyToOne(() => Ticket, (ticket) => ticket.comments, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'ticketId' })
  ticket!: Ticket;

  @Index('IDX_comments_authorId')
  @Column({ type: 'uuid' })
  authorId!: string;

  @ManyToOne(() => User, (user) => user.comments, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'authorId' })
  author!: User;

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
