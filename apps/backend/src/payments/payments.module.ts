import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import type { Env } from '../config/env';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { MockPaymentProvider } from './providers/mock.provider';
import { PAYMENT_PROVIDER, type PaymentProvider } from './providers/payment-provider';
import { RazorpayProvider } from './providers/razorpay.provider';

@Module({
  imports: [AuthModule],
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    {
      provide: PAYMENT_PROVIDER,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>): PaymentProvider => {
        if (config.get('PAYMENT_PROVIDER', { infer: true }) === 'razorpay') {
          return new RazorpayProvider({
            keyId: config.get('RAZORPAY_KEY_ID', { infer: true })!,
            keySecret: config.get('RAZORPAY_KEY_SECRET', { infer: true })!,
            webhookSecret: config.get('RAZORPAY_WEBHOOK_SECRET', { infer: true })!,
          });
        }
        return new MockPaymentProvider();
      },
    },
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
