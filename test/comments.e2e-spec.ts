import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  TicketCategory,
  TicketPriority,
} from '../src/tickets/entities/ticket.entity';
import { UserRole } from '../src/users/entities/user.entity';
import {
  authHeader,
  createTestingApp,
  expectApiError,
} from './helpers/app.helper';
import { seedUser, truncateDb } from './helpers/db.helper';

const password = 'password123';
const missingId = '00000000-0000-4000-8000-000000000002';

describe('Comments (e2e)', () => {
  let app: INestApplication<App>;

  const ticketBody = {
    title: 'Order never arrived',
    description: 'Package is still missing after 10 days',
    priority: TicketPriority.MEDIUM,
    category: TicketCategory.DELIVERY,
  };

  beforeAll(async () => {
    app = await createTestingApp();
  });

  beforeEach(async () => {
    await truncateDb(app.get(DataSource));
  });

  afterAll(async () => {
    await truncateDb(app.get(DataSource));
    await app.close();
  });

  async function registerCustomer(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name: email, email, password })
      .expect(201);
    return { token: res.body.accessToken as string, id: res.body.user.id };
  }

  async function login(email: string) {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  async function createTicket(token: string) {
    const res = await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(token))
      .send(ticketBody)
      .expect(201);
    return res.body.id as string;
  }

  it('lets a customer comment on their own ticket and lists comments oldest first', async () => {
    const customer = await registerCustomer('cust@example.com');
    const ticketId = await createTicket(customer.token);

    const first = await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(customer.token))
      .send({ message: 'First comment' })
      .expect(201);

    expect(first.body).toMatchObject({
      ticketId,
      authorId: customer.id,
      message: 'First comment',
    });

    await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(customer.token))
      .send({ message: 'Second comment' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(customer.token))
      .expect(200);

    expect(list.body.map((comment: { message: string }) => comment.message)).toEqual(
      ['First comment', 'Second comment'],
    );
  });

  it('returns 403 when a customer comments on another customer ticket', async () => {
    const owner = await registerCustomer('owner@example.com');
    const other = await registerCustomer('other@example.com');
    const ticketId = await createTicket(owner.token);

    const res = await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(other.token))
      .send({ message: 'Not my ticket' })
      .expect(403);

    expectApiError(res.body, 403, 'Insufficient permissions', 'Forbidden');
  });

  it('lets the author update and delete their comment', async () => {
    const customer = await registerCustomer('cust@example.com');
    const ticketId = await createTicket(customer.token);
    const created = await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(customer.token))
      .send({ message: 'Original' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/api/comments/${created.body.id}`)
      .set(authHeader(customer.token))
      .send({ message: 'Edited' })
      .expect(200);
    expect(updated.body.message).toBe('Edited');

    await request(app.getHttpServer())
      .delete(`/api/comments/${created.body.id}`)
      .set(authHeader(customer.token))
      .expect(204);
  });

  it('forbids unauthorized comment update and delete', async () => {
    const owner = await registerCustomer('owner@example.com');
    const other = await registerCustomer('other@example.com');
    await seedUser(app, {
      name: 'Agent',
      email: 'agent@example.com',
      password,
      role: UserRole.SUPPORT_AGENT,
    });
    const agentToken = await login('agent@example.com');

    const ticketId = await createTicket(owner.token);
    const created = await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(owner.token))
      .send({ message: 'Owner comment' })
      .expect(201);

    const otherUpdate = await request(app.getHttpServer())
      .put(`/api/comments/${created.body.id}`)
      .set(authHeader(other.token))
      .send({ message: 'Hijack' })
      .expect(403);
    expectApiError(
      otherUpdate.body,
      403,
      'Insufficient permissions',
      'Forbidden',
    );

    const agentDelete = await request(app.getHttpServer())
      .delete(`/api/comments/${created.body.id}`)
      .set(authHeader(agentToken))
      .expect(403);
    expectApiError(
      agentDelete.body,
      403,
      'Insufficient permissions',
      'Forbidden',
    );
  });

  it('lets an admin update and delete any comment', async () => {
    const owner = await registerCustomer('owner@example.com');
    await seedUser(app, {
      name: 'Admin',
      email: 'admin@example.com',
      password,
      role: UserRole.ADMIN,
    });
    const adminToken = await login('admin@example.com');
    const ticketId = await createTicket(owner.token);
    const created = await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(owner.token))
      .send({ message: 'Owner comment' })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/api/comments/${created.body.id}`)
      .set(authHeader(adminToken))
      .send({ message: 'Admin edit' })
      .expect(200);
    expect(updated.body.message).toBe('Admin edit');

    await request(app.getHttpServer())
      .delete(`/api/comments/${created.body.id}`)
      .set(authHeader(adminToken))
      .expect(204);
  });

  it('returns 404 for an unknown comment and 400 for empty message', async () => {
    const customer = await registerCustomer('cust@example.com');
    const ticketId = await createTicket(customer.token);

    const missing = await request(app.getHttpServer())
      .put(`/api/comments/${missingId}`)
      .set(authHeader(customer.token))
      .send({ message: 'Nope' })
      .expect(404);
    expectApiError(missing.body, 404, 'Comment not found', 'Not Found');

    const invalid = await request(app.getHttpServer())
      .post(`/api/tickets/${ticketId}/comments`)
      .set(authHeader(customer.token))
      .send({ message: '' })
      .expect(400);
    expectApiError(invalid.body, 400, 'Validation failed', 'Bad Request');
  });
});
