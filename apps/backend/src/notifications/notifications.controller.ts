import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { pageQuerySchema, type NotificationDto, type Page } from '@zuund/shared';
import { z } from 'zod';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { NotificationsService } from './notifications.service';

const listSchema = pageQuerySchema.extend({ unreadOnly: z.coerce.boolean().default(false) });

@Controller('notifications')
@UseGuards(JwtAccessGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(listSchema)) q: z.infer<typeof listSchema>,
  ): Promise<Page<NotificationDto>> {
    return this.notifications.list(user.userId, q);
  }

  @Get('unread-count')
  async unread(@CurrentUser() user: RequestUser): Promise<{ count: number }> {
    return { count: await this.notifications.unreadCount(user.userId) };
  }

  @Post(':id/read')
  @HttpCode(204)
  markRead(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    return this.notifications.markRead(user.userId, id);
  }

  @Post('read-all')
  @HttpCode(204)
  markAll(@CurrentUser() user: RequestUser): Promise<void> {
    return this.notifications.markAllRead(user.userId);
  }
}
