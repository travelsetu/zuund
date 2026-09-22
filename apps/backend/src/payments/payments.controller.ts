import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  createPaymentRequestSchema,
  pageQuerySchema,
  verifyPaymentRequestSchema,
  type BuyingPassDto,
  type CreatePaymentRequest,
  type Page,
  type PageQuery,
  type PaymentCheckoutDto,
  type PaymentDto,
  type VerifyPaymentRequest,
} from '@zuund/shared';
import type { Request } from 'express';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { RequestUser } from '../auth/auth.constants';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { PaymentsService } from './payments.service';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('payments')
  @UseGuards(JwtAccessGuard)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  create(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(createPaymentRequestSchema)) body: CreatePaymentRequest,
  ): Promise<PaymentCheckoutDto> {
    return this.payments.create(user.userId, body);
  }

  @Post('payments/verify')
  @UseGuards(JwtAccessGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  verify(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(verifyPaymentRequestSchema)) body: VerifyPaymentRequest,
  ): Promise<PaymentDto> {
    return this.payments.verify(user.userId, body);
  }

  /** Provider → us. No session; authenticated by the provider's signature over the raw body. */
  @Post('payments/webhook')
  @HttpCode(200)
  @SkipThrottle()
  async webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ): Promise<{ ok: true }> {
    await this.payments.handleWebhook(
      req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})),
      headers,
    );
    return { ok: true };
  }

  @Get('payments')
  @UseGuards(JwtAccessGuard)
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<PaymentDto>> {
    return this.payments.listMine(user.userId, q);
  }

  @Get('payments/:id')
  @UseGuards(JwtAccessGuard)
  get(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<PaymentDto> {
    return this.payments.getMine(user.userId, id);
  }

  @Get('buying-passes')
  @UseGuards(JwtAccessGuard)
  passes(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(pageQuerySchema)) q: PageQuery,
  ): Promise<Page<BuyingPassDto>> {
    return this.payments.listMyPasses(user.userId, q);
  }

  @Get('buying-passes/:id')
  @UseGuards(JwtAccessGuard)
  pass(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<BuyingPassDto> {
    return this.payments.getMyPass(user.userId, id);
  }
}
