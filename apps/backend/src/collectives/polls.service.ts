import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { E } from '../common/domain.exception';
import type { CreatePollRequest, Page, PageQuery, PollDto } from '@zuund/shared';
import { toPublicUser } from '../common/mappers';
import { afterCursor, cursorOrder, decodeCursor, toPage } from '../common/pagination';
import type { Prisma } from '../generated/prisma/client';
import { NotificationsService } from '../notifications/notifications.service';
import { AuditService } from '../common/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { CollectivesService } from './collectives.service';

const pollInclude = {
  creator: { include: { profile: { include: { city: true } } } },
  options: { orderBy: { sortOrder: 'asc' as const } },
  votes: { select: { optionId: true, userId: true } },
} as const;
type PollRow = Prisma.PollGetPayload<{ include: typeof pollInclude }>;

@Injectable()
export class PollsService {
  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly collectives: CollectivesService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, collectiveId: string, input: CreatePollRequest): Promise<PollDto> {
    const { collective } = await this.collectives.requireActiveMember(collectiveId, userId);
    if (input.expiresAt && new Date(input.expiresAt) <= new Date())
      throw new BadRequestException('expiresAt must be in the future');
    const row = await this.prisma.poll.create({
      data: {
        collectiveId,
        creatorId: userId,
        question: input.question,
        multipleChoice: input.multipleChoice,
        allowVoteChange: input.allowVoteChange,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        options: { create: input.options.map((label, i) => ({ label, sortOrder: i })) },
      },
      include: pollInclude,
    });
    const others = await this.collectives.activeMemberIds(collectiveId, userId);
    await this.notifications.notifyMany(
      others.map((uid) => ({
        userId: uid,
        type: 'NEW_POLL' as const,
        title: `New poll in ${collective.name}`,
        body: input.question,
        data: { collectiveId, pollId: row.id },
      })),
    );
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'POLL_CREATED',
      targetType: 'Poll',
      targetId: row.id,
      metadata: { collectiveId },
    });
    return this.toDto(row, userId);
  }

  async list(userId: string, collectiveId: string, q: PageQuery): Promise<Page<PollDto>> {
    await this.collectives.requireActiveMember(collectiveId, userId);
    const rows = await this.prisma.poll.findMany({
      where: { collectiveId, ...afterCursor(decodeCursor(q.cursor)) },
      include: pollInclude,
      orderBy: cursorOrder,
      take: q.limit + 1,
    });
    return toPage(rows, q.limit, (r) => this.toDto(r, userId));
  }

  /**
   * Single-choice: exactly one option, one vote per user, no change unless
   * the poll allows it. Multiple-choice: replaces the user's set of options
   * when changes are allowed, otherwise only a first vote is accepted. All
   * of it in one transaction so two quick clicks cannot both land.
   */
  async vote(userId: string, pollId: string, optionIds: string[]): Promise<PollDto> {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId }, include: pollInclude });
    if (!poll) throw new NotFoundException('Poll not found');
    await this.collectives.requireActiveMember(poll.collectiveId, userId);
    if (poll.status !== 'ACTIVE' || (poll.expiresAt && poll.expiresAt <= new Date()))
      throw E.POLL_CLOSED();

    const unique = [...new Set(optionIds)];
    if (!poll.multipleChoice && unique.length !== 1)
      throw E.INVALID_VOTE('Choose exactly one option');
    const valid = new Set(poll.options.map((o) => o.id));
    if (!unique.every((id) => valid.has(id))) throw E.INVALID_VOTE('Unknown option');

    await this.prisma.$transaction(async (tx) => {
      // Serialise votes per poll: two simultaneous single-choice votes from one
      // user would otherwise both pass the "already voted" check.
      await tx.$queryRaw`SELECT id FROM polls WHERE id = ${pollId} FOR UPDATE`;
      const existing = await tx.pollVote.findMany({ where: { pollId, userId } });
      if (existing.length > 0) {
        if (!poll.allowVoteChange) throw E.ALREADY_VOTED();
        await tx.pollVote.deleteMany({ where: { pollId, userId } });
      }
      await tx.pollVote.createMany({
        data: unique.map((optionId) => ({ pollId, optionId, userId })),
      });
    });
    const fresh = await this.prisma.poll.findUniqueOrThrow({
      where: { id: pollId },
      include: pollInclude,
    });
    await this.audit.log({
      actorId: userId,
      actorType: 'USER',
      action: 'POLL_VOTED',
      targetType: 'Poll',
      targetId: pollId,
      metadata: { optionIds: unique },
    });
    return this.toDto(fresh, userId);
  }

  async close(userId: string, pollId: string): Promise<PollDto> {
    const poll = await this.prisma.poll.findUnique({ where: { id: pollId }, include: pollInclude });
    if (!poll) throw new NotFoundException('Poll not found');
    await this.collectives.requireActiveMember(poll.collectiveId, userId);
    if (poll.creatorId !== userId) throw E.NOT_CREATOR('poll');
    const row = await this.prisma.poll.update({
      where: { id: pollId },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: pollInclude,
    });
    return this.toDto(row, userId);
  }

  private toDto(r: PollRow, viewerId: string): PollDto {
    const mine = new Set(r.votes.filter((v) => v.userId === viewerId).map((v) => v.optionId));
    return {
      id: r.id,
      collectiveId: r.collectiveId,
      creator: toPublicUser(r.creator),
      question: r.question,
      multipleChoice: r.multipleChoice,
      allowVoteChange: r.allowVoteChange,
      status: r.status,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      closedAt: r.closedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      options: r.options.map((o) => ({
        id: o.id,
        label: o.label,
        sortOrder: o.sortOrder,
        voteCount: r.votes.filter((v) => v.optionId === o.id).length,
        voted: mine.has(o.id),
      })),
      totalVotes: new Set(r.votes.map((v) => v.userId)).size,
    };
  }
}
