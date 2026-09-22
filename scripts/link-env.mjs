/**
 * Symlinks the root .env into every app that reads configuration from its own
 * directory. Nest (dotenv), Vite and Next all look beside the app, not at the
 * repo root, and the links are gitignored, so a fresh clone runs this once.
 */
import { existsSync, lstatSync, symlinkSync, unlinkSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const targets = ['apps/backend', 'apps/admin-dashboard', 'apps/web'];

const source = join(root, '.env');
if (!existsSync(source)) {
  console.error('No .env in the repo root. Run: cp .env.example .env');
  process.exit(1);
}

for (const dir of targets) {
  const link = join(root, dir, '.env');
  let present = false;
  try {
    lstatSync(link); // does not follow the link, so a broken one is still replaced
    present = true;
  } catch {
    present = false;
  }
  if (present) unlinkSync(link);
  const target = relative(join(root, dir), source);
  symlinkSync(target, link);
  console.log(`  ${dir}/.env -> ${target}`);
}
