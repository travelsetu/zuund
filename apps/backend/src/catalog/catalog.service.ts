import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CATEGORY_DEMAND_MIN_BUYERS,
  NEARBY_MIN_COUNT,
  type BrandDto,
  type CarDto,
  type CategoryDemandDto,
  type CategoryOverviewDto,
  type CityDto,
  type CountryDto,
  type ProductCategory,
} from '@zuund/shared';
import { toCar, toCity } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';
import { distanceKm } from '../common/geo';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Landing pages are rebuilt every few minutes by many visitors; one query per category per window. */
  private overviews = new Map<
    ProductCategory,
    { at: number; value: Promise<CategoryOverviewDto> }
  >();
  private static readonly OVERVIEW_TTL_MS = 5 * 60_000;

  /** A category's whole catalog and its live demand, for the public landing page on zuund.com. */
  categoryOverview(category: ProductCategory): Promise<CategoryOverviewDto> {
    const hit = this.overviews.get(category);
    if (hit && Date.now() - hit.at < CatalogService.OVERVIEW_TTL_MS) return hit.value;
    const value = this.buildOverview(category);
    this.overviews.set(category, { at: Date.now(), value });
    value.catch(() => this.overviews.delete(category));
    return value;
  }

  private async buildOverview(category: ProductCategory): Promise<CategoryOverviewDto> {
    const [cars, brands, demand] = await Promise.all([
      this.prisma.car.findMany({ where: { status: 'ACTIVE', category } }),
      this.listBrands(category),
      this.categoryDemand(category),
    ]);
    cars.sort(
      (a, b) =>
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model, undefined, { numeric: true, sensitivity: 'base' }),
    );
    return { category, items: cars.map(toCar), brands, demand };
  }

  /**
   * People (not posts) buying in this category now. Null below CATEGORY_DEMAND_MIN_BUYERS;
   * models and cities with fewer than NEARBY_MIN_COUNT buyers are left out.
   */
  private async categoryDemand(category: ProductCategory): Promise<CategoryDemandDto | null> {
    const posts = await this.prisma.buyingIntent.findMany({
      where: { status: 'ACTIVE', car: { category, status: 'ACTIVE' }, user: { status: 'ACTIVE' } },
      select: { userId: true, carId: true, createdAt: true, city: { select: { name: true } } },
    });
    const buyers = new Set(posts.map((p) => p.userId)).size;
    if (buyers < CATEGORY_DEMAND_MIN_BUYERS) return null;

    const tally = (key: (p: (typeof posts)[number]) => string) => {
      const people = new Map<string, Set<string>>();
      for (const p of posts) {
        const k = key(p);
        if (!people.has(k)) people.set(k, new Set());
        people.get(k)!.add(p.userId);
      }
      return [...people]
        .map(([k, users]) => ({ key: k, buyers: users.size }))
        .filter((r) => r.buyers >= NEARBY_MIN_COUNT)
        .sort((a, b) => b.buyers - a.buyers || a.key.localeCompare(b.key))
        .slice(0, 8);
    };
    const weekAgo = Date.now() - 7 * 24 * 3600_000;
    return {
      buyers,
      cities: new Set(posts.map((p) => p.city.name)).size,
      newThisWeek: new Set(
        posts.filter((p) => p.createdAt.getTime() >= weekAgo).map((p) => p.userId),
      ).size,
      topItems: tally((p) => p.carId).map((r) => ({ carId: r.key, buyers: r.buyers })),
      topCities: tally((p) => p.city.name).map((r) => ({ name: r.key, buyers: r.buyers })),
    };
  }

  /** Matches brand, model or display name word by word, case-insensitively. Empty query returns the catalog head. */
  async listBrands(category: ProductCategory): Promise<BrandDto[]> {
    const rows = await this.prisma.car.groupBy({
      by: ['brand'],
      where: { status: 'ACTIVE', category },
      _count: { _all: true },
      orderBy: { brand: 'asc' },
    });
    return rows.map((r) => ({ name: r.brand, count: r._count._all }));
  }

  async searchCars(
    q: string,
    limit: number,
    category?: ProductCategory,
    brand?: string,
  ): Promise<CarDto[]> {
    const term = q.trim();
    const rows = await this.prisma.car.findMany({
      where: {
        status: 'ACTIVE',
        ...(category ? { category } : {}),
        ...(brand ? { brand: { equals: brand, mode: 'insensitive' as const } } : {}),
        // Every word must match somewhere, so "maruti swift" finds "Maruti Suzuki Swift".
        AND: term.split(/\s+/).map((w) => ({
          OR: [
            { displayName: { contains: w, mode: 'insensitive' as const } },
            { brand: { contains: w, mode: 'insensitive' as const } },
            { model: { contains: w, mode: 'insensitive' as const } },
          ],
        })),
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
      take: limit,
    });
    // Natural order, so "2 kW" comes before "10 kW".
    rows.sort(
      (a, b) =>
        a.brand.localeCompare(b.brand) ||
        a.model.localeCompare(b.model, undefined, { numeric: true, sensitivity: 'base' }),
    );
    // Prefix matches on the model read as the "right" answer for "Cre" → Creta; float them up.
    const lower = term.toLowerCase();
    rows.sort(
      (a, b) =>
        Number(b.model.toLowerCase().startsWith(lower)) -
        Number(a.model.toLowerCase().startsWith(lower)),
    );
    return rows.map(toCar);
  }

  /** Cities of one country, biggest first; every word of `q` must match the name or state. */
  async listCities(country: string, q: string | undefined, limit: number): Promise<CityDto[]> {
    const words = (q ?? '').trim().split(/\s+/).filter(Boolean);
    const rows = await this.prisma.city.findMany({
      where: {
        status: 'ACTIVE',
        countryCode: country,
        AND: words.map((w) => ({
          OR: [
            { name: { contains: w, mode: 'insensitive' as const } },
            { state: { contains: w, mode: 'insensitive' as const } },
          ],
        })),
      },
      orderBy: [{ population: 'desc' }, { name: 'asc' }],
      take: limit,
    });
    // A name that starts with the query ("Sur" → Surat) beats a bigger city that merely contains it.
    const first = words[0]?.toLowerCase();
    if (first) {
      rows.sort(
        (a, b) =>
          Number(b.name.toLowerCase().startsWith(first)) -
          Number(a.name.toLowerCase().startsWith(first)),
      );
    }
    return rows.map(toCity);
  }

  /** Countries that have at least one active city. */
  async listCountries(): Promise<CountryDto[]> {
    const rows = await this.prisma.country.findMany({
      where: { status: 'ACTIVE', cities: { some: { status: 'ACTIVE' } } },
      orderBy: { name: 'asc' },
      select: { code: true, name: true },
    });
    return rows;
  }

  async findCountry(code: string): Promise<CountryDto | null> {
    return this.prisma.country.findFirst({
      where: { code, status: 'ACTIVE' },
      select: { code: true, name: true },
    });
  }

  async findCityByGeonameId(geonameId: number): Promise<CityDto | null> {
    const c = await this.prisma.city.findFirst({ where: { geonameId, status: 'ACTIVE' } });
    return c ? toCity(c) : null;
  }

  /**
   * The city an IP database's coordinates point at, for databases without GeoNames ids
   * (DB-IP). A city with the same name within 60 km wins ("Bengaluru"); otherwise the
   * nearest one within 40 km, so a suburb resolves to its city and a rural hit to nothing.
   */
  /** The nearest city within 40 km (a same-named one within 60 km wins), optionally in one country. */
  async findNearestCity(
    countryCode: string | null,
    latitude: number,
    longitude: number,
    name?: string,
  ): Promise<CityDto | null> {
    const box = 0.6; // degrees; ~65 km north–south, enough for both radii
    const rows = await this.prisma.city.findMany({
      where: {
        status: 'ACTIVE',
        ...(countryCode ? { countryCode } : {}),
        latitude: { gte: latitude - box, lte: latitude + box },
        longitude: { gte: longitude - box * 2, lte: longitude + box * 2 },
      },
    });
    const scored = rows
      .filter((c) => c.latitude !== null && c.longitude !== null)
      .map((c) => ({ c, km: distanceKm(latitude, longitude, c.latitude!, c.longitude!) }))
      .sort((a, b) => a.km - b.km);
    // DB-IP adds a locality in brackets: "Navi Mumbai (Ghansoli)".
    const wanted = name
      ?.replace(/\(.*?\)/g, '')
      .trim()
      .toLowerCase();
    const named = wanted && scored.find((x) => x.km <= 60 && x.c.name.toLowerCase() === wanted);
    const hit = named || (scored[0] && scored[0].km <= 40 ? scored[0] : null);
    return hit ? toCity(hit.c) : null;
  }

  async requireActiveCar(id: string) {
    const car = await this.prisma.car.findFirst({ where: { id, status: 'ACTIVE' } });
    if (!car) throw new NotFoundException('Car not found');
    return car;
  }

  async requireActiveCity(id: string) {
    const city = await this.prisma.city.findFirst({ where: { id, status: 'ACTIVE' } });
    if (!city) throw new NotFoundException('City not found');
    return city;
  }
}
