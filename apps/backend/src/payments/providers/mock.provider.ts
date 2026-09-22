import { randomUUID } from 'node:crypto';
import type {
  CreateOrderInput,
  CreatedOrder,
  PaymentProvider,
  WebhookEvent,
} from './payment-provider';

/**
 * Development only (the env schema refuses it in production). Checkout
 * "succeeds" when the client posts providerPaymentId `mock_pay_<anything>`
 * with signature `mock:<orderId>`; the web app's dev-only button does this.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly name = 'mock';

  async createOrder(_input: CreateOrderInput): Promise<CreatedOrder> {
    const id = `mock_order_${randomUUID()}`;
    return { providerOrderId: id, checkout: { orderId: id } };
  }

  verifyCheckoutSignature(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ): boolean {
    return providerPaymentId.startsWith('mock_pay_') && signature === `mock:${providerOrderId}`;
  }

  parseWebhook(rawBody: Buffer): WebhookEvent {
    const body = JSON.parse(rawBody.toString('utf8')) as {
      eventId?: string;
      event?: string;
      orderId?: string;
      paymentId?: string;
      amount?: number;
    };
    if (body.event === 'payment.captured' && body.orderId && body.paymentId) {
      return {
        providerEventId: body.eventId ?? randomUUID(),
        eventType: body.event,
        outcome: {
          kind: 'PAYMENT_SUCCESS',
          providerOrderId: body.orderId,
          providerPaymentId: body.paymentId,
          amount: body.amount ?? 0,
        },
        payload: body,
      };
    }
    return {
      providerEventId: body.eventId ?? randomUUID(),
      eventType: body.event ?? 'unknown',
      outcome: { kind: 'IGNORED' },
      payload: body,
    };
  }

  async refund(_providerPaymentId: string): Promise<{ providerRefundId: string }> {
    return { providerRefundId: `mock_rfnd_${randomUUID()}` };
  }
}
