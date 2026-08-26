import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { UserRole } from '../src/users/entities/user.entity';
import {
  authHeader,
  createTestingApp,
  expectApiError,
} from './helpers/app.helper';
import { truncateDb } from './helpers/db.helper';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  const password = 'password123';
  const registerBody = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    password,
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

  describe('POST /api/auth/register', () => {
    it('creates a customer and returns a JWT', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerBody)
        .expect(201);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({
        name: registerBody.name,
        email: registerBody.email,
        role: UserRole.CUSTOMER,
        isActive: true,
      });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('returns 409 when the email is already registered', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerBody)
        .expect(409);

      expectApiError(
        res.body,
        409,
        'Email is already registered',
        'Conflict',
      );
    });

    it('returns 400 when validation fails', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          name: 'J',
          email: 'not-an-email',
          password: 'short',
          extra: 'nope',
        })
        .expect(400);

      expectApiError(res.body, 400, 'Validation failed', 'Bad Request');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerBody)
        .expect(201);
    });

    it('returns a token for valid credentials', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: registerBody.email, password })
        .expect(200);

      expect(res.body.accessToken).toEqual(expect.any(String));
      expect(res.body.user.email).toBe(registerBody.email);
    });

    it('returns 401 for an unknown email', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'missing@example.com', password })
        .expect(401);

      expectApiError(res.body, 401, 'Invalid credentials', 'Unauthorized');
    });

    it('returns 401 for a wrong password', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: registerBody.email, password: 'wrongpass' })
        .expect(401);

      expectApiError(res.body, 401, 'Invalid credentials', 'Unauthorized');
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user with a valid token', async () => {
      const registered = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send(registerBody)
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(authHeader(registered.body.accessToken))
        .expect(200);

      expect(res.body).toMatchObject({
        email: registerBody.email,
        role: UserRole.CUSTOMER,
      });
      expect(res.body.accessToken).toBeUndefined();
    });

    it('returns 401 without a token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .expect(401);

      expectApiError(res.body, 401, 'Unauthorized', 'Unauthorized');
    });

    it('returns 401 with an invalid token', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set(authHeader('not-a-valid-token'))
        .expect(401);

      expectApiError(res.body, 401, 'Unauthorized', 'Unauthorized');
    });
  });
});
