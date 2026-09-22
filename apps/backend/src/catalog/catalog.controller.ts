import { Controller, Get, Query } from '@nestjs/common';
import {
  carSearchQuerySchema,
  type CarDto,
  type CarSearchQuery,
  type CityDto,
} from '@zuund/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';

/** Public read-only catalog. No auth: the signup flow shows cities before login. */
@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('cars')
  searchCars(
    @Query(new ZodValidationPipe(carSearchQuerySchema)) q: CarSearchQuery,
  ): Promise<CarDto[]> {
    return this.catalog.searchCars(q.q ?? '', q.limit);
  }

  @Get('cities')
  cities(): Promise<CityDto[]> {
    return this.catalog.listCities();
  }
}
