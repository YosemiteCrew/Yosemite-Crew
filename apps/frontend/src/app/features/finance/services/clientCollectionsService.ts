import { getData, postData, putData } from '@/app/services/axios';
import type {
  ClientPaymentTerms,
  OverdueClientInvoice,
} from '@/app/features/finance/types/clientCollections';

const basePath = (organisationId: string) =>
  `/v1/finance/organisation/${encodeURIComponent(organisationId)}`;

type FinanceEnvelope<T> = { data?: T; error?: { message?: string; code?: string } | null };

const unwrap = <T>(value: unknown): T => {
  const envelope = (value ?? {}) as FinanceEnvelope<T>;
  if (envelope.error) {
    throw new Error(envelope.error.message ?? envelope.error.code ?? 'Finance request failed');
  }
  return envelope.data as T;
};

export const listOverdueClientInvoices = async (
  organisationId: string
): Promise<OverdueClientInvoice[]> => {
  if (!organisationId) throw new Error('Organisation ID missing');
  const response = await getData<unknown>(`${basePath(organisationId)}/collections/overdue`);
  const rows = unwrap<unknown>(response.data);
  if (!Array.isArray(rows)) return [];
  return rows
    .filter((row): row is OverdueClientInvoice => {
      if (!row || typeof row !== 'object') return false;
      const item = row as Partial<OverdueClientInvoice>;
      return Boolean(
        item.invoiceId &&
        item.parentId &&
        item.dueAt &&
        item.currency &&
        typeof item.balance === 'number' &&
        Number.isFinite(item.balance)
      );
    })
    .map((row) => ({
      ...row,
      reviewedAt: row.reviewedAt ?? null,
      reviewedBy: row.reviewedBy ?? null,
    }));
};

export const getClientPaymentTerms = async (
  organisationId: string,
  parentId: string
): Promise<ClientPaymentTerms> => {
  if (!organisationId || !parentId) throw new Error('Client account missing');
  const response = await getData<unknown>(
    `${basePath(organisationId)}/clients/${encodeURIComponent(parentId)}/payment-terms`
  );
  return unwrap<ClientPaymentTerms>(response.data);
};

export const saveClientPaymentTerms = async (
  organisationId: string,
  parentId: string,
  netDays: number
): Promise<ClientPaymentTerms> => {
  if (!organisationId || !parentId) throw new Error('Client account missing');
  if (!Number.isInteger(netDays) || netDays < 0 || netDays > 365) {
    throw new Error('Payment terms must be between 0 and 365 days.');
  }
  const response = await putData<unknown>(
    `${basePath(organisationId)}/clients/${encodeURIComponent(parentId)}/payment-terms`,
    { netDays }
  );
  return unwrap<ClientPaymentTerms>(response.data);
};

export const markClientInvoiceReviewed = async (
  organisationId: string,
  invoiceId: string
): Promise<{ id: string; collectionsReviewedAt: string; collectionsReviewedBy: string }> => {
  if (!organisationId || !invoiceId) throw new Error('Invoice missing');
  const response = await postData<unknown>(
    `${basePath(organisationId)}/collections/overdue/${encodeURIComponent(invoiceId)}/review`,
    {}
  );
  return unwrap(response.data);
};
