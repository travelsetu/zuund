import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { BuyingIntentsModule } from './buying-intents/buying-intents.module';
import { CatalogModule } from './catalog/catalog.module';
import { CollectivesModule } from './collectives/collectives.module';
import { AuditModule } from './common/audit.service';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { validateEnv } from './config/env';
import { ConnectionsModule } from './connections/connections.module';
import { ConversationsModule } from './conversations/conversations.module';
import { FilesModule } from './files/files.module';
import { HealthController } from './health/health.controller';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
      // Look for .env next to this app first, then fall back to the repo root.
      envFilePath: ['.env', '../../.env'],
    }),
    // Generous global ceiling; sensitive routes set tighter limits with @Throttle.
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60_000, limit: 300 }],
      // The test suite drives hundreds of requests from one IP.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    AuditModule,
    NotificationsModule,
    UsersModule,
    AuthModule,
    CatalogModule,
    FilesModule,
    BuyingIntentsModule,
    ConnectionsModule,
    ConversationsModule,
    PaymentsModule,
    CollectivesModule,
    ReportsModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
