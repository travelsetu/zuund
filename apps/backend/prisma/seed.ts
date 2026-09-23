import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../src/generated/prisma/client';
import { readCities, readCountries } from './geo-data';
import { CARS, SOLAR, slugify } from './seed-data';

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
    // Countries and cities (GeoNames). Bulk insert; existing rows keep their ids and slugs.
    const countries = readCountries();
    for (const c of countries) {
      await prisma.country.upsert({
        where: { code: c.code },
        update: { name: c.name, continent: c.continent },
        create: c,
      });
    }
    const cities = readCities();
    const knownCities = new Map(
      (await prisma.city.findMany({ select: { slug: true, geonameId: true } })).map((c) => [
        c.slug,
        c.geonameId,
      ]),
    );
    // Rows created before GeoNames (the original Indian cities) get their geo data filled in.
    for (const c of cities.filter(
      (c) => knownCities.has(c.slug) && knownCities.get(c.slug) === null,
    )) {
      await prisma.city.update({
        where: { slug: c.slug },
        data: {
          geonameId: c.geonameId,
          countryCode: c.countryCode,
          population: c.population,
          latitude: c.latitude,
          longitude: c.longitude,
        },
      });
    }
    const fresh = cities.filter((c) => !knownCities.has(c.slug));
    for (let i = 0; i < fresh.length; i += 2000) {
      await prisma.city.createMany({ data: fresh.slice(i, i + 2000), skipDuplicates: true });
    }
    const catalog = [
      ...CARS.map((c) => ({ ...c, category: 'CAR' as const })),
      ...SOLAR.map((s) => ({ ...s, category: 'SOLAR' as const })),
    ];
    for (const item of catalog) {
      const displayName = 'displayName' in item ? item.displayName : `${item.brand} ${item.model}`;
      const slug = ('slug' in item && item.slug) || slugify(displayName);
      const data = {
        brand: item.brand,
        model: item.model,
        displayName,
        category: item.category,
        segment: item.segment,
      };
      await prisma.car.upsert({
        where: { slug },
        update: { ...data, status: 'ACTIVE' },
        create: { ...data, slug },
      });
    }
    // Anything no longer in the catalogue (discontinued cars, the old brand-by-brand solar
    // list) is retired, never deleted: old Buying Posts still point at it.
    const activeSlugs = catalog.map(
      (item) =>
        ('slug' in item && item.slug) ||
        slugify('displayName' in item ? item.displayName : `${item.brand} ${item.model}`),
    );
    const retired = await prisma.car.updateMany({
      where: { status: 'ACTIVE', slug: { notIn: activeSlugs } },
      data: { status: 'INACTIVE' },
    });
    if (retired.count) console.log(`Retired ${retired.count} catalog rows no longer on sale.`);
    console.log(
      `Catalog: ${countries.length} countries, ${cities.length} cities, ${CARS.length} cars, ${SOLAR.length} solar systems upserted.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
