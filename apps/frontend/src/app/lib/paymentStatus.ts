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

const PAYMENT_DISPLAY: Record<AppointmentPaymentState, PaymentDisplay> = {
  PAID: {
    state: 'PAID',
    label: 'Paid',
    textColor: '#54B492',
    badgeBackgroundColor: '#E6F4EF',
    badgeTextColor: '#54B492',
  },
  UNPAID: {
    state: 'UNPAID',
    label: 'Unpaid',
    textColor: '#F68523',
    badgeBackgroundColor: '#FEF3E9',
    badgeTextColor: '#F68523',
  },
  PAID_CASH: {
    state: 'PAID_CASH',
    label: 'Paid in cash',
    textColor: '#247AED',
    badgeBackgroundColor: '#E8F0FE',
    badgeTextColor: '#247AED',
  },
  PAYMENT_AT_CLINIC: {
    state: 'PAYMENT_AT_CLINIC',
    label: 'Unpaid',
    textColor: '#F68523',
    badgeBackgroundColor: '#FEF3E9',
    badgeTextColor: '#F68523',
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

const metadataSuggestsCash = (invoice: Invoice): boolean => {
  if (!invoice.metadata) return false;
  return Object.entries(invoice.metadata).some(([key, value]) => {
    const keyText = String(key || '').toLowerCase();
    const valueText = String(value ?? '').toLowerCase();
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
