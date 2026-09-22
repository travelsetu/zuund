import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import {
  changePasswordRequestSchema,
  loginRequestSchema,
  registerRequestSchema,
  type AuthResponse,
  type ChangePasswordRequest,
  type LoginRequest,
  type RegisterRequest,
} from '@zuund/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { REFRESH_COOKIE, type RequestUser } from './auth.constants';
import { AuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.login(body.email, body.password);
    this.cookies.set(res, tokens);
    return { user };
  }

  @Post('register')
  @HttpCode(201)
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(
    @Body(new ZodValidationPipe(registerRequestSchema)) body: RegisterRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.register(body);
    this.cookies.set(res, tokens);
    return { user };
  }

  /**
   * Same as login, but returns the tokens in the body instead of cookies, for
   * clients without a cookie jar (the React Native app). Refresh for those
   * clients is POST /auth/refresh with `Authorization: Bearer <refreshToken>`.
   */
  @Post('token')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async token(@Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest) {
    const { user, tokens } = await this.auth.login(body.email, body.password);
    return { user, ...tokens };
  }

  @Post('change-password')
  @HttpCode(204)
  @UseGuards(JwtAccessGuard)
  async changePassword(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(changePasswordRequestSchema)) body: ChangePasswordRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.changePassword(user.userId, body.currentPassword, body.newPassword);
    this.cookies.clear(res);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : undefined;
    const raw = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? bearer;
    try {
      const { user, tokens } = await this.auth.refresh(raw ?? '');
      if (bearer && !req.cookies?.[REFRESH_COOKIE]) return { user, ...tokens } as AuthResponse;
      this.cookies.set(res, tokens);
      return { user };
    } catch (err) {
      this.cookies.clear(res);
      throw err;
    }
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    await this.auth.logout(req.cookies?.[REFRESH_COOKIE] as string | undefined);
    this.cookies.clear(res);
  }

  @Get('me')
  @UseGuards(JwtAccessGuard)
  async me(@CurrentUser() user: RequestUser): Promise<AuthResponse> {
    return { user: await this.auth.me(user.userId) };
  }
}
