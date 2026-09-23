import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { OtpSentResponse } from '@zuund/shared';
import { E } from '../common/domain.exception';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { OtpSender } from './otp.sender';

const TTL_SECONDS = 10 * 60;
const RESEND_SECONDS = 30;
const MAX_PER_HOUR = 5;
const MAX_ATTEMPTS = 5;

/**
 * One-time codes on WhatsApp that prove someone holds a mobile number. A new code
 * replaces the previous one; each code allows a few guesses and works once.
 */
@Injectable()
export class OtpService {
  private readonly logger = new Logger(OtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sender: OtpSender,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async send(phone: string): Promise<OtpSentResponse> {
    const hourAgo = new Date(Date.now() - 3600_000);
    const recent = await this.prisma.otpChallenge.findMany({
      where: { phone, createdAt: { gt: hourAgo } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, consumedAt: true },
    });
    // The wait only applies while the last code is still unused; after a sign-in, the
    // next one can go straight away.
    if (recent[0] && !recent[0].consumedAt) {
      const wait = Math.ceil(RESEND_SECONDS - (Date.now() - recent[0].createdAt.getTime()) / 1000);
      if (wait > 0) throw E.OTP_TOO_SOON(wait);
    }
    if (recent.length >= MAX_PER_HOUR) throw E.OTP_LIMIT();

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    // Only the newest code works.
    await this.prisma.otpChallenge.updateMany({
      where: { phone, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        phone,
        codeHash: this.hash(phone, code),
        expiresAt: new Date(Date.now() + TTL_SECONDS * 1000),
      },
    });
    try {
      await this.sender.send(phone, code);
    } catch {
      // Not delivered: don't count it against the number.
      await this.prisma.otpChallenge.delete({ where: { id: challenge.id } });
      throw E.OTP_SEND_FAILED();
    }
    return { expiresInSeconds: TTL_SECONDS, resendInSeconds: RESEND_SECONDS };
  }

  /**
   * Checks the code without using it up, so a caller can still refuse (say, an email that
   * is taken) and let the person fix it with the same code. Returns the challenge id.
   */
  async check(phone: string, code: string): Promise<string> {
    const challenge = await this.prisma.otpChallenge.findFirst({
      where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!challenge || challenge.attempts >= MAX_ATTEMPTS) throw E.OTP_INVALID();
    const expected = Buffer.from(challenge.codeHash, 'hex');
    const given = Buffer.from(this.hash(phone, code), 'hex');
    if (!timingSafeEqual(expected, given)) {
      await this.prisma.otpChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      this.logger.warn(`Wrong WhatsApp code for ${phone}`);
      throw E.OTP_INVALID();
    }
    return challenge.id;
  }

  /** Uses the code up. Fails if another request got there first. */
  async consume(challengeId: string): Promise<void> {
    const { count } = await this.prisma.otpChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (count !== 1) throw E.OTP_INVALID();
  }

  async verify(phone: string, code: string): Promise<void> {
    await this.consume(await this.check(phone, code));
  }

  private hash(phone: string, code: string): string {
    return createHmac('sha256', this.config.get('JWT_ACCESS_SECRET', { infer: true }))
      .update(`${phone}:${code}`)
      .digest('hex');
  }
}
