import { Appointment, Invoice } from '@yosemite-crew/types';
import { normalizeAppointmentId } from '@/app/lib/invoice';
import { type LegacyAppointmentStatus } from '@/app/lib/appointments';

export type AppointmentPaymentState = 'PAID' | 'UNPAID' | 'PAID_CASH' | 'PAYMENT_AT_CLINIC';

type PaymentDisplay = {
  state: AppointmentPaymentState;
  label: 'Paid' | 'Unpaid' | 'Paid in cash';
  textColor: string;
  badgeBackgroundColor: string;
  badgeTextColor: string;
};

/**
 * Inks, not mid-ramp fills. --color-success-400 (#54b492) and --color-warning-600
 * (#f68523) are FILL steps: as the 11px Paid/Unpaid line under a status pill they
 * measured 2.28:1 and 2.29:1 on the bone screen of the deployed dashboard, and
 * 2.29 on their own badge tints - the least readable text on that page and on the
 * appointments list. --success-text and --color-warning-900 are the ink-tuned
 * members of the same two ramps: they clear ~6.3 on each of those light surfaces.
 *
 * Both already carry dark values (#2bbd86 / #f9ad6c), and dark improves too rather
 * than regressing - measured on the deployed dark dashboard, Paid goes 5.82 -> 6.10
 * and Unpaid 5.80 -> 7.85 against the card, which is why this is a straight token
 * swap and not a light-only override.
 */
const PAYMENT_DISPLAY: Record<AppointmentPaymentState, PaymentDisplay> = {
  PAID: {
    state: 'PAID',
    label: 'Paid',
    textColor: 'var(--success-text)',
    badgeBackgroundColor: 'var(--color-success-100)',
    badgeTextColor: 'var(--success-text)',
  },
  UNPAID: {
    state: 'UNPAID',
    label: 'Unpaid',
    textColor: 'var(--color-warning-900)',
    badgeBackgroundColor: 'var(--color-card-warning)',
    badgeTextColor: 'var(--color-warning-900)',
  },
  PAID_CASH: {
    state: 'PAID_CASH',
    label: 'Paid in cash',
    textColor: 'var(--color-blue-text)',
    badgeBackgroundColor: 'var(--color-blue-light)',
    badgeTextColor: 'var(--color-blue-text)',
  },
  PAYMENT_AT_CLINIC: {
    state: 'PAYMENT_AT_CLINIC',
    label: 'Unpaid',
    textColor: 'var(--color-warning-900)',
    badgeBackgroundColor: 'var(--color-card-warning)',
    badgeTextColor: 'var(--color-warning-900)',
  },
};

const toEpoch = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const hasStripePaymentEvidence = (invoice: Invoice) =>
  Boolean(
    invoice.stripeChargeId ||
    invoice.stripePaymentIntentId ||
    invoice.stripePaymentLinkId ||
    invoice.stripeCheckoutSessionId ||
    invoice.stripeCheckoutUrl ||
    invoice.stripeInvoiceId ||
    invoice.stripeReceiptUrl
  );

// Metadata values are free-form. Only a primitive can carry a payment mode, so
// anything else compares as '' rather than the useless '[object Object]'.
const toComparableText = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).toLowerCase()
    : '';

const metadataSuggestsCash = (invoice: Invoice): boolean => {
  if (!invoice.metadata) return false;
  return Object.entries(invoice.metadata).some(([key, value]) => {
    const keyText = String(key || '').toLowerCase();
    const valueText = toComparableText(value);
    const keyIndicatesPayment =
      keyText.includes('payment') ||
      keyText.includes('tender') ||
      keyText.includes('method') ||
      keyText.includes('mode');
    return keyIndicatesPayment && valueText.includes('cash');
  });
};

const isInvoicePaid = (invoice: Invoice) => invoice.status === 'PAID' || Boolean(invoice.paidAt);

const isLikelyCashInvoice = (invoice: Invoice) => {
  if (!isInvoicePaid(invoice)) return false;
  if (metadataSuggestsCash(invoice)) return true;
  if (invoice.paymentCollectionMethod === 'PAYMENT_LINK') return false;
  return !hasStripePaymentEvidence(invoice);
};

export const createInvoiceByAppointmentId = (invoices: Invoice[]): Record<string, Invoice> => {
  const byAppointmentId: Record<string, Invoice> = {};

  invoices.forEach((invoice) => {
    const appointmentId = normalizeAppointmentId(invoice.appointmentId);
    if (!appointmentId) return;

    const current = byAppointmentId[appointmentId];
    if (!current) {
      byAppointmentId[appointmentId] = invoice;
      return;
    }

    const currentRank = Math.max(
      toEpoch(current.updatedAt),
      toEpoch(current.createdAt),
      toEpoch(current.paidAt)
    );
    const nextRank = Math.max(
      toEpoch(invoice.updatedAt),
      toEpoch(invoice.createdAt),
      toEpoch(invoice.paidAt)
    );

    if (nextRank >= currentRank) {
      byAppointmentId[appointmentId] = invoice;
    }
  });

  return byAppointmentId;
};

export const getAppointmentPaymentDisplay = (
  appointment: Appointment,
  invoicesByAppointmentId: Record<string, Invoice> = {}
): PaymentDisplay => {
  const extensionPaymentStatus = Array.isArray((appointment as any)?.extension)
    ? String(
        (appointment as any).extension.find(
          (ext: any) =>
            String(ext?.url || '') ===
            'https://yosemitecrew.com/fhir/StructureDefinition/appointment-payment-status'
        )?.valueString ?? ''
      )
    : '';
  const explicitPaymentStatus = String(
    (appointment as any).paymentStatus ?? extensionPaymentStatus ?? ''
  )
    .trim()
    .toUpperCase();
  const normalizedPaymentStatus = explicitPaymentStatus.replaceAll(/[\s-]+/g, '_');
  if (normalizedPaymentStatus === 'PAID') return PAYMENT_DISPLAY.PAID;
  if (normalizedPaymentStatus === 'UNPAID') return PAYMENT_DISPLAY.UNPAID;
  if (normalizedPaymentStatus === 'PAID_CASH') return PAYMENT_DISPLAY.PAID_CASH;
  if (normalizedPaymentStatus === 'PAYMENT_AT_CLINIC') return PAYMENT_DISPLAY.PAYMENT_AT_CLINIC;

  const appointmentId = normalizeAppointmentId(appointment.id);
  const invoice = appointmentId ? invoicesByAppointmentId[appointmentId] : undefined;

  if (!invoice) {
    return (appointment.status as LegacyAppointmentStatus) === 'NO_PAYMENT'
      ? PAYMENT_DISPLAY.UNPAID
      : PAYMENT_DISPLAY.PAID;
  }

  if (!isInvoicePaid(invoice)) {
    return PAYMENT_DISPLAY.UNPAID;
  }

  if (isLikelyCashInvoice(invoice)) {
    return PAYMENT_DISPLAY.PAID_CASH;
  }

  return PAYMENT_DISPLAY.PAID;
};
