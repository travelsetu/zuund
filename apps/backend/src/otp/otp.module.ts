import { Module } from '@nestjs/common';
import { OtpSender } from './otp.sender';
import { OtpService } from './otp.service';

@Module({
  providers: [OtpService, OtpSender],
  exports: [OtpService, OtpSender],
})
export class OtpModule {}
