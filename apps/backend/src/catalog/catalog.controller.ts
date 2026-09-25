import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import {
  brandsQuerySchema,
  type BrandDto,
  type BrandsQuery,
  categoryOverviewQuerySchema,
  type CategoryOverviewDto,
  type CategoryOverviewQuery,
  carSearchQuerySchema,
  citiesQuerySchema,
  geoNearestQuerySchema,
  type CitiesQuery,
  type CountryDto,
  type GeoGuessDto,
  type CarDto,
  type CarSearchQuery,
  type CityDto,
} from '@zuund/shared';
import { z } from 'zod';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { CatalogService } from './catalog.service';
import { GeoService } from './geo.service';

/** Public read-only catalog. No auth: the signup flow shows cities before login. */
@Controller()
export class CatalogController {
  constructor(
    private readonly catalog: CatalogService,
    private readonly geoService: GeoService,
  ) {}

  @Get('cars')
  searchCars(
    @Query(new ZodValidationPipe(carSearchQuerySchema)) q: CarSearchQuery,
  ): Promise<CarDto[]> {
    return this.catalog.searchCars(q.q ?? '', q.limit, q.category, q.brand);
  }

  /** Brands with their model counts, for "pick a brand, then a model". */
  @Get('cars/brands')
  brands(@Query(new ZodValidationPipe(brandsQuerySchema)) q: BrandsQuery): Promise<BrandDto[]> {
    return this.catalog.listBrands(q.category);
  }

  /** A category's catalog and live demand, for its landing page on zuund.com. */
  @Get('catalog/overview')
  overview(
    @Query(new ZodValidationPipe(categoryOverviewQuerySchema)) q: CategoryOverviewQuery,
  ): Promise<CategoryOverviewDto> {
    return this.catalog.categoryOverview(q.category);
  }

  @Get('countries')
  countries(): Promise<CountryDto[]> {
    return this.catalog.listCountries();
  }

  @Get('cities')
  cities(@Query(new ZodValidationPipe(citiesQuerySchema)) q: CitiesQuery): Promise<CityDto[]> {
    return this.catalog.listCities(q.country, q.q, q.limit);
  }

  /** Country/city guessed from the caller's IP (behind nginx: X-Forwarded-For via trust proxy). */
  @Get('geo')
  geo(@Req() req: Request): Promise<GeoGuessDto> {
    return this.geoService.guess(req.ip);
  }

  /** The city nearest the device's position (when the user allowed location). Not stored. */
  @Get('geo/nearest')
  nearest(
    @Query(new ZodValidationPipe(geoNearestQuerySchema)) q: z.infer<typeof geoNearestQuerySchema>,
  ): Promise<GeoGuessDto> {
    return this.geoService.nearest(q);
  }
}
