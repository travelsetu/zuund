import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import {
  createReportRequestSchema,
  pageQuerySchema,
  type CreateReportRequest,
  type Page,
  type PageQuery,
  type ReportDto,
} from '@zuund/shared';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ReportsService } from './reports.service';

@Controller('reports')
@UseGuards(JwtAccessGuard)
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post()
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createReportRequestSchema)) body: CreateReportRequest,
  ): Promise<ReportDto> {
    return this.reports.create(user.userId, body);
  }

  @Get()
  mine(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<ReportDto>> {
    return this.reports.listMine(user.userId, q);
  }
}
