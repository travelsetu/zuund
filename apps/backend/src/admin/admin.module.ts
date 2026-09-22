import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReportsModule } from '../reports/reports.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [AuthModule, PaymentsModule, ReportsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
