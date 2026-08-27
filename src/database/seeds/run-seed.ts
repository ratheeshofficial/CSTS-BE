import dataSource from '../data-source';
import { seed } from './seed';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const force = args.includes('--force');

  if (process.env.NODE_ENV === 'production' && !force) {
    console.error(
      'Refusing to seed when NODE_ENV=production. Pass --force to override.',
    );
    process.exit(1);
  }

  await dataSource.initialize();

  try {
    await seed(dataSource, { reset });
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
