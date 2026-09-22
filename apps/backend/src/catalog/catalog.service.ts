import { Injectable, NotFoundException } from '@nestjs/common';
import type { CarDto, CityDto } from '@zuund/shared';
import { toCar, toCity } from '../common/mappers';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  /** Matches brand, model or display name, case-insensitively. Empty query returns the catalog head. */
  async searchCars(q: string, limit: number): Promise<CarDto[]> {
    const term = q.trim();
    const rows = await this.prisma.car.findMany({
      where: {
        status: 'ACTIVE',
        ...(term
          ? {
              OR: [
                { displayName: { contains: term, mode: 'insensitive' } },
                { brand: { contains: term, mode: 'insensitive' } },
                { model: { contains: term, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ brand: 'asc' }, { model: 'asc' }],
      take: limit,
    });
    // Prefix matches on the model read as the "right" answer for "Cre" → Creta; float them up.
    const lower = term.toLowerCase();
    rows.sort(
      (a, b) =>
        Number(b.model.toLowerCase().startsWith(lower)) -
        Number(a.model.toLowerCase().startsWith(lower)),
    );
    return rows.map(toCar);
  }

  async listCities(): Promise<CityDto[]> {
    const rows = await this.prisma.city.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCity);
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
