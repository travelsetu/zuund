import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { E } from '../common/domain.exception';
import type {
  ActivityDto,
  CreateActivityRequest,
  Page,
  PageQuery,
  ParticipantStatus,
} from '@zuund/shared';
import { eliteUserIds } from '../common/entitlements';
import { toPublicUser } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollectivesService } from './collectives.service';

const include = {
  creator: { include: { profile: { include: { city: true } } } },
  participants: true,
} as const;
type Row = Prisma.ActivityGetPayload<{ include: typeof include }>;

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly collectives: CollectivesService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(
    userId: string,
    collectiveId: string,
    input: CreateActivityRequest,
  ): Promise<ActivityDto> {
    const { collective } = await this.collectives.requireActiveMember(collectiveId, userId);
    const row = await this.prisma.activity.create({
      data: {
        collectiveId,
        creatorId: userId,
        title: input.title,
        description: input.description,
        type: input.type,
        date: new Date(`${input.date}T00:00:00.000Z`),
        startTime: input.startTime,
        endTime: input.endTime,
        meetingLink: input.meetingLink,
        location: input.location,
        participants: { create: { userId, status: 'GOING' } },
      },
      include,
    });
    const others = await this.collectives.activeMemberIds(collectiveId, userId);
    await this.notifications.notifyMany(
      others.map((uid) => ({
        userId: uid,
        type: 'NEW_ACTIVITY' as const,
        title: `New activity in ${collective.name}`,
        body: `${input.title} on ${input.date} at ${input.startTime}`,
        data: { collectiveId, activityId: row.id },
      })),
    );
    return this.one(row, userId);
  }

  async list(userId: string, collectiveId: string, q: PageQuery): Promise<Page<ActivityDto>> {
    await this.collectives.requireActiveMember(collectiveId, userId);
    const rows = await this.prisma.activity.findMany({
      where: { collectiveId, ...afterCursor(decodeCursor(q.cursor)) },
      include,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    const elite = await eliteUserIds(
      this.prisma,
      rows.map((r) => r.creatorId),
    );
    return toPage(rows, q.limit, (r) => this.toDto(r, userId, elite));
  }

  async rsvp(userId: string, activityId: string, status: ParticipantStatus): Promise<ActivityDto> {
    const a = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!a) throw new NotFoundException('Activity not found');
    await this.collectives.requireActiveMember(a.collectiveId, userId);
    await this.prisma.activityParticipant.upsert({
      where: { activityId_userId: { activityId, userId } },
      create: { activityId, userId, status },
      update: { status },
    });
    return this.one(
      await this.prisma.activity.findUniqueOrThrow({ where: { id: activityId }, include }),
      userId,
    );
  }

  async cancel(userId: string, activityId: string): Promise<ActivityDto> {
    const a = await this.prisma.activity.findUnique({ where: { id: activityId } });
    if (!a) throw new NotFoundException('Activity not found');
    await this.collectives.requireActiveMember(a.collectiveId, userId);
    if (a.creatorId !== userId) throw E.NOT_CREATOR('activity');
    return this.one(
      await this.prisma.activity.update({
        where: { id: activityId },
        data: { status: 'CANCELLED' },
        include,
      }),
      userId,
    );
  }

  /** One item: works out whether its creator holds an Elite Pass (the 👑). */
  private async one(r: Row, viewerId: string): Promise<ActivityDto> {
    return this.toDto(r, viewerId, await eliteUserIds(this.prisma, [r.creatorId]));
  }

  private toDto(r: Row, viewerId: string, elite?: Set<string>): ActivityDto {
    return {
      id: r.id,
      collectiveId: r.collectiveId,
      creator: toPublicUser(r.creator, { elite }),
      title: r.title,
      description: r.description,
      type: r.type,
      date: r.date.toISOString().slice(0, 10),
      startTime: r.startTime,
      endTime: r.endTime,
      meetingLink: r.meetingLink,
      location: r.location,
      status: r.status,
      goingCount: r.participants.filter((p) => p.status === 'GOING').length,
      myStatus: r.participants.find((p) => p.userId === viewerId)?.status ?? null,
      createdAt: r.createdAt.toISOString(),
    };
  }
}
