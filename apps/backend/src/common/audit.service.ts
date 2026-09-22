import { Global, Injectable, Logger, Module } from '@nestjs/common';
import type { ActorType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  actorId: string;
  /** ADMIN (console action), USER (own action), SYSTEM (job or provider event; actorId = affected user). */
  actorType?: ActorType;
  action: string;
  targetType: string;
  targetId?: string | null;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
}

/**
 * Records who did what, and writes a structured log line so the events are
 * visible in pm2 logs without a database query. Never logs secrets or
 * payment credentials; callers pass ids and amounts only.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger('Audit');

  constructor(private readonly prisma: PrismaService) {}

  log(entry: AuditEntry, tx?: Prisma.TransactionClient) {
    const client = tx ?? this.prisma;
    this.logger.log(
      `${entry.action} actor=${entry.actorId}(${entry.actorType ?? 'ADMIN'}) ${entry.targetType}${entry.targetId ? '#' + entry.targetId : ''}`,
    );
    return client.auditLog.create({
      data: {
        actorId: entry.actorId,
        actorType: entry.actorType ?? 'ADMIN',
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId ?? null,
        metadata: entry.metadata,
        ipAddress: entry.ipAddress ?? null,
      },
    });
  }
}

@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class AuditModule {}
