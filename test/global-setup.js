const { config } = require('dotenv');
const { resolve } = require('path');
const { Client } = require('pg');

module.exports = async function globalSetup() {
  process.env.NODE_ENV = 'test';
  config({ path: resolve(process.cwd(), '.env.test'), override: true, quiet: true });

  const dbName = process.env.DB_NAME;
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    throw new Error(
      'Refusing to run e2e tests: DB_NAME must include "test". Copy .env.test.example to .env.test.',
    );
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await client.connect();
  try {
    const result = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (result.rowCount === 0) {
      const safeName = dbName.replace(/"/g, '');
      await client.query(`CREATE DATABASE "${safeName}"`);
    }
  } finally {
    await client.end();
  }
};
