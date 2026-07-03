import {
  fromInvoiceRequestDTO,
  Invoice,
  InvoiceItem,
  InvoiceResponseDTO,
  PaymentCollectionMethod,
} from '@yosemite-crew/types';
import { useInvoiceStore } from '@/app/stores/invoiceStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { deleteData, getData, patchData, postData } from '@/app/services/axios';
import type {
  InvoiceLineItem as WorkspaceInvoiceLine,
  InvoiceStatus as WorkspaceInvoiceStatus,
  PastInvoice as WorkspacePastInvoice,
} from '@/app/features/appointments/types/workspace';

export type InvoicePaymentCollectionMethod = 'PAYMENT_AT_CLINIC';

export type AppointmentBillingHydration = {
  pastInvoices: WorkspacePastInvoice[];
  depositCents: number;
  /** Lower-cased names of items already on an invoice, so the bill builder can exclude them. */
  invoicedItemNames: string[];
  /** Currency reported by the appointment's invoices (ISO code), if any. */
  currency?: string;
};

type FinanceEnvelope<T> = {
  data: T;
  meta?: unknown;
  error?: { code?: string; message?: string; details?: unknown } | null;
};

type FinanceResponse = FinanceEnvelope<unknown>;

export type FinanceInvoiceLineItem = {
  name: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
};

type CreateFinanceInvoiceInput = {
  appointmentId?: string;
  parentId?: string;
  patientId?: string;
  organisationId: string;
  paymentCollectionMethod?: PaymentCollectionMethod;
  items: FinanceInvoiceLineItem[];
  invoiceDiscount?: { type: 'FIXED_AMOUNT' | 'PERCENTAGE'; value: number };
  notes?: string;
};

type ManualPaymentInput = {
  provider?: 'MANUAL';
  settlementChannel: 'CASH' | 'CARD_PRESENT' | 'BANK_TRANSFER' | 'DEPOSIT';
  amount: number;
  currency: string;
  reference?: string;
  receivedAt?: string;
  notes?: string;
};

type ReadyForBillingInput = {
  organisationId: string;
  patientId?: string;
  parentId?: string;
  visitId?: string;
  notes?: string;
};

type PaymentSessionResponse = {
  paymentAttemptId: string;
  // The finance service returns the Stripe checkout URL as `url`; older/alt shapes
  // used `checkoutUrl`. Read both so the link is never silently dropped.
  url?: string;
  checkoutUrl?: string;
  sessionId?: string;
  providerPaymentIntentId?: string;
  providerCheckoutSessionId?: string;
};

type InvoiceCheckoutSessionResponse = {
  checkout?: PaymentSessionResponse | null;
  emailSent?: boolean;
};

type InvoiceBackendArtifacts = {
  pdfUrl?: unknown;
  invoicePdfUrl?: unknown;
  renderedDocumentUrl?: unknown;
  renderedPdfUrl?: unknown;
  renderedDocumentId?: unknown;
  invoiceDocumentId?: unknown;
  payments?: unknown;
};

type NormalizedFinanceInvoice = Invoice & InvoiceBackendArtifacts;

const FINANCE_BASE_PATH = '/v1/finance';

const APPOINTMENT_ID_EXTENSION_URL =
  'https://yosemitecrew.com/fhir/StructureDefinition/appointment-id';

const withFreshFinanceParams = <T extends Record<string, unknown>>(
  params: T
): T & {
  _cacheBust: number;
} => ({
  ...params,
  _cacheBust: Date.now(),
});

