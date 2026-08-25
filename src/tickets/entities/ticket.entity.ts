import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Comment } from '../../comments/entities/comment.entity';
import { User } from '../../users/entities/user.entity';

export enum TicketStatus {
  OPEN = 'OPEN',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketCategory {
  PAYMENT = 'PAYMENT',
  ORDER = 'ORDER',
  DELIVERY = 'DELIVERY',
  ACCOUNT = 'ACCOUNT',
  TECHNICAL = 'TECHNICAL',
  OTHER = 'OTHER',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  ticketNumber!: string;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  description!: string;

  @Index('IDX_tickets_status')
  @Column({ type: 'enum', enum: TicketStatus })
  status!: TicketStatus;

  @Index('IDX_tickets_priority')
  @Column({ type: 'enum', enum: TicketPriority })
  priority!: TicketPriority;

  @Index('IDX_tickets_category')
  @Column({ type: 'enum', enum: TicketCategory })
  category!: TicketCategory;

  @Index('IDX_tickets_customerId')
  @Column({ type: 'uuid' })
  customerId!: string;

  @ManyToOne(() => User, (user) => user.createdTickets, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'customerId' })
  customer!: User;

  @Index('IDX_tickets_assignedAgentId')
  @Column({ type: 'uuid', nullable: true })
  assignedAgentId!: string | null;

  @ManyToOne(() => User, (user) => user.assignedTickets, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'assignedAgentId' })
  assignedAgent!: User | null;

  @Index('IDX_tickets_createdAt')
  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt!: Date | null;

  @OneToMany(() => Comment, (comment) => comment.ticket)
  comments!: Comment[];
}
