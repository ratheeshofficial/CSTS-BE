import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { Comment } from '../../comments/entities/comment.entity';
import { Ticket, TicketStatus } from '../../tickets/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import {
  SEED_ADMIN_EMAIL,
  SEED_COMMENTS,
  SEED_PASSWORD,
  SEED_TICKETS,
  SEED_USERS,
} from './data';

const RESOLVED_STATUSES: TicketStatus[] = [
  TicketStatus.RESOLVED,
  TicketStatus.CLOSED,
];

export interface SeedOptions {
  reset: boolean;
}

export async function seed( 
  dataSource: DataSource,
  options: SeedOptions,
): Promise<void> {
  const userRepo = dataSource.getRepository(User);
  const ticketRepo = dataSource.getRepository(Ticket);
  const commentRepo = dataSource.getRepository(Comment);

  if (options.reset) {
    await dataSource.query(
      'TRUNCATE TABLE comments, tickets, users RESTART IDENTITY CASCADE',
    );
    await dataSource.query(
      'ALTER SEQUENCE ticket_number_seq RESTART WITH 1001',
    );
  } else {
    const existing = await userRepo.findOne({
      where: { email: SEED_ADMIN_EMAIL },
    });
    if (existing) {
      console.log(
        `Database already seeded (${SEED_ADMIN_EMAIL} exists). Skipping. Pass --reset to wipe and reseed.`,
      );
      return;
    }
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10);
  const usersByEmail = new Map<string, User>();

  for (const record of SEED_USERS) {
    const user = await userRepo.save(
      userRepo.create({
        name: record.name,
        email: record.email,
        passwordHash,
        role: record.role,
        isActive: record.isActive ?? true,
      }),
    );
    usersByEmail.set(record.email, user);
  }

  const ticketsByKey = new Map<string, Ticket>();

  for (const record of SEED_TICKETS) {
    const customer = requireUser(usersByEmail, record.customerEmail);
    const assignedAgentId = record.assignedAgentEmail
      ? requireUser(usersByEmail, record.assignedAgentEmail).id
      : null;

    const ticketNumber = await nextTicketNumber(dataSource);
    const resolvedAt = RESOLVED_STATUSES.includes(record.status)
      ? new Date()
      : null;

    const ticket = await ticketRepo.save(
      ticketRepo.create({
        ticketNumber,
        title: record.title,
        description: record.description,
        status: record.status,
        priority: record.priority,
        category: record.category,
        customerId: customer.id,
        assignedAgentId,
        resolvedAt,
      }),
    );
    ticketsByKey.set(record.key, ticket);
  }

  for (const record of SEED_COMMENTS) {
    const ticket = ticketsByKey.get(record.ticketKey);
    if (!ticket) {
      throw new Error(`Seed ticket not found: ${record.ticketKey}`);
    }

    const author = requireUser(usersByEmail, record.authorEmail);

    await commentRepo.save(
      commentRepo.create({
        ticketId: ticket.id,
        authorId: author.id,
        message: record.message,
      }),
    );
  }

  console.log(
    `Seeded ${SEED_USERS.length} users, ${SEED_TICKETS.length} tickets, ${SEED_COMMENTS.length} comments.`,
  );
}

function requireUser(usersByEmail: Map<string, User>, email: string): User {
  const user = usersByEmail.get(email);
  if (!user) {
    throw new Error(`Seed user not found: ${email}`);
  }
  return user;
}

async function nextTicketNumber(dataSource: DataSource): Promise<string> {
  const rows = await dataSource.query<Array<{ n: string | number }>>(
    `SELECT nextval('ticket_number_seq') AS n`,
  );
  return `TCK-${rows[0].n}`;
}