const normalizeReferenceTail = (value: unknown): string | undefined => {
  let raw = '';
  if (typeof value === 'string') {
    raw = value;
  } else if (typeof value === 'number' || typeof value === 'boolean') {
    raw = String(value);
  }
  const normalizedRaw = raw.trim();
  if (!normalizedRaw) return undefined;
  const withoutQuery = normalizedRaw.split(/[?#]/)[0];
  const tail = withoutQuery.split('/').findLast(Boolean)?.trim();
  return tail || undefined;
};

const toSafeText = (value: unknown): string => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return '';
};

const normalizePaidAt = (value: unknown): string | undefined => {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  return undefined;
};

const unwrapFinanceData = <T>(value: T | FinanceEnvelope<T>): T => {
  if (
    value &&
    typeof value === 'object' &&
    'data' in value &&
    ('meta' in value || 'error' in value)
  ) {
    const envelope = value;
    if (envelope.error) {
      throw new Error(envelope.error.message || envelope.error.code || 'Finance request failed');
    }
    return envelope.data;
  }
  return value as T;
};

const getErrorStatus = (error: unknown): number | undefined => {
  if (!error || typeof error !== 'object' || !('response' in error)) return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  return typeof response?.status === 'number' ? response.status : undefined;
};

const isInvoiceMissingForReadyForBilling = (error: unknown): boolean => {
  if (getErrorStatus(error) !== 404) return false;
  const response = error as { response?: { data?: unknown } };
  const data = response.response?.data;
  if (!data || typeof data !== 'object') return false;
  const message = toSafeText((data as { message?: unknown }).message).toLowerCase();
  const errorMessage = toSafeText(
    (data as { error?: { message?: unknown } }).error?.message
  ).toLowerCase();
  return [message, errorMessage].some((text) => text.includes('invoice'));
};

const markAppointmentReadyForBillingViaAppointmentRoute = async (
  appointmentId: string,
  input: ReadyForBillingInput
): Promise<unknown> => {
  if (!input.organisationId) throw new Error('Organisation ID missing');
  const res = await patchData<FinanceResponse>(
    `/fhir/v1/appointment/pms/${input.organisationId}/${appointmentId}/ready-for-billing`,
    input
  );
  return unwrapFinanceData(res.data);
};

const reverseAppointmentReadyForBillingViaAppointmentRoute = async (
  appointmentId: string,
  input: ReadyForBillingInput
): Promise<unknown> => {
  if (!input.organisationId) throw new Error('Organisation ID missing');
  const res = await deleteData<FinanceResponse>(
    `/fhir/v1/appointment/pms/${input.organisationId}/${appointmentId}/ready-for-billing`
  );
  return unwrapFinanceData(res.data);
};

const normalizeFinanceInvoice = (
  invoice: any,
  fallbackOrganisationId?: string
): NormalizedFinanceInvoice => {
  if (invoice?.resourceType === 'Invoice') {
    return normalizeInvoiceForFrontend(invoice, fallbackOrganisationId);
  }

  const createdAt = invoice?.createdAt ? new Date(invoice.createdAt) : new Date();
  const updatedAt = invoice?.updatedAt ? new Date(invoice.updatedAt) : createdAt;
  let subtotal: number;
  if (typeof invoice?.subtotal === 'number') {
    subtotal = invoice.subtotal;
  } else if (Array.isArray(invoice?.items)) {
    subtotal = invoice.items.reduce((sum: number, item: any) => sum + Number(item?.total ?? 0), 0);
  } else {
    subtotal = Number(invoice?.totalAmount ?? 0);
  }

  return {
    id: invoice?.id,
    parentId: invoice?.parentId,
    patientId: invoice?.patientId,
    companionId: invoice?.companionId,
    organisationId: invoice?.organisationId ?? fallbackOrganisationId,
    appointmentId: invoice?.appointmentId,
    items: Array.isArray(invoice?.items) ? invoice.items : [],
    subtotal,
    taxPercent: invoice?.taxPercent,
    totalAmount: Number(invoice?.totalAmount ?? subtotal),
    paymentCollectionMethod: invoice?.paymentCollectionMethod ?? 'PAYMENT_LINK',
    currency: invoice?.currency ?? 'usd',
    discountTotal: invoice?.discountTotal,
    taxTotal: invoice?.taxTotal,
    stripeChargeId: invoice?.stripeChargeId,
    stripeReceiptUrl: invoice?.stripeReceiptUrl,
    stripePaymentIntentId: invoice?.stripePaymentIntentId,
    stripePaymentLinkId: invoice?.stripePaymentLinkId,
    stripeInvoiceId: invoice?.stripeInvoiceId,
    stripeCustomerId: invoice?.stripeCustomerId,
    stripeCheckoutSessionId: invoice?.stripeCheckoutSessionId,
    stripeCheckoutUrl: invoice?.stripeCheckoutUrl,
    status: invoice?.status ?? 'PENDING',
    // Carry billing-stage/deposit fields through so deposit totals persist and the
    // open-invoice selector can exclude SETTLED invoices.
    billingCollectionMode: invoice?.billingCollectionMode,
    visitBillingStage: invoice?.visitBillingStage,
    depositCollectedAmount: invoice?.depositCollectedAmount,
    depositTargetAmount: invoice?.depositTargetAmount,
    pdfUrl: invoice?.pdfUrl,
    invoicePdfUrl: invoice?.invoicePdfUrl,
    renderedDocumentUrl: invoice?.renderedDocumentUrl,
    renderedPdfUrl: invoice?.renderedPdfUrl,
    renderedDocumentId: invoice?.renderedDocumentId,
    invoiceDocumentId: invoice?.invoiceDocumentId,
    payments: invoice?.payments,
    metadata: invoice?.metadata,
    paidAt: invoice?.paidAt ? new Date(invoice.paidAt) : undefined,
    createdAt,
    updatedAt,
  };
};

const getInvoiceAppointmentIdFallback = (fhirInvoice: InvoiceResponseDTO): string | undefined => {
  const invoice = fhirInvoice as Partial<InvoiceResponseDTO> & {
    account?: { reference?: string };
    appointmentId?: string;
    extension?: Array<{ url?: string; valueString?: string }>;
  };
  const extensions = Array.isArray(invoice?.extension) ? invoice.extension : [];
  const appointmentIdFromExtension = extensions.find(
    (ext: any) => String(ext?.url ?? '') === APPOINTMENT_ID_EXTENSION_URL
  )?.valueString;
  const appointmentIdFromAccount = normalizeReferenceTail(invoice?.account?.reference);
  const appointmentIdFromRawField = normalizeReferenceTail(invoice?.appointmentId);

  return (
    normalizeReferenceTail(appointmentIdFromExtension) ??
    appointmentIdFromAccount ??
    appointmentIdFromRawField
  );
};

const normalizeInvoiceForFrontend = (
  fhirInvoice: InvoiceResponseDTO,
  fallbackOrganisationId?: string
) => {
  const parsedInvoice = fromInvoiceRequestDTO(fhirInvoice);
  const resolvedAppointmentId =
    String(parsedInvoice?.appointmentId ?? '').trim() ||
    getInvoiceAppointmentIdFallback(fhirInvoice);
  const resolvedOrganisationId =
    String(parsedInvoice?.organisationId ?? '').trim() || fallbackOrganisationId;

  return {
    ...parsedInvoice,
    appointmentId: resolvedAppointmentId || parsedInvoice.appointmentId,
    organisationId: resolvedOrganisationId || parsedInvoice.organisationId,
  };
};

export const loadInvoicesForOrgPrimaryOrg = async (opts?: {
  silent?: boolean;
  force?: boolean;
}): Promise<void> => {
  const { startLoading, status, invoiceIdsByOrgId, setInvoicesForOrg } = useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load specialities.');
    return;
  }
  const hasOrgData = !invoiceIdsByOrgId || Object.hasOwn(invoiceIdsByOrgId, primaryOrgId);
  if (!shouldFetchInvoices(status, hasOrgData, opts)) return;
  if (!opts?.silent) startLoading();
  try {
    const res = await getData<FinanceEnvelope<unknown[]> | unknown[]>(
      `${FINANCE_BASE_PATH}/invoices`,
      withFreshFinanceParams({
        organisationId: primaryOrgId,
      })
    );
    const invoicePayload = unwrapFinanceData(res.data) ?? [];
    const invoices = invoicePayload.map((invoice) =>
      normalizeFinanceInvoice(invoice, primaryOrgId)
    );
    setInvoicesForOrg(primaryOrgId, invoices);
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const loadInvoicesForAppointment = async (appointmentId: string): Promise<void> => {
  const { upsertInvoice } = useInvoiceStore.getState();
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot load appointment invoices.');
    return;
  }
  if (!appointmentId) {
    console.warn('No appointment id provided. Cannot load appointment invoices.');
    return;
  }

  try {
    const res = await getData<FinanceEnvelope<unknown[]> | unknown[]>(
      `${FINANCE_BASE_PATH}/invoices`,
      withFreshFinanceParams({
        organisationId: primaryOrgId,
        appointmentId,
      })
    );
    const invoicePayload = unwrapFinanceData(res.data) ?? [];
    const invoices = invoicePayload.map((invoice) =>
      normalizeFinanceInvoice(invoice, primaryOrgId)
    );
    invoices.forEach((invoice) => {
      upsertInvoice(invoice);
    });
  } catch (err) {
    console.error('Failed to load appointment invoices:', err);
    throw err;
  }
};

/**
 * Finance invoice amounts are expressed in major currency units (dollars). The
 * appointment workspace works entirely in integer cents, so convert on read.
 */
const financeAmountToCents = (amount: number | undefined): number =>
  Math.max(0, Math.round((Number(amount) || 0) * 100));

const FINANCE_OPEN_STATUSES = new Set(['PENDING', 'AWAITING_PAYMENT', 'REQUIRES_ACTION']);

/** Map a finance invoice status to the workspace's coarse paid/unpaid pill state. */
const toWorkspaceInvoiceStatus = (
  status: string | undefined,
  outstandingCents: number,
  totalCents: number
): WorkspaceInvoiceStatus => {
  if (status === 'PAID' || outstandingCents <= 0) return 'PAID_FULL';
  if (outstandingCents < totalCents) return 'PARTIAL';
  if (status && FINANCE_OPEN_STATUSES.has(status)) return 'UNPAID';
  return outstandingCents > 0 ? 'PARTIAL' : 'PAID_FULL';
};

const financeItemToWorkspaceLineItem = (item: InvoiceItem, index: number): WorkspaceInvoiceLine => {
  const unitPriceCents = financeAmountToCents(item.unitPrice);
  const qty = Math.max(1, Math.round(Number(item.quantity) || 1));
  const grossCents = unitPriceCents * qty;
  const amountCents = financeAmountToCents(item.total) || grossCents;
  return {
    id: String(item.id ?? `finance-line-${index}`),
    name: item.name,
    unitPriceCents,
    qty,
    grossCents,
    discountCents: Math.max(0, grossCents - amountCents),
    amountCents,
  };
};

const readInvoiceString = (invoice: Invoice, key: string): string | undefined => {
  const value = (invoice as unknown as Record<string, unknown>)[key];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const invoiceRenderedPdfUrl = (invoice: Invoice): string | undefined =>
  readInvoiceString(invoice, 'pdfUrl') ??
  readInvoiceString(invoice, 'invoicePdfUrl') ??
  readInvoiceString(invoice, 'renderedDocumentUrl') ??
  readInvoiceString(invoice, 'renderedPdfUrl');

const invoiceRenderedDocumentId = (invoice: Invoice): string | undefined =>
  readInvoiceString(invoice, 'renderedDocumentId') ??
  readInvoiceString(invoice, 'invoiceDocumentId');

/**
 * Hydrate the appointment workspace's billing view from the finance service:
 * existing/settled invoices (for the Invoices section), the deposit balance, and
 * the set of line-item names already invoiced (so the bill builder doesn't offer
 * them again).
 */
export const loadAppointmentBilling = async (
  organisationId: string,
  appointmentId: string
): Promise<AppointmentBillingHydration> => {
  if (!organisationId || !appointmentId) {
    return { pastInvoices: [], depositCents: 0, invoicedItemNames: [] };
  }

  const res = await getData<FinanceEnvelope<unknown[]> | unknown[]>(
    `${FINANCE_BASE_PATH}/invoices`,
    withFreshFinanceParams({ organisationId, appointmentId })
  );
  const invoicePayload = unwrapFinanceData(res.data) ?? [];
  // The backend scopes `GET /invoices?organisationId&appointmentId` to the
  // appointment (appointmentId takes precedence over organisationId), so the
  // response is already appointment-scoped — no client-side guard needed.
  const invoices = invoicePayload.map((invoice) =>
    normalizeFinanceInvoice(invoice, organisationId)
  );

  const invoicedItemNames = new Set<string>();
  let depositCents = 0;
  const pastInvoices: WorkspacePastInvoice[] = invoices.map((invoice) => {
    const items = (Array.isArray(invoice.items) ? invoice.items : []).map(
      (item: InvoiceItem, index: number) => financeItemToWorkspaceLineItem(item, index)
    );
    items.forEach((item) => {
      const key = item.name.trim().toLowerCase();
      if (key) invoicedItemNames.add(key);
    });
    const totalCents =
      financeAmountToCents(invoice.totalAmount) ||
      items.reduce((sum, item) => sum + item.amountCents, 0);
    const isPaid = invoice.status === 'PAID' || Boolean(invoice.paidAt);
    // Map the payment ledger (deposits + settlements with provider metadata and receipt URLs)
    // when the backend includes it on the invoice (handoff §5). Absent until then.
    const rawPayments = (invoice as { payments?: unknown }).payments;
    const payments = Array.isArray(rawPayments)
      ? rawPayments.map((payment, index) => {
          const p = payment as Record<string, unknown>;
          const paymentId = toSafeText(p.id);
          return {
            id: paymentId || `${String(invoice.id ?? appointmentId)}-pay-${index}`,
            amountCents: financeAmountToCents(p.amount as number | undefined),
            method: typeof p.settlementChannel === 'string' ? p.settlementChannel : undefined,
            provider: typeof p.provider === 'string' ? p.provider : undefined,
            status: typeof p.status === 'string' ? p.status : undefined,
            paidAt: normalizePaidAt(p.paidAt),
            receiptUrl: typeof p.receiptUrl === 'string' ? p.receiptUrl : undefined,
          };
        })
      : undefined;
    const explicitDepositCents = financeAmountToCents(invoice.depositCollectedAmount);
    const ledgerDepositCents =
      payments?.reduce((sum, payment) => {
        const method = String(payment.method ?? '').toUpperCase();
        return method === 'DEPOSIT' ? sum + payment.amountCents : sum;
      }, 0) ?? 0;
    const collectedCents = explicitDepositCents > 0 ? explicitDepositCents : ledgerDepositCents;
    depositCents += collectedCents;
    const paymentTotalCents = payments?.reduce((sum, payment) => sum + payment.amountCents, 0) ?? 0;
    const outstandingCents = isPaid ? 0 : Math.max(0, totalCents - paymentTotalCents);
    return {
      id: String(invoice.id ?? appointmentId),
      createdAt: (invoice.createdAt ?? new Date()).toISOString(),
      totalCents,
      outstandingCents,
      status: toWorkspaceInvoiceStatus(invoice.status, outstandingCents, totalCents),
      paidByName: undefined,
      paidAt: invoice.paidAt ? invoice.paidAt.toISOString() : undefined,
      items,
      payments,
      pdfUrl: invoiceRenderedPdfUrl(invoice),
      renderedDocumentId: invoiceRenderedDocumentId(invoice),
    };
  });

  const currency = invoices.find((invoice) => invoice.currency)?.currency;

  return {
    pastInvoices,
    depositCents,
    invoicedItemNames: [...invoicedItemNames],
    currency: currency ? currency.toUpperCase() : undefined,
  };
};

const shouldFetchInvoices = (
  status: ReturnType<typeof useInvoiceStore.getState>['status'],
  hasOrgData: boolean,
  opts?: { force?: boolean }
) => {
  if (opts?.force) return true;
  if (!hasOrgData) return true;
  return status === 'idle' || status === 'error';
};

// Dedupe key for "is this line already on the invoice". Intentionally keyed on
// name + quantity only — NOT price. The same booked service can reach the invoice
// through two pipelines (the treatment/catalog seed and the FE bill re-seed) whose
// prices differ by a sub-cent rounding delta (e.g. 257.127 vs 257.13), and keying
// on price let that rounded copy slip past the guard and append a duplicate line.
const normalizeInvoiceLineKey = (item: Pick<InvoiceItem, 'name' | 'quantity'>) =>
  [
    String(item.name ?? '')
      .trim()
      .toLowerCase(),
    Number(item.quantity),
  ].join('|');

const filterNewInvoiceLineItems = (invoice: Invoice, lineItems: InvoiceItem[]): InvoiceItem[] => {
  const existingItems = Array.isArray(invoice.items) ? invoice.items : [];
  const existingIds = new Set(
    existingItems.map((item) => String(item.id ?? '').trim()).filter((id) => id.length > 0)
  );
  const existingKeys = new Set(existingItems.map(normalizeInvoiceLineKey));

  return lineItems.filter((item) => {
    const id = String(item.id ?? '').trim();
    if (id && existingIds.has(id)) return false;
    return !existingKeys.has(normalizeInvoiceLineKey(item));
  });
};

export const addLineItemsToAppointments = async (
  lineItems: InvoiceItem[],
  appointmentId: string,
  currency: string
): Promise<void> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot add.');
    return;
  }
  try {
    if (!appointmentId || lineItems.length <= 0 || !currency) {
      throw new Error('Line items or Appointment ID or Currency missing');
    }
    const invoice = await ensureAppointmentInvoice(appointmentId);
    const newLineItems = filterNewInvoiceLineItems(invoice, lineItems);
    if (newLineItems.length === 0) return;
    const body = {
      items: newLineItems.map((item) => ({
        name: item.name,
        description: item.description ?? item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      currency: currency.toLowerCase(),
    };
    await postData<FinanceResponse>(`${FINANCE_BASE_PATH}/invoices/${invoice.id}/lines`, body);
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const getPaymentLink = async (invoiceId: string): Promise<string | undefined> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot get.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    const res = await postData<FinanceEnvelope<PaymentSessionResponse> | PaymentSessionResponse>(
      `${FINANCE_BASE_PATH}/invoices/${invoiceId}/payments/sessions`,
      { provider: 'STRIPE' }
    );
    const paymentSession = unwrapFinanceData(res.data);
    const url = paymentSession.url ?? paymentSession.checkoutUrl;
    if (!url) throw new Error('No checkout URL returned from backend.');
    return url;
  } catch (err) {
    console.error('Failed to load specialities:', err);
    throw err;
  }
};

export const sendInvoiceToClient = async (
  invoiceId: string
): Promise<InvoiceCheckoutSessionResponse> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot send invoice to client.');
    return {};
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    const res = await postData<
      FinanceEnvelope<InvoiceCheckoutSessionResponse> | InvoiceCheckoutSessionResponse
    >(`/fhir/v1/invoice/${invoiceId}/checkout-session`);
    return unwrapFinanceData(res.data);
  } catch (err) {
    console.error('Failed to send invoice to client:', err);
    throw err;
  }
};

export const markInvoicePaid = async (invoiceId: string) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot mark paid.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    const invoice = await getFinanceInvoiceById(invoiceId);
    return await recordManualInvoicePayment(invoiceId, {
      provider: 'MANUAL',
      settlementChannel: 'CASH',
      amount: invoice.totalAmount,
      currency: invoice.currency,
      receivedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Failed to mark invoice paid:', err);
    throw err;
  }
};

export const updateInvoicePaymentCollectionMethod = async (
  invoiceId: string,
  paymentCollectionMethod: InvoicePaymentCollectionMethod
) => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (!primaryOrgId) {
    console.warn('No primary organization selected. Cannot update payment collection method.');
    return;
  }
  try {
    if (!invoiceId) {
      throw new Error('Invoice ID missing');
    }
    return await patchData(`${FINANCE_BASE_PATH}/invoices/${invoiceId}/payment-collection-method`, {
      paymentCollectionMethod,
    });
  } catch (err) {
    console.error('Failed to update invoice payment collection method:', err);
    throw err;
  }
};

