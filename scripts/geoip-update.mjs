#!/usr/bin/env node
// Downloads MaxMind GeoLite2-City to GEOIP_DB_PATH (used by GET /api/geo).
// Needs a free MaxMind account: MAXMIND_ACCOUNT_ID + MAXMIND_LICENSE_KEY in .env.
//   node scripts/geoip-update.mjs            download if missing or older than 7 days
//   node scripts/geoip-update.mjs --force    always download
// The API watches the file, so a refresh needs no restart.
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  /* no .env: rely on the environment */
}
const account = process.env.MAXMIND_ACCOUNT_ID;
const key = process.env.MAXMIND_LICENSE_KEY;
const target = resolve(
  root,
  'apps/backend',
  process.env.GEOIP_DB_PATH || './data/GeoLite2-City.mmdb',
);
const force = process.argv.includes('--force');

if (!account || !key) {
  console.log(
    'geoip: MAXMIND_ACCOUNT_ID / MAXMIND_LICENSE_KEY not set; skipping (location guessing stays off).',
  );
  process.exit(0);
}
if (!force && existsSync(target) && Date.now() - statSync(target).mtimeMs < 7 * 86_400_000) {
  console.log(`geoip: ${target} is less than 7 days old; nothing to do.`);
  process.exit(0);
}

const url = 'https://download.maxmind.com/geoip/databases/GeoLite2-City/download?suffix=tar.gz';
const res = await fetch(url, {
  headers: { Authorization: `Basic ${Buffer.from(`${account}:${key}`).toString('base64')}` },
});
if (!res.ok) {
  console.error(
    `geoip: download failed (${res.status}). Check the MaxMind account id and licence key.`,
  );
  process.exit(1);
}
const work = mkdtempSync(join(tmpdir(), 'geoip-'));
try {
  const archive = join(work, 'db.tar.gz');
  writeFileSync(archive, Buffer.from(await res.arrayBuffer()));
  execFileSync('tar', ['-xzf', archive, '-C', work]);
  const dir = readdirSync(work).find((d) => d.startsWith('GeoLite2-City_'));
  if (!dir) throw new Error('archive did not contain GeoLite2-City');
  mkdirSync(dirname(target), { recursive: true });
  // Write next to the target then rename, so the API never reads a half-written file.
  const staged = `${target}.new`;
  renameSync(join(work, dir, 'GeoLite2-City.mmdb'), staged);
  renameSync(staged, target);
  console.log(`geoip: updated ${target}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}
