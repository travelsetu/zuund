import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { E } from '../common/domain.exception';
import type { CreateReportRequest, Page, PageQuery, ReportDto } from '@zuund/shared';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Report } from '../generated/prisma/client';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  async create(reporterId: string, input: CreateReportRequest): Promise<ReportDto> {
    const reportedUserId = await this.ownerOf(input.targetType, input.targetId);
    if (reportedUserId === reporterId) throw E.SELF_ACTION('You cannot report yourself');
    const row = await this.prisma.report.create({
      data: {
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reportedUserId,
        reason: input.reason,
        details: input.details,
      },
    });
    await this.audit.log({
      actorId: reporterId,
      actorType: 'USER',
      action: 'REPORT_CREATED',
      targetType: 'Report',
      targetId: row.id,
      metadata: { targetType: input.targetType, targetId: input.targetId },
    });
    return toReport(row);
  }

  async listMine(reporterId: string, q: PageQuery): Promise<Page<ReportDto>> {
    const rows = await this.prisma.report.findMany({
      where: { reporterId, ...afterCursor(decodeCursor(q.cursor)) },
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, toReport);
  }

  /** Resolves the user a target belongs to, and confirms the target exists. */
  private async ownerOf(
    type: CreateReportRequest['targetType'],
    id: string,
  ): Promise<string | null> {
    switch (type) {
      case 'USER': {
        const u = await this.prisma.user.findUnique({ where: { id }, select: { id: true } });
        if (!u) throw new NotFoundException('User not found');
        return u.id;
      }
      case 'MESSAGE': {
        const m = await this.prisma.message.findUnique({
          where: { id },
          select: { senderId: true },
        });
        if (!m) throw new NotFoundException('Message not found');
        return m.senderId;
      }
      case 'SHARED_FILE': {
        const f = await this.prisma.sharedFile.findUnique({
          where: { id },
          select: { sharerId: true },
        });
        if (!f) throw new NotFoundException('File not found');
        return f.sharerId;
      }
      case 'POLL': {
        const p = await this.prisma.poll.findUnique({ where: { id }, select: { creatorId: true } });
        if (!p) throw new NotFoundException('Poll not found');
        return p.creatorId;
      }
      case 'COLLECTIVE': {
        const c = await this.prisma.collective.findUnique({
          where: { id },
          select: { creatorId: true },
        });
        if (!c) throw new NotFoundException('Collective not found');
        return c.creatorId;
      }
    }
  }
}

export function toReport(r: Report): ReportDto {
  return {
    id: r.id,
    reporterId: r.reporterId,
    targetType: r.targetType,
    targetId: r.targetId,
    reportedUserId: r.reportedUserId,
    reason: r.reason,
    details: r.details,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
  };
}
