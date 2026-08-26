import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { DataSource } from 'typeorm';
import { createTestingApp } from './helpers/app.helper';
import { truncateDb } from './helpers/db.helper';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    app = await createTestingApp();
  });

  afterAll(async () => {
    await truncateDb(app.get(DataSource));
    await app.close();
  });

  it('GET /api returns the health check', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});
