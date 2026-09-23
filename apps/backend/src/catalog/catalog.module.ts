import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { GeoService } from './geo.service';

@Module({
  controllers: [CatalogController],
  providers: [CatalogService, GeoService],
  exports: [CatalogService],
})
export class CatalogModule {}
