#!/usr/bin/env node
// Downloads DB-IP "IP to City Lite" (free, no account, CC BY 4.0 — the app credits DB-IP)
// to GEOIP_DB_PATH, used by GET /api/geo. DB-IP publishes a new file each month.
//   node scripts/geoip-update.mjs            download if missing or older than 7 days
//   node scripts/geoip-update.mjs --force    always download
// The API watches the file, so a refresh needs no restart.
import { existsSync, mkdirSync, renameSync, rmSync, statSync, createWriteStream } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { createGunzip } from 'node:zlib';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(join(root, '.env'));
} catch {
  /* no .env: rely on the environment */
}
const target = resolve(
  root,
  'apps/backend',
  process.env.GEOIP_DB_PATH || './data/dbip-city-lite.mmdb',
);
const force = process.argv.includes('--force');

if (!force && existsSync(target) && Date.now() - statSync(target).mtimeMs < 7 * 86_400_000) {
  console.log(`geoip: ${target} is less than 7 days old; nothing to do.`);
  process.exit(0);
}

// This month's file, or last month's in the first days before DB-IP publishes the new one.
const months = [0, 1].map((back) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - back);
  return d.toISOString().slice(0, 7);
});
let res;
for (const month of months) {
  res = await fetch(`https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`);
  if (res.ok) {
    console.log(`geoip: downloading DB-IP City Lite ${month}`);
    break;
  }
}
if (!res?.ok) {
  console.error(`geoip: download failed (${res?.status}); keeping the current database.`);
  process.exit(1);
}
mkdirSync(dirname(target), { recursive: true });
// Write next to the target then rename, so the API never reads a half-written file.
const staged = `${target}.new`;
try {
  await pipeline(Readable.fromWeb(res.body), createGunzip(), createWriteStream(staged));
  renameSync(staged, target);
  console.log(`geoip: updated ${target}`);
} catch (e) {
  rmSync(staged, { force: true });
  throw e;
}
