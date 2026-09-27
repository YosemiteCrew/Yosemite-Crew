import { getData } from '@/app/services/axios';
import type {
  BillingReviewItem,
  BillingReviewPage,
  BillingReviewStatus,
} from '@/app/features/finance/types/billingReview';

const BASE_PATH = '/v1/finance';
const LIMIT = '50';

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const normalizeItem = (value: unknown): BillingReviewItem => {
  const row = (value ?? {}) as Record<string, unknown>;
  const status = row.billingStatus;
  const billingStatus: BillingReviewStatus =
    status === 'DRAFT_INVOICE' || status === 'READY_FOR_BILLING' ? status : 'MISSING_INVOICE';

  return {
    id: typeof row.id === 'string' ? row.id : '',
    appointmentDate: typeof row.appointmentDate === 'string' ? row.appointmentDate : '',
    patientName: toNullableString(row.patientName),
    clientName: toNullableString(row.clientName),
    appointmentType: toNullableString(row.appointmentType),
    invoiceId: toNullableString(row.invoiceId),
    invoiceStatus: toNullableString(row.invoiceStatus),
    billingStatus,
  };
};

export const listBillingReview = async (
  organisationId: string,
  cursor?: string | null
): Promise<BillingReviewPage> => {
  if (!organisationId) throw new Error('Organisation ID missing');

  const path = `${BASE_PATH}/organisation/${encodeURIComponent(organisationId)}/completed-visits/billing-review`;
  const response = await getData<unknown>(path, {
    limit: LIMIT,
    ...(cursor ? { cursor } : {}),
  });
  const envelope = (response.data ?? {}) as {
    data?: unknown;
    meta?: { nextCursor?: unknown; hasMore?: unknown } | null;
    error?: { message?: unknown } | null;
  };
  if (envelope.error) {
    throw new Error(
      typeof envelope.error.message === 'string'
        ? envelope.error.message
        : 'Unable to load completed visits.'
    );
  }

  return {
    items: Array.isArray(envelope.data) ? envelope.data.map(normalizeItem) : [],
    nextCursor: toNullableString(envelope.meta?.nextCursor),
    hasMore:
      typeof envelope.meta?.hasMore === 'boolean'
        ? envelope.meta.hasMore
        : envelope.meta?.nextCursor != null,
  };
};
