import { buildPaymentStatusUrl } from '@/app/lib/paymentStatusUrl';

export type PaymentStatusDisplayState = 'paid' | 'no_payment_required' | 'unpaid';

export type PaymentStatusResult = {
  status: PaymentStatusDisplayState;
  total: number;
};

/**
 * One checkout-session lookup, kept out of the page so the polling effect owns
 * scheduling and cancellation only.
 *
 * `fetch` resolves rather than rejects on 4xx/5xx, so the status is checked here:
 * without it an error payload parses as a status, and the page polls a broken
 * endpoint thirty times instead of showing "we could not confirm your payment".
 */
export const fetchPaymentStatus = async (sessionId: string): Promise<PaymentStatusResult> => {
  const res = await fetch(buildPaymentStatusUrl(sessionId), {
    cache: 'no-store',
  });
  if (!res.ok) {
    throw new Error(`Payment status lookup failed with ${res.status}`);
  }
  return (await res.json()) as PaymentStatusResult;
};
