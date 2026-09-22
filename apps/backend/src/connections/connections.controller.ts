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
  blockUserRequestSchema,
  connectionsQuerySchema,
  createConnectionRequestSchema,
  type BlockUserRequest,
  type ConnectionDto,
  type ConnectionsQuery,
  type CreateConnectionRequest,
  type Page,
} from '@zuund/shared';
import { Throttle } from '@nestjs/throttler';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConnectionsService } from './connections.service';

@Controller('connections')
@UseGuards(JwtAccessGuard)
export class ConnectionsController {
  constructor(private readonly connections: ConnectionsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(connectionsQuerySchema)) q: ConnectionsQuery,
  ): Promise<Page<ConnectionDto>> {
    return this.connections.list(user.userId, q);
  }

  @Post()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  request(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createConnectionRequestSchema)) body: CreateConnectionRequest,
  ): Promise<ConnectionDto> {
    return this.connections.request(user.userId, body.userId);
  }

  @Post(':id/accept')
  accept(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConnectionDto> {
    return this.connections.accept(user.userId, id);
  }

  @Post(':id/reject')
  reject(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConnectionDto> {
    return this.connections.reject(user.userId, id);
  }

  @Delete(':id')
  cancel(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ConnectionDto> {
    return this.connections.cancel(user.userId, id);
  }

  @Post('block')
  @HttpCode(204)
  block(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(blockUserRequestSchema)) body: BlockUserRequest,
  ): Promise<void> {
    return this.connections.block(user.userId, body.userId);
  }

  @Post('unblock')
  @HttpCode(204)
  unblock(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(blockUserRequestSchema)) body: BlockUserRequest,
  ): Promise<void> {
    return this.connections.unblock(user.userId, body.userId);
  }
}