export const createFinanceInvoice = async (input: CreateFinanceInvoiceInput): Promise<Invoice> => {
  const res = await postData<FinanceResponse>(`${FINANCE_BASE_PATH}/invoices`, {
    paymentCollectionMethod: 'PAYMENT_LINK',
    ...input,
  });
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), input.organisationId);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const getFinanceInvoiceById = async (invoiceId: string): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const res = await getData<FinanceResponse>(`${FINANCE_BASE_PATH}/invoices/${invoiceId}`);
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const finalizeFinanceInvoice = async (invoiceId: string): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const res = await postData<FinanceResponse>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}/finalize`,
    { taxProvider: 'STRIPE' }
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const recordManualInvoicePayment = async (
  invoiceId: string,
  input: ManualPaymentInput
): Promise<unknown> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  const res = await postData<FinanceResponse>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}/payments`,
    {
      provider: 'MANUAL',
      ...input,
    }
  );
  return unwrapFinanceData(res.data);
};

export const createSupplementalInvoice = async (
  invoiceId: string,
  items: FinanceInvoiceLineItem[]
): Promise<Invoice> => {
  if (!invoiceId) throw new Error('Invoice ID missing');
  if (!items.length) throw new Error('At least one line item is required');
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  const res = await postData<FinanceResponse>(
    `${FINANCE_BASE_PATH}/invoices/${invoiceId}/supplement`,
    { items }
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

export const markAppointmentReadyForBilling = async (
  appointmentId: string,
  input: ReadyForBillingInput
): Promise<unknown> => {
  if (!appointmentId) throw new Error('Appointment ID missing');
  const endpoint = `${FINANCE_BASE_PATH}/appointments/${appointmentId}/ready-for-billing`;
  try {
    const res = await postData<FinanceResponse>(endpoint, input);
    return unwrapFinanceData(res.data);
  } catch (error) {
    if (getErrorStatus(error) === 404 && !isInvoiceMissingForReadyForBilling(error)) {
      return markAppointmentReadyForBillingViaAppointmentRoute(appointmentId, input);
    }
    if (
      !isInvoiceMissingForReadyForBilling(error) ||
      !input.organisationId ||
      !input.parentId ||
      !input.patientId
    ) {
      throw error;
    }

    await createFinanceInvoice({
      appointmentId,
      parentId: input.parentId,
      patientId: input.patientId,
      organisationId: input.organisationId,
      paymentCollectionMethod: 'PAYMENT_AT_CLINIC',
      items: [
        {
          name: 'Billing handoff',
          description: input.notes ?? 'Clinical visit ready for billing',
          quantity: 1,
          unitPrice: 0,
          total: 0,
        },
      ],
      notes: input.notes ?? 'Ready for billing',
    });

    try {
      const retry = await postData<FinanceResponse>(endpoint, input);
      return unwrapFinanceData(retry.data);
    } catch (retryError) {
      if (getErrorStatus(retryError) === 404) {
        return markAppointmentReadyForBillingViaAppointmentRoute(appointmentId, input);
      }
      throw retryError;
    }
  }
};

export const reverseAppointmentReadyForBilling = async (
  appointmentId: string,
  input: ReadyForBillingInput
): Promise<unknown> => {
  if (!appointmentId) throw new Error('Appointment ID missing');
  const endpoint = `${FINANCE_BASE_PATH}/appointments/${appointmentId}/ready-for-billing`;
  try {
    const res = await deleteData<FinanceResponse>(endpoint);
    return unwrapFinanceData(res.data);
  } catch (error) {
    // The finance route isn't deployed on every backend fork — fall back to the
    // appointment PMS route on a 404, mirroring the forward (mark) direction.
    if (getErrorStatus(error) === 404) {
      return reverseAppointmentReadyForBillingViaAppointmentRoute(appointmentId, input);
    }
    throw error;
  }
};

// Statuses an invoice can no longer accept line edits in. A paid/settled invoice
// (e.g. a collected deposit) returns 409 "Cannot modify a paid invoice" on /lines.
const CLOSED_INVOICE_STATUSES = new Set(['PAID', 'CANCELLED', 'REFUNDED', 'VOID']);

/**
 * Find an OPEN invoice for an appointment from the invoice store. An appointment
 * can carry several invoices (e.g. a paid deposit + the main bill); only an open
 * one may receive new lines — a paid/settled invoice 409s on /lines.
 */
export const findOpenAppointmentInvoice = (
  organisationId: string,
  appointmentId: string
): Invoice | undefined =>
  useInvoiceStore
    .getState()
    .getInvoicesByOrgId(organisationId)
    .find(
      (invoice) =>
        invoice.appointmentId === appointmentId &&
        invoice.id &&
        !CLOSED_INVOICE_STATUSES.has(String(invoice.status ?? '').toUpperCase()) &&
        String(invoice.visitBillingStage ?? '').toUpperCase() !== 'SETTLED'
    );

export const seedAppointmentInvoice = async (appointmentId: string): Promise<Invoice> => {
  const primaryOrgId = useOrgStore.getState().primaryOrgId;
  if (primaryOrgId) {
    const openInvoice = findOpenAppointmentInvoice(primaryOrgId, appointmentId);
    if (openInvoice?.id) return openInvoice;
  }

  const res = await postData<FinanceResponse>(
    `${FINANCE_BASE_PATH}/mobile/appointments/${appointmentId}/seed`,
    {}
  );
  const invoice = normalizeFinanceInvoice(unwrapFinanceData(res.data), primaryOrgId ?? undefined);
  useInvoiceStore.getState().upsertInvoice(invoice);
  return invoice;
};

const ensureAppointmentInvoice = seedAppointmentInvoice;
