import { createHash, randomUUID } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { AuthUser } from '@jhoond/shared';
import type { Env } from '../config/env';
import type { User } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { AccessTokenPayload, RefreshTokenPayload } from './auth.constants';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Hash of a random secret, verified against when the email is unknown to equalise timing. */
  private readonly dummyHash: Promise<string> = argon2.hash(randomUUID(), {
    type: argon2.argon2id,
  });

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.users.findByEmail(email);
    // Always run a hash verification so response time doesn't reveal whether the email exists.
    const hash = user?.passwordHash ?? (await this.dummyHash);
    const ok = await argon2.verify(hash, password).catch(() => false);
    if (!user || !ok) {
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.issueSession(user);
  }

  /**
   * Rotates a refresh token: the presented token is revoked and a fresh pair is issued.
   * If a token that was already revoked is presented, we assume it leaked and kill every
   * session for that user.
   */
  async refresh(rawRefreshToken: string): Promise<AuthResult> {
    const payload = await this.jwt
      .verifyAsync<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
      })
      .catch(() => null);
    if (!payload || payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const stored = await this.prisma.refreshToken.findUnique({ where: { id: payload.jti } });
    if (!stored || stored.tokenHash !== hashToken(rawRefreshToken)) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (stored.revokedAt) {
      this.logger.warn(
        `Reuse of revoked refresh token ${stored.id}; revoking all sessions for user ${stored.userId}`,
      );
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Refresh token has been revoked');
    }
    if (stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.users.findById(stored.userId);
    if (!user) throw new UnauthorizedException('User no longer exists');

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    return this.issueSession(user);
  }

  /** Best-effort logout: revokes the session behind the refresh cookie, if any. */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const payload = await this.jwt
      .verifyAsync<RefreshTokenPayload>(rawRefreshToken, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        ignoreExpiration: true,
      })
      .catch(() => null);
    if (!payload?.jti) return;
    await this.prisma.refreshToken.updateMany({
      where: { id: payload.jti, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException();
    return this.users.toAuthUser(user);
  }

  private async issueSession(user: User): Promise<AuthResult> {
    const refreshTtl = this.config.get('JWT_REFRESH_TTL', { infer: true });
    const jti = randomUUID();

    const accessPayload: AccessTokenPayload = { sub: user.id, email: user.email, type: 'access' };
    const refreshPayload: RefreshTokenPayload = { sub: user.id, jti, type: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(accessPayload, {
        secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
      }),
      this.jwt.signAsync(refreshPayload, {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: refreshTtl,
      }),
    ]);

    await this.prisma.refreshToken.create({
      data: {
        id: jti,
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
      },
    });

    return { user: this.users.toAuthUser(user), tokens: { accessToken, refreshToken } };
  }

  private async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
