/**
 * Money formatting and payment-method copy shared by the invoice step and its
 * presentational pieces.
 *
 * Split out of InvoiceStep.tsx because a module that exports both React components
 * and plain values loses per-component Fast Refresh, and so each of these stays
 * findable on its own instead of sitting inside a 1500-line step module
 * (react-doctor/only-export-components, react-doctor/no-multi-component-file).
 */
import { formatMoney } from '@/app/lib/money';
import type { PaymentMethod } from '@/app/features/appointments/types/workspace';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  ONLINE: 'Paid Online',
  CASH: 'Paid via Cash',
  DEPOSIT: 'Paid from Deposit',
};

export const DEFAULT_CURRENCY = 'USD';

export const formatCents = (cents: number, currency: string = DEFAULT_CURRENCY): string =>
  formatMoney(cents / 100, currency);
