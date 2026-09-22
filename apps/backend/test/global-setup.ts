import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { applyTestEnv, TEST_DATABASE_URL } from './env';

/** Runs once per `vitest run`: migrates the test database to the current schema. */
export default function globalSetup(): void {
  applyTestEnv();
  if (!TEST_DATABASE_URL.includes('zuund_test'))
    throw new Error('Refusing to run tests against a non-test database');
  const result = spawnSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: resolve(__dirname, '..'),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`prisma migrate deploy failed:\n${result.stdout}\n${result.stderr}`);
  }
}
