import { createHmac, timingSafeEqual } from 'node:crypto';
import { BadGatewayException, UnauthorizedException } from '@nestjs/common';
import type {
  CreateOrderInput,
  CreatedOrder,
  PaymentProvider,
  WebhookEvent,
} from './payment-provider';

interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
}

/** Razorpay over its REST API. No SDK: three endpoints and two HMACs. */
export class RazorpayProvider implements PaymentProvider {
  readonly name = 'razorpay';
  private readonly base = 'https://api.razorpay.com/v1';

  constructor(private readonly cfg: RazorpayConfig) {}

  private get authHeader() {
    return `Basic ${Buffer.from(`${this.cfg.keyId}:${this.cfg.keySecret}`).toString('base64')}`;
  }

  private async call<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method: 'POST',
      headers: { Authorization: this.authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new BadGatewayException(
        `Payment provider error (${res.status}): ${text.slice(0, 200)}`,
      );
    }
    return (await res.json()) as T;
  }

  async createOrder(input: CreateOrderInput): Promise<CreatedOrder> {
    const order = await this.call<{ id: string }>('/orders', {
      amount: input.amount,
      currency: input.currency,
      receipt: input.paymentId,
      notes: input.notes ?? {},
    });
    return { providerOrderId: order.id, checkout: { key: this.cfg.keyId, orderId: order.id } };
  }

  verifyCheckoutSignature(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ): boolean {
    const expected = createHmac('sha256', this.cfg.keySecret)
      .update(`${providerOrderId}|${providerPaymentId}`)
      .digest('hex');
    return safeEqual(expected, signature);
  }

  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookEvent {
    const sig = String(headers['x-razorpay-signature'] ?? '');
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(rawBody).digest('hex');
    if (!sig || !safeEqual(expected, sig)) throw new UnauthorizedException('Bad webhook signature');

    const body = JSON.parse(rawBody.toString('utf8')) as {
      event: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id: string;
            amount: number;
            error_description?: string | null;
          };
        };
        refund?: { entity?: { id: string; payment_id: string; amount: number } };
      };
    };
    const providerEventId = String(headers['x-razorpay-event-id'] ?? '');
    const p = body.payload?.payment?.entity;
    const r = body.payload?.refund?.entity;

    let outcome: WebhookEvent['outcome'] = { kind: 'IGNORED' };
    if (body.event === 'payment.captured' && p) {
      outcome = {
        kind: 'PAYMENT_SUCCESS',
        providerOrderId: p.order_id,
        providerPaymentId: p.id,
        amount: p.amount,
      };
    } else if (body.event === 'payment.failed' && p) {
      outcome = {
        kind: 'PAYMENT_FAILED',
        providerOrderId: p.order_id,
        providerPaymentId: p.id,
        reason: p.error_description ?? null,
      };
    } else if (body.event === 'refund.processed' && r) {
      outcome = {
        kind: 'REFUNDED',
        providerPaymentId: r.payment_id,
        providerRefundId: r.id,
        amount: r.amount,
      };
    }
    return {
      providerEventId: providerEventId || `${body.event}:${p?.id ?? r?.id ?? 'unknown'}`,
      eventType: body.event,
      outcome,
      payload: body,
    };
  }

  async refund(providerPaymentId: string, amount: number): Promise<{ providerRefundId: string }> {
    const res = await this.call<{ id: string }>(`/payments/${providerPaymentId}/refund`, {
      amount,
    });
    return { providerRefundId: res.id };
  }
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
