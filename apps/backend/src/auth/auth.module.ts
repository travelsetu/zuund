import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { OtpModule } from '../otp/otp.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [
    forwardRef(() => UsersModule),
    OtpModule,
    // Secrets and expiry are passed per-call in AuthService, so no global options are needed.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthCookies, JwtAccessGuard, RolesGuard],
  exports: [AuthService, JwtAccessGuard, RolesGuard, JwtModule],
})
export class AuthModule {}
