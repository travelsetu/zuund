import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { CARS, CITIES, slugify } from './seed-data';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var ${name} (see .env.example)`);
  return value;
}

async function main() {
  const adapter = new PrismaPg({ connectionString: required('DATABASE_URL') });
  const prisma = new PrismaClient({ adapter });

  try {
    // ── Admin user (idempotent; never overwrites an existing user) ──
    const email = required('ADMIN_EMAIL').trim().toLowerCase();
    const password = required('ADMIN_PASSWORD');
    const name = process.env.ADMIN_NAME ?? 'Admin';
    if (password.length < 8) throw new Error('ADMIN_PASSWORD must be at least 8 characters');

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (existing.role !== 'ADMIN') {
        await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
        console.log(`Promoted ${email} to ADMIN.`);
      } else {
        console.log(
          `Admin user ${email} already exists (id=${existing.id}); leaving it untouched.`,
        );
      }
    } else {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name,
          role: 'ADMIN',
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date(),
        },
      });
      console.log(`Created admin user ${user.email} (id=${user.id}).`);
    }

    // ── Catalog (upsert by slug; safe to re-run) ──
    for (const city of CITIES) {
      await prisma.city.upsert({
        where: { slug: city.slug },
        update: { name: city.name, state: city.state },
        create: city,
      });
    }
    for (const car of CARS) {
      const displayName = `${car.brand} ${car.model}`;
      const slug = slugify(displayName);
      await prisma.car.upsert({
        where: { slug },
        update: { brand: car.brand, model: car.model, displayName },
        create: { brand: car.brand, model: car.model, displayName, slug },
      });
    }
    console.log(`Catalog: ${CITIES.length} cities, ${CARS.length} cars upserted.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
