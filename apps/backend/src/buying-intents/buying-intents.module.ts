import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { BuyingIntentsController } from './buying-intents.controller';
import { BuyingIntentsService } from './buying-intents.service';

@Module({
  imports: [AuthModule, CatalogModule],
  controllers: [BuyingIntentsController],
  providers: [BuyingIntentsService],
  exports: [BuyingIntentsService],
})
export class BuyingIntentsModule {}
