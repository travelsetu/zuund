import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';

@Module({
  imports: [
    UsersModule,
    // Secrets and expiry are passed per-call in AuthService, so no global options are needed.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookies, JwtAccessGuard],
  exports: [AuthService, JwtAccessGuard, JwtModule],
})
export class AuthModule {}
