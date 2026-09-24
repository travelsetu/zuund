import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  buyerDiscoveryQuerySchema,
  buyingIntentStatusActionSchema,
  changeIntentLevelRequestSchema,
  createBuyingIntentRequestSchema,
  pageQuerySchema,
  updateBuyingIntentRequestSchema,
  type BuyerCountDto,
  type BuyerDiscoveryDto,
  type BuyerDiscoveryQuery,
  type BuyingIntentDto,
  type BuyingIntentStatusAction,
  type ChangeIntentLevelRequest,
  type CreateBuyingIntentRequest,
  type IntentHistoryDto,
  type Page,
  type UpdateBuyingIntentRequest,
} from '@zuund/shared';
import { z } from 'zod';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { BuyingIntentsService } from './buying-intents.service';

const mineQuery = pageQuerySchema.extend({
  status: z.enum(['ACTIVE', 'PAUSED', 'CLOSED', 'EXPIRED']).optional(),
});
const countQuery = z.object({ carId: z.uuid(), cityId: z.uuid() });

@Controller()
@UseGuards(JwtAccessGuard)
export class BuyingIntentsController {
  constructor(private readonly intents: BuyingIntentsService) {}

  @Post('buying-intents')
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createBuyingIntentRequestSchema)) body: CreateBuyingIntentRequest,
  ): Promise<BuyingIntentDto> {
    return this.intents.create(user.userId, body);
  }

  @Get('buying-intents')
  mine(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(mineQuery)) q: z.infer<typeof mineQuery>,
  ): Promise<Page<BuyingIntentDto>> {
    return this.intents.listMine(user.userId, q);
  }

  @Get('buying-intents/:id')
  one(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BuyingIntentDto> {
    return this.intents.getOwned(user.userId, id);
  }

  @Patch('buying-intents/:id')
  update(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(updateBuyingIntentRequestSchema)) body: UpdateBuyingIntentRequest,
  ): Promise<BuyingIntentDto> {
    return this.intents.updateTimeline(user.userId, id, body.purchaseTimeline);
  }

  @Post('buying-intents/:id/intent-level')
  changeLevel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(changeIntentLevelRequestSchema)) body: ChangeIntentLevelRequest,
  ): Promise<BuyingIntentDto> {
    return this.intents.changeLevel(user.userId, id, body.intentLevel);
  }

  @Get('buying-intents/:id/history')
  history(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IntentHistoryDto[]> {
    return this.intents.history(user.userId, id);
  }

  @Post('buying-intents/:id/status')
  transition(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(buyingIntentStatusActionSchema)) body: BuyingIntentStatusAction,
  ): Promise<BuyingIntentDto> {
    return this.intents.transition(user.userId, id, body.action);
  }

  /** Buyer discovery: same car, same city, other people. */
  @Get('buyers')
  discover(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(buyerDiscoveryQuerySchema)) q: BuyerDiscoveryQuery,
  ): Promise<BuyerDiscoveryDto> {
    return this.intents.discover(user.userId, q);
  }

  @Get('buyers/count')
  async count(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(countQuery)) q: z.infer<typeof countQuery>,
  ): Promise<BuyerCountDto> {
    const [count, members] = await Promise.all([
      this.intents.countBuyers(q.carId, q.cityId, user.userId),
      this.intents.memberBreakdown(q.carId, q.cityId),
    ]);
    return { count, members };
  }
}
