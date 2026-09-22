import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env';
import { ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_COOKIE_PATH } from './auth.constants';

/** Centralises how auth cookies are written and cleared so the flags never drift. */
@Injectable()
export class AuthCookies {
  constructor(private readonly config: ConfigService<Env, true>) {}

  private base(): CookieOptions {
    return {
      httpOnly: true,
      sameSite: 'lax',
      secure: this.config.get('COOKIE_SECURE', { infer: true }),
      domain: this.config.get('COOKIE_DOMAIN', { infer: true }),
    };
  }

  set(res: Response, tokens: { accessToken: string; refreshToken: string }) {
    res.cookie(ACCESS_COOKIE, tokens.accessToken, {
      ...this.base(),
      path: '/',
      maxAge: this.config.get('JWT_ACCESS_TTL', { infer: true }) * 1000,
    });
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
      ...this.base(),
      path: REFRESH_COOKIE_PATH,
      maxAge: this.config.get('JWT_REFRESH_TTL', { infer: true }) * 1000,
    });
  }

  clear(res: Response) {
    res.clearCookie(ACCESS_COOKIE, { ...this.base(), path: '/' });
    res.clearCookie(REFRESH_COOKIE, { ...this.base(), path: REFRESH_COOKIE_PATH });
  }
}
