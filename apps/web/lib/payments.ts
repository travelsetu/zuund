'use client';

import type { PaymentCheckoutDto, PaymentDto } from '@zuund/shared';
import { api } from './api';

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

/** One idempotency key per buying post until its payment succeeds. */
export function idempotencyKeyFor(buyingIntentId: string): string {
  const k = `zuund:payment-key:${buyingIntentId}`;
  try {
    const existing = sessionStorage.getItem(k);
    if (existing) return existing;
    const fresh = `web-${buyingIntentId.slice(0, 8)}-${crypto.randomUUID()}`;
    sessionStorage.setItem(k, fresh);
    return fresh;
  } catch {
    return `web-${buyingIntentId.slice(0, 8)}-${crypto.randomUUID()}`;
  }
}

export function clearIdempotencyKey(buyingIntentId: string) {
  try {
    sessionStorage.removeItem(`zuund:payment-key:${buyingIntentId}`);
  } catch {
    /* ignore */
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment window'));
    document.body.appendChild(s);
  });
}

/** Opens Razorpay checkout and resolves with the verified payment, or null if the user closed it. */
export async function payWithRazorpay(
  checkout: PaymentCheckoutDto,
  userName: string | null,
  email: string,
): Promise<PaymentDto | null> {
  await loadRazorpay();
  return new Promise((resolve, reject) => {
    const rz = new window.Razorpay!({
      key: checkout.checkout.key,
      order_id: checkout.checkout.orderId,
      amount: checkout.payment.amount,
      currency: checkout.payment.currency,
      name: 'ZUUND',
      description: 'Buying Pass',
      prefill: { name: userName ?? '', email },
      theme: { color: '#2563eb' },
      modal: { ondismiss: () => resolve(null) },
      handler: (r: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
      }) => {
        api.payments
          .verify({
            paymentId: checkout.payment.id,
            providerOrderId: r.razorpay_order_id,
            providerPaymentId: r.razorpay_payment_id,
            providerSignature: r.razorpay_signature,
          })
          .then(resolve, reject);
      },
    });
    rz.open();
  });
}

/** Dev only: the mock provider accepts this signature. */
export function payWithMock(checkout: PaymentCheckoutDto): Promise<PaymentDto> {
  const orderId = checkout.checkout.orderId!;
  return api.payments.verify({
    paymentId: checkout.payment.id,
    providerOrderId: orderId,
    providerPaymentId: `mock_pay_${crypto.randomUUID().slice(0, 8)}`,
    providerSignature: `mock:${orderId}`,
  });
}
