import {
  Body,
  Controller,
  Get,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  adminAuditQuerySchema,
  adminCollectiveActionSchema,
  adminCollectivesQuerySchema,
  adminIntentsQuerySchema,
  adminPassesQuerySchema,
  adminPaymentsQuerySchema,
  adminRefundSchema,
  adminReportActionSchema,
  adminReportsQuerySchema,
  adminUserActionSchema,
  adminUsersQuerySchema,
} from '@zuund/shared';
import { z } from 'zod';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { AdminService } from './admin.service';

const closeSchema = z.object({ note: z.string().trim().max(500).optional() });

/** Every route here requires a valid session AND the ADMIN role, checked server-side. */
@Controller('admin')
@UseGuards(JwtAccessGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  /** Cities with at least one buying post, for the list filters (the full catalog is ~32k). */
  @Get('cities-in-use')
  citiesInUse() {
    return this.admin.citiesInUse();
  }

  // Users
  @Get('users')
  users(
    @Query(new ZodValidationPipe(adminUsersQuerySchema)) q: z.infer<typeof adminUsersQuerySchema>,
  ) {
    return this.admin.users(q);
  }
  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.user(id);
  }
  @Post('users/:id/action')
  userAction(
    @CurrentUser() actor: RequestUser,
    @Ip() ip: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminUserActionSchema)) body: z.infer<typeof adminUserActionSchema>,
  ) {
    return this.admin.userAction({ userId: actor.userId, ip }, id, body.action, body.note);
  }

  // Buying intents
  @Get('buying-intents')
  intents(
    @Query(new ZodValidationPipe(adminIntentsQuerySchema))
    q: z.infer<typeof adminIntentsQuerySchema>,
  ) {
    return this.admin.intents(q);
  }
  @Get('buying-intents/:id')
  intent(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.intent(id);
  }
  @Post('buying-intents/:id/close')
  closeIntent(
    @CurrentUser() actor: RequestUser,
    @Ip() ip: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(closeSchema)) body: z.infer<typeof closeSchema>,
  ) {
    return this.admin.closeIntent({ userId: actor.userId, ip }, id, body.note);
  }

  // Collectives
  @Get('collectives')
  collectives(
    @Query(new ZodValidationPipe(adminCollectivesQuerySchema))
    q: z.infer<typeof adminCollectivesQuerySchema>,
  ) {
    return this.admin.collectives(q);
  }
  @Get('collectives/:id')
  collective(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.collective(id);
  }
  @Post('collectives/:id/action')
  collectiveAction(
    @CurrentUser() actor: RequestUser,
    @Ip() ip: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminCollectiveActionSchema))
    body: z.infer<typeof adminCollectiveActionSchema>,
  ) {
    return this.admin.collectiveAction({ userId: actor.userId, ip }, id, body.action, body.note);
  }

  // Payments & passes
  @Get('payments')
  payments(
    @Query(new ZodValidationPipe(adminPaymentsQuerySchema))
    q: z.infer<typeof adminPaymentsQuerySchema>,
  ) {
    return this.admin.paymentsList(q);
  }
  @Get('payments/:id')
  payment(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.payment(id);
  }
  @Post('payments/:id/refund')
  refund(
    @CurrentUser() actor: RequestUser,
    @Ip() ip: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminRefundSchema)) body: z.infer<typeof adminRefundSchema>,
  ) {
    return this.admin.refund({ userId: actor.userId, ip }, id, body.amount, body.note);
  }
  @Get('buying-passes')
  passes(
    @Query(new ZodValidationPipe(adminPassesQuerySchema)) q: z.infer<typeof adminPassesQuerySchema>,
  ) {
    return this.admin.passes(q);
  }

  // Reports
  @Get('reports')
  reports(
    @Query(new ZodValidationPipe(adminReportsQuerySchema))
    q: z.infer<typeof adminReportsQuerySchema>,
  ) {
    return this.admin.reports(q);
  }
  @Post('reports/:id/action')
  @HttpCode(204)
  reportAction(
    @CurrentUser() actor: RequestUser,
    @Ip() ip: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(adminReportActionSchema))
    body: z.infer<typeof adminReportActionSchema>,
  ) {
    return this.admin.reportAction({ userId: actor.userId, ip }, id, body.action, body.note);
  }

  // Audit
  @Get('audit-logs')
  audit(
    @Query(new ZodValidationPipe(adminAuditQuerySchema)) q: z.infer<typeof adminAuditQuerySchema>,
  ) {
    return this.admin.auditLogs(q);
  }
}
