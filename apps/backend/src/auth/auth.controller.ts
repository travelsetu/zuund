import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { loginRequestSchema, type AuthResponse, type LoginRequest } from '@jhoond/shared';
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
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) body: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { user, tokens } = await this.auth.login(body.email, body.password);
    this.cookies.set(res, tokens);
    return { user };
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE] as string | undefined;
    try {
      const { user, tokens } = await this.auth.refresh(raw ?? '');
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
