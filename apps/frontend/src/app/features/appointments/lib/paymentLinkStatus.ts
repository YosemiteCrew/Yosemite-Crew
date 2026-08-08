/**
 * The design's "Stripe · payment link sent" status line under the workspace
 * Collect action, derived from the invoice's REAL collection state.
 *
 * It only appears when the invoice is actually collecting via a Stripe payment
 * link (`paymentCollectionMethod === 'PAYMENT_LINK'`) AND a link artifact exists
 * (`stripePaymentLinkId` or `stripeCheckoutUrl`). No link, no line.
 */

/** The invoice fields this status reads — a structural subset of the shared Invoice. */
export type PaymentLinkInvoice = {
  appointmentId?: string;
  status?: string;
  paymentCollectionMethod?: string;
  stripePaymentLinkId?: string;
  stripeCheckoutUrl?: string;
  /**
   * BACKEND WORK REQUIRED (`Invoice.paymentLinkSentAt`, plus a passthrough in
   * normalizeFinanceInvoice). Creating a payment link does not prove it reached
   * the client, so "sent" is only claimed once the backend stamps this.
   */
  paymentLinkSentAt?: string;
};

export type PaymentLinkStatus = {
  label: string;
  /** True once the backend confirms delivery — otherwise the link is merely ready. */
  isSent: boolean;
};

/** Invoice statuses whose payment link is no longer awaiting collection. */
const CLOSED_STATUSES = new Set(['PAID', 'CANCELLED', 'REFUNDED', 'VOID']);

const hasPaymentLink = (invoice: PaymentLinkInvoice): boolean =>
  Boolean(invoice.stripePaymentLinkId || invoice.stripeCheckoutUrl);

const isCollectingByLink = (invoice: PaymentLinkInvoice): boolean =>
  String(invoice.paymentCollectionMethod ?? '').toUpperCase() === 'PAYMENT_LINK';

const isOpen = (invoice: PaymentLinkInvoice): boolean =>
  !CLOSED_STATUSES.has(String(invoice.status ?? '').toUpperCase());

/**
 * The appointment's open invoice that is genuinely collecting through a Stripe
 * payment link, or undefined when there is none.
 */
export const findPaymentLinkInvoice = (
  invoices: PaymentLinkInvoice[],
  appointmentId: string
): PaymentLinkInvoice | undefined =>
  invoices.find(
    (invoice) =>
      invoice.appointmentId === appointmentId &&
      isOpen(invoice) &&
      isCollectingByLink(invoice) &&
      hasPaymentLink(invoice)
  );

/**
 * Status line for an invoice, or null when the invoice is not collecting via a
 * payment link. The wording never overstates what the data proves: a link that
 * exists is "ready"; it becomes "sent" only when `paymentLinkSentAt` is present.
 */
export const derivePaymentLinkStatus = (
  invoice: PaymentLinkInvoice | undefined
): PaymentLinkStatus | null => {
  if (!invoice || !isOpen(invoice) || !isCollectingByLink(invoice) || !hasPaymentLink(invoice)) {
    return null;
  }
  const isSent = Boolean(invoice.paymentLinkSentAt);
  return {
    isSent,
    label: isSent ? 'Stripe · payment link sent' : 'Stripe · payment link ready',
  };
};
