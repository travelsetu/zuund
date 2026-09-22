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
  openDirectConversationRequestSchema,
  pageQuerySchema,
  reactRequestSchema,
  sendMessageRequestSchema,
  type ConversationDto,
  type MessageDto,
  type OpenDirectConversationRequest,
  type Page,
  type PageQuery,
  type ReactRequest,
  type SendMessageRequest,
} from '@zuund/shared';
import { Throttle } from '@nestjs/throttler';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConversationsService } from './conversations.service';

@Controller()
@UseGuards(JwtAccessGuard)
export class ConversationsController {
  constructor(private readonly conversations: ConversationsService) {}

  @Get('conversations')
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<ConversationDto>> {
    return this.conversations.list(user.userId, q);
  }

  /** Opens (or returns the existing) direct conversation with a connected buyer. */
  @Post('conversations/direct')
  openDirect(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(openDirectConversationRequestSchema))
    body: OpenDirectConversationRequest,
  ): Promise<ConversationDto> {
    return this.conversations.openDirect(user.userId, body.userId);
  }

  @Get('conversations/:id')
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConversationDto> {
    return this.conversations.get(user.userId, id);
  }

  @Get('conversations/:id/messages')
  messages(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<MessageDto>> {
    return this.conversations.messages(user.userId, id, q);
  }

  @Post('conversations/:id/messages')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  send(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(sendMessageRequestSchema)) body: SendMessageRequest,
  ): Promise<MessageDto> {
    return this.conversations.send(user.userId, id, body);
  }

  @Post('conversations/:id/read')
  @HttpCode(204)
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.conversations.markRead(user.userId, id);
  }

  /** Toggles the viewer's reaction. */
  @Post('messages/:id/reactions')
  @HttpCode(204)
  react(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(reactRequestSchema)) body: ReactRequest,
  ): Promise<void> {
    return this.conversations.react(user.userId, id, body.emoji);
  }

  @Delete('messages/:id')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.conversations.deleteOwn(user.userId, id);
  }
}
