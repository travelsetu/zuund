import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { PaymentsModule } from '../payments/payments.module';
import { ActivitiesService } from './activities.service';
import { CollectivesController } from './collectives.controller';
import { CollectivesService } from './collectives.service';
import { PollsService } from './polls.service';
import { SharedFilesService } from './shared-files.service';

@Module({
  imports: [AuthModule, FilesModule, forwardRef(() => PaymentsModule)],
  controllers: [CollectivesController],
  providers: [CollectivesService, PollsService, SharedFilesService, ActivitiesService],
  exports: [CollectivesService],
})
export class CollectivesModule {}
