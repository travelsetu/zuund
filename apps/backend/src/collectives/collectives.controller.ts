import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  collectivesQuerySchema,
  createActivityRequestSchema,
  createCollectiveRequestSchema,
  createPollRequestSchema,
  joinCollectiveRequestSchema,
  pageQuerySchema,
  rsvpRequestSchema,
  shareFileRequestSchema,
  voteRequestSchema,
  type ActivityDto,
  type CollectiveDto,
  type CollectiveMemberDto,
  type CollectivesQuery,
  type CreateActivityRequest,
  type CreateCollectiveRequest,
  type CreatePollRequest,
  type JoinCollectiveRequest,
  type Page,
  type PageQuery,
  type PollDto,
  type RsvpRequest,
  type ShareFileRequest,
  type SharedFileDto,
  type VoteRequest,
} from '@zuund/shared';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentsService } from '../payments/payments.service';
import { ActivitiesService } from './activities.service';
import { CollectivesService } from './collectives.service';
import { PollsService } from './polls.service';
import { SharedFilesService } from './shared-files.service';

@Controller()
@UseGuards(JwtAccessGuard)
export class CollectivesController {
  constructor(
    private readonly collectives: CollectivesService,
    private readonly polls: PollsService,
    private readonly files: SharedFilesService,
    private readonly activities: ActivitiesService,
    private readonly payments: PaymentsService,
  ) {}

  // ── Collectives ──

  @Get('collectives')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(collectivesQuerySchema)) q: CollectivesQuery,
  ): Promise<Page<CollectiveDto>> {
    return this.collectives.list(user.userId, q);
  }

  @Post('collectives')
  async create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createCollectiveRequestSchema)) body: CreateCollectiveRequest,
  ): Promise<CollectiveDto> {
    const dto = await this.collectives.create(user.userId, body.buyingIntentId, body.name);
    return this.withFreePlace(user.userId, dto);
  }

  @Get('collectives/:id')
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<CollectiveDto> {
    return this.collectives.get(user.userId, id);
  }

  @Post('collectives/:id/join')
  async join(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(joinCollectiveRequestSchema)) body: JoinCollectiveRequest,
  ): Promise<CollectiveDto> {
    const dto = await this.collectives.join(user.userId, id, body.buyingIntentId);
    return this.withFreePlace(user.userId, dto);
  }

  /** Joining while a free place is open activates the membership at once, with no payment. */
  private async withFreePlace(userId: string, dto: CollectiveDto): Promise<CollectiveDto> {
    if (dto.membership?.status !== 'PENDING_PAYMENT') return dto;
    const claimed = await this.payments.claimFreePlace(userId, dto.membership.id);
    return claimed ? this.collectives.get(userId, dto.id) : dto;
  }

  @Post('collectives/:id/leave')
  @HttpCode(204)
  async leave(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    const { membership, refundPolicy } = await this.collectives.leave(user.userId, id);
    await this.payments.applyLeavePolicy(membership, refundPolicy);
  }

  @Get('collectives/:id/members')
  members(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<CollectiveMemberDto>> {
    return this.collectives.members(user.userId, id, q);
  }

  // ── Polls ──

  @Get('collectives/:id/polls')
  listPolls(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<PollDto>> {
    return this.polls.list(user.userId, id, q);
  }

  @Post('collectives/:id/polls')
  createPoll(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createPollRequestSchema)) body: CreatePollRequest,
  ): Promise<PollDto> {
    return this.polls.create(user.userId, id, body);
  }

  @Post('polls/:id/vote')
  vote(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(voteRequestSchema)) body: VoteRequest,
  ): Promise<PollDto> {
    return this.polls.vote(user.userId, id, body.optionIds);
  }

  @Post('polls/:id/close')
  closePoll(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PollDto> {
    return this.polls.close(user.userId, id);
  }

  // ── Shared files ──

  @Get('collectives/:id/files')
  listFiles(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<SharedFileDto>> {
    return this.files.list(user.userId, id, q);
  }

  @Post('collectives/:id/files')
  share(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(shareFileRequestSchema)) body: ShareFileRequest,
  ): Promise<SharedFileDto> {
    return this.files.share(user.userId, id, body);
  }

  @Delete('shared-files/:id')
  @HttpCode(204)
  removeShared(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.files.remove(user.userId, id);
  }

  // ── Activities ──

  @Get('collectives/:id/activities')
  listActivities(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<ActivityDto>> {
    return this.activities.list(user.userId, id, q);
  }

  @Post('collectives/:id/activities')
  createActivity(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(createActivityRequestSchema)) body: CreateActivityRequest,
  ): Promise<ActivityDto> {
    return this.activities.create(user.userId, id, body);
  }

  @Post('activities/:id/rsvp')
  rsvp(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(rsvpRequestSchema)) body: RsvpRequest,
  ): Promise<ActivityDto> {
    return this.activities.rsvp(user.userId, id, body.status);
  }

  @Post('activities/:id/cancel')
  cancelActivity(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ActivityDto> {
    return this.activities.cancel(user.userId, id);
  }
}
