import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../src/tickets/entities/ticket.entity';
import { UserRole } from '../src/users/entities/user.entity';
import {
  authHeader,
  createTestingApp,
  expectApiError,
} from './helpers/app.helper';
import { seedUser, truncateDb } from './helpers/db.helper';

const password = 'password123';
const missingId = '00000000-0000-4000-8000-000000000001';

type TicketBody = {
  title: string;
  description: string;
  priority: TicketPriority;
  category: TicketCategory;
};

describe('Tickets (e2e)', () => {
  let app: INestApplication<App>;

  const ticketBody: TicketBody = {
    title: 'Payment failed on checkout',
    description: 'I was charged twice when placing order 1234',
    priority: TicketPriority.HIGH,
    category: TicketCategory.PAYMENT,
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

  async function registerCustomer(
    name: string,
    email: string,
  ): Promise<{ token: string; id: string }> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ name, email, password })
      .expect(201);
    return { token: res.body.accessToken, id: res.body.user.id };
  }

  async function login(email: string): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    return res.body.accessToken as string;
  }

  it('returns 401 for unauthenticated ticket requests', async () => {
    const res = await request(app.getHttpServer()).get('/api/tickets').expect(401);
    expectApiError(res.body, 401, 'Unauthorized', 'Unauthorized');
  });

  it('lets a customer create a ticket', async () => {
    const customer = await registerCustomer('Cust One', 'cust1@example.com');

    const res = await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(customer.token))
      .send(ticketBody)
      .expect(201);

    expect(res.body).toMatchObject({
      title: ticketBody.title,
      description: ticketBody.description,
      status: TicketStatus.OPEN,
      priority: TicketPriority.HIGH,
      category: TicketCategory.PAYMENT,
      customerId: customer.id,
      assignedAgentId: null,
    });
    expect(res.body.ticketNumber).toMatch(/^TCK-/);
  });

  it('lists only the authenticated customer tickets and paginates', async () => {
    const customerA = await registerCustomer('Alice', 'a@example.com');
    const customerB = await registerCustomer('Bob', 'b@example.com');

    await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(customerB.token))
      .send({ ...ticketBody, title: 'B ticket' })
      .expect(201);

    for (const title of ['Alpha payment', 'Beta delivery', 'Gamma other']) {
      await request(app.getHttpServer())
        .post('/api/tickets')
        .set(authHeader(customerA.token))
        .send({
          ...ticketBody,
          title,
          category:
            title === 'Beta delivery'
              ? TicketCategory.DELIVERY
              : TicketCategory.PAYMENT,
        })
        .expect(201);
    }

    const list = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ page: 1, limit: 2 })
      .set(authHeader(customerA.token))
      .expect(200);

    expect(list.body.data).toHaveLength(2);
    expect(list.body.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
    expect(
      list.body.data.every(
        (ticket: { customerId: string; title: string }) =>
          ticket.customerId === customerA.id && ticket.title !== 'B ticket',
      ),
    ).toBe(true);

    const filtered = await request(app.getHttpServer())
      .get('/api/tickets')
      .query({ status: TicketStatus.OPEN, search: 'delivery' })
      .set(authHeader(customerA.token))
      .expect(200);

    expect(filtered.body.data).toHaveLength(1);
    expect(filtered.body.data[0].title).toBe('Beta delivery');
  });

  it('returns 403 when a customer reads another customer ticket', async () => {
    const customerA = await registerCustomer('Alice', 'a@example.com');
    const customerB = await registerCustomer('Bob', 'b@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(customerA.token))
      .send(ticketBody)
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/tickets/${created.body.id}`)
      .set(authHeader(customerB.token))
      .expect(403);

    expectApiError(res.body, 403, 'Insufficient permissions', 'Forbidden');
  });

  it('returns 404 for an unknown ticket id', async () => {
    const customer = await registerCustomer('Alice', 'a@example.com');
    const res = await request(app.getHttpServer())
      .get(`/api/tickets/${missingId}`)
      .set(authHeader(customer.token))
      .expect(404);

    expectApiError(res.body, 404, 'Ticket not found', 'Not Found');
  });

  it('lets a customer update title and description only', async () => {
    const customer = await registerCustomer('Alice', 'a@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(customer.token))
      .send(ticketBody)
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/api/tickets/${created.body.id}`)
      .set(authHeader(customer.token))
      .send({
        title: 'Updated title here',
        description: 'Updated description',
      })
      .expect(200);

    expect(updated.body.title).toBe('Updated title here');
    expect(updated.body.status).toBe(TicketStatus.OPEN);

    const forbidden = await request(app.getHttpServer())
      .put(`/api/tickets/${created.body.id}`)
      .set(authHeader(customer.token))
      .send({
        title: 'Updated title here',
        description: 'Updated description',
        status: TicketStatus.CLOSED,
      })
      .expect(403);

    expectApiError(
      forbidden.body,
      403,
      'Insufficient permissions',
      'Forbidden',
    );
  });

  it('lets an agent assign and resolve a ticket', async () => {
    const customer = await registerCustomer('Alice', 'a@example.com');
    const agent = await seedUser(app, {
      name: 'Agent',
      email: 'agent@example.com',
      password,
      role: UserRole.SUPPORT_AGENT,
    });
    const agentToken = await login('agent@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(customer.token))
      .send(ticketBody)
      .expect(201);

    const updated = await request(app.getHttpServer())
      .put(`/api/tickets/${created.body.id}`)
      .set(authHeader(agentToken))
      .send({
        title: ticketBody.title,
        description: ticketBody.description,
        status: TicketStatus.RESOLVED,
        priority: TicketPriority.HIGH,
        category: TicketCategory.PAYMENT,
        assignedAgentId: agent.id,
      })
      .expect(200);

    expect(updated.body.status).toBe(TicketStatus.RESOLVED);
    expect(updated.body.assignedAgentId).toBe(agent.id);
    expect(updated.body.resolvedAt).toEqual(expect.any(String));
  });

  it('forbids non-admins from deleting tickets and lets an admin delete', async () => {
    const customer = await registerCustomer('Alice', 'a@example.com');
    const created = await request(app.getHttpServer())
      .post('/api/tickets')
      .set(authHeader(customer.token))
      .send(ticketBody)
      .expect(201);

    await seedUser(app, {
      name: 'Agent',
      email: 'agent@example.com',
      password,
      role: UserRole.SUPPORT_AGENT,
    });
    const agentToken = await login('agent@example.com');

    const customerDelete = await request(app.getHttpServer())
      .delete(`/api/tickets/${created.body.id}`)
      .set(authHeader(customer.token))
      .expect(403);
    expectApiError(
      customerDelete.body,
      403,
      'Insufficient permissions',
      'Forbidden',
    );

    const agentDelete = await request(app.getHttpServer())
      .delete(`/api/tickets/${created.body.id}`)
      .set(authHeader(agentToken))
      .expect(403);
    expectApiError(
      agentDelete.body,
      403,
      'Insufficient permissions',
      'Forbidden',
    );

    await seedUser(app, {
      name: 'Admin',
      email: 'admin@example.com',
      password,
      role: UserRole.ADMIN,
    });
    const adminToken = await login('admin@example.com');

    await request(app.getHttpServer())
      .delete(`/api/tickets/${created.body.id}`)
      .set(authHeader(adminToken))
      .expect(204);

    const missing = await request(app.getHttpServer())
      .delete(`/api/tickets/${missingId}`)
      .set(authHeader(adminToken))
      .expect(404);
    expectApiError(missing.body, 404, 'Ticket not found', 'Not Found');
  });
});
