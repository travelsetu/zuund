import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env';

const MSG91_URL = 'https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

/**
 * Delivers sign-in codes. `msg91` sends the approved WhatsApp template (the code fills
 * the body and the copy-code button); `log` writes the code to the server log instead.
 */
@Injectable()
export class OtpSender {
  private readonly logger = new Logger(OtpSender.name);
  /** Tests read codes from here instead of WhatsApp. */
  readonly sentForTests = new Map<string, string>();

  constructor(private readonly config: ConfigService<Env, true>) {}

  get provider(): 'msg91' | 'log' {
    const chosen = this.config.get('OTP_PROVIDER', { infer: true });
    if (chosen) return chosen;
    return this.config.get('MSG91_AUTH_KEY', { infer: true }) ? 'msg91' : 'log';
  }

  /** Throws when the code could not be handed to WhatsApp. */
  async send(phone: string, code: string): Promise<void> {
    if (this.provider === 'log') {
      if (this.config.get('NODE_ENV', { infer: true }) === 'test')
        this.sentForTests.set(phone, code);
      else this.logger.warn(`WhatsApp code for ${phone}: ${code} (OTP_PROVIDER=log, not sent)`);
      return;
    }
    const res = await fetch(MSG91_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: this.config.get('MSG91_AUTH_KEY', { infer: true }) ?? '',
      },
      body: JSON.stringify({
        integrated_number: this.config.get('MSG91_WHATSAPP_NUMBER', { infer: true }),
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: this.config.get('MSG91_OTP_TEMPLATE', { infer: true }),
            language: { code: 'en', policy: 'deterministic' },
            namespace: this.config.get('MSG91_OTP_NAMESPACE', { infer: true }),
            to_and_components: [
              {
                // MSG91 wants the number with country code and no "+".
                to: [phone.replace(/^\+/, '')],
                components: {
                  body_1: { type: 'text', value: code },
                  button_1: { subtype: 'url', type: 'text', value: code },
                },
              },
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let ok = res.ok;
    try {
      const body = JSON.parse(text) as { status?: string; hasError?: boolean };
      if (body.status && body.status !== 'success') ok = false;
      if (body.hasError) ok = false;
    } catch {
      /* not JSON: rely on the HTTP status */
    }
    if (!ok) {
      this.logger.error(`MSG91 WhatsApp send failed (${res.status}): ${text.slice(0, 300)}`);
      throw new Error('MSG91 send failed');
    }
  }
}
