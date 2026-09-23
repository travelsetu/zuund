import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CatalogModule } from '../catalog/catalog.module';
import { CollectivesModule } from '../collectives/collectives.module';
import { PaymentsModule } from '../payments/payments.module';
import { BuyingIntentsController } from './buying-intents.controller';
import { BuyingIntentsService } from './buying-intents.service';

@Module({
  imports: [AuthModule, CatalogModule, CollectivesModule, PaymentsModule],
  controllers: [BuyingIntentsController],
  providers: [BuyingIntentsService],
  exports: [BuyingIntentsService],
})
export class BuyingIntentsModule {}
