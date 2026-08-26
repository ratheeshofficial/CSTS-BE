import { config } from 'dotenv';
import { resolve } from 'path';

process.env.NODE_ENV = 'test';

config({ path: resolve(process.cwd(), '.env.test'), override: true, quiet: true });

if (!process.env.DB_NAME?.toLowerCase().includes('test')) {
  throw new Error(
    'Refusing to run e2e tests: DB_NAME must include "test". Copy .env.test.example to .env.test.',
  );
}
