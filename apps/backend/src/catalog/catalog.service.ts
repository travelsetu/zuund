import { Injectable, NotFoundException } from '@nestjs/common';
import type { BrandDto, CarDto, CityDto, CountryDto, ProductCategory } from '@zuund/shared';
import { toCar, toCity } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

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
