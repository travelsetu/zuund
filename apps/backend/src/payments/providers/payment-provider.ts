/**
 * What the rest of the app knows about a payment provider. Provider-specific
 * code lives only in the implementations of this interface.
 */
export interface CreateOrderInput {
  /** Our payment id; goes to the provider as the receipt / reference. */
  paymentId: string;
  /** Paise. */
  amount: number;
  currency: string;
  notes?: Record<string, string>;
}

export interface CreatedOrder {
  providerOrderId: string;
  /** Whatever the client needs to open checkout (key id, order id…). Never secrets. */
  checkout: Record<string, string>;
}

export interface WebhookEvent {
  providerEventId: string;
  eventType: string;
  /** Normalised outcome, if the event is one we act on. */
  outcome:
    | {
        kind: 'PAYMENT_SUCCESS';
        providerOrderId: string;
        providerPaymentId: string;
        amount: number;
      }
    | {
        kind: 'PAYMENT_FAILED';
        providerOrderId: string;
        providerPaymentId: string | null;
        reason: string | null;
      }
    | { kind: 'REFUNDED'; providerPaymentId: string; providerRefundId: string; amount: number }
    | { kind: 'IGNORED' };
  payload: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createOrder(input: CreateOrderInput): Promise<CreatedOrder>;
  /** Verifies the checkout callback (order id, payment id, signature) came from the provider. */
  verifyCheckoutSignature(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ): boolean;
  /** Verifies and parses a webhook delivery. Throws on a bad signature. */
  parseWebhook(
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): WebhookEvent;
  refund(providerPaymentId: string, amount: number): Promise<{ providerRefundId: string }>;
}

export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
