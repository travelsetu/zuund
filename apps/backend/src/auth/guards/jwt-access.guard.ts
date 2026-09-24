import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { E } from '../../common/domain.exception';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_COOKIE, type AccessTokenPayload, type RequestUser } from '../auth.constants';

/** How stale lastActiveAt may get before a request refreshes it. */
const ACTIVITY_WRITE_EVERY_MS = 5 * 60_000;

/**
 * Reads the access token from the httpOnly cookie (or, for non-browser
 * clients such as the mobile app, an `Authorization: Bearer` header),
 * checks the account is still allowed in, and attaches `req.user`. Also keeps
 * users.lastActiveAt fresh (at most one write per user every 5 minutes) for
 * "active in the last 48 hours".
 */
@Injectable()
export class JwtAccessGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const token = (req.cookies?.[ACCESS_COOKIE] as string | undefined) ?? bearer;
    if (!token) throw new UnauthorizedException('Not authenticated');

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      });
    } catch {
      throw new UnauthorizedException('Session expired');
    }
    if (payload.type !== 'access') throw new UnauthorizedException('Invalid token');

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true, status: true, lastActiveAt: true },
    });
    if (!user) throw new UnauthorizedException('Account no longer exists');
    if (user.status !== 'ACTIVE') throw E.ACCOUNT_NOT_ACTIVE();

    const now = new Date();
    if (!user.lastActiveAt || now.getTime() - user.lastActiveAt.getTime() > ACTIVITY_WRITE_EVERY_MS)
      // Best effort: never fail or slow the request for it.
      void this.prisma.user
        .updateMany({
          where: {
            id: user.id,
            OR: [
              { lastActiveAt: null },
              { lastActiveAt: { lt: new Date(now.getTime() - ACTIVITY_WRITE_EVERY_MS) } },
            ],
          },
          data: { lastActiveAt: now },
        })
        .catch(() => undefined);

    req.user = { userId: user.id, email: user.email, role: user.role };
    return true;
  }
}
