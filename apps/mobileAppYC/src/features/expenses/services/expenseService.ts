import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {documentApi} from '@/features/documents/services/documentService';
import {generateId} from '@/shared/utils/helpers';
import {buildCdnUrlFromKey} from '@/shared/utils/cdnHelpers';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import type {Expense, ExpenseAttachment, ExpenseSummary} from '@/features/expenses/types';
import type {Invoice, PaymentIntentInfo} from '@/features/appointments/types';
import {mapInvoiceFromResponse} from '@/features/appointments/services/appointmentsService';
import {resolveCategoryLabel, resolveSubcategoryLabel, resolveVisitTypeLabel} from '@/features/expenses/utils/expenseLabels';

type ExpenseSourceRaw = 'IN_APP' | 'EXTERNAL' | string;

export interface ExpenseInputPayload {
  companionId: string;
  parentId?: string | null;
  category: string;
  subcategory?: string | null;
  visitType?: string | null;
  expenseName: string;
  businessName?: string | null;
  date: string;
  amount: number;
  currency: string;
  attachments: ExpenseAttachment[];
  note?: string | null;
}

const normalizeSource = (raw?: ExpenseSourceRaw): Expense['source'] => {
  const upper = (raw ?? '').toString().toUpperCase();
  return upper === 'IN_APP' ? 'inApp' : 'external';
};

const toSlug = (value?: string | null) =>
  (value ?? '')
    .toString()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/_+/g, '-')
    .toLowerCase();

const normalizeCategory = (value?: string | null) => {
  const slug = toSlug(value);
  if (slug === 'hygiene' || slug === 'hygiene-maintenance') {
    return 'hygiene-maintenance';
  }
  if (slug === 'dietary' || slug === 'dietary-plans') {
    return 'dietary-plans';
  }
  if (slug === 'other' || slug === 'others') {
    return 'others';
  }
  return slug;
};

const normalizeSubcategory = (value?: string | null) => {
  const slug = toSlug(value);
  if (slug === 'other' || slug === 'others') {
    return 'other';
  }
  return slug;
};

const normalizeVisitType = (value?: string | null) => {
  const slug = toSlug(value);
  return slug || 'other';
};

const normalizeStatus = (raw?: string | null): Expense['status'] => {
  const upper = (raw ?? '').toString().toUpperCase();
  switch (upper) {
    case 'PAID':
    case 'REFUNDED':
    case 'CANCELLED':
    case 'PAYMENT_FAILED':
    case 'NO_PAYMENT':
    case 'AWAITING_PAYMENT':
      return upper as Expense['status'];
    default:
      return 'UNPAID';
  }
};

const deriveFileName = (key?: string | null, fallback?: string) => {
  if (!key) {
    return fallback ?? 'attachment';
  }
  const cleaned = key.split('/').filter(Boolean);
  const last = cleaned.at(-1);
  return last ?? fallback ?? 'attachment';
};

const inferMimeFromKey = (key?: string | null, fallback?: string) => {
  const name = key ?? '';
  const lowered = name.toLowerCase();
  if (lowered.endsWith('.jpg') || lowered.endsWith('.jpeg')) return 'image/jpeg';
  if (lowered.endsWith('.png')) return 'image/png';
  if (lowered.endsWith('.webp')) return 'image/webp';
  if (lowered.endsWith('.heic')) return 'image/heic';
  if (lowered.endsWith('.heif')) return 'image/heif';
  if (lowered.endsWith('.pdf')) return 'application/pdf';
  return fallback ?? 'application/octet-stream';
};

const mapAttachmentFromApi = (raw: any, index: number): ExpenseAttachment => {
  const key =
    raw?.key ??
    raw?.fileKey ??
    raw?.storageKey ??
    raw?.attachmentKey ??
    raw?.id ??
    '';

  const cdnUrl = buildCdnUrlFromKey(key);
  const fallbackUrl =
    raw?.url ??
    raw?.fileUrl ??
    raw?.s3Url ??
    raw?.signedUrl ??
    raw?.viewUrl ??
    raw?.downloadUrl ??
    null;
  const resolvedUrl = normalizeImageUri(cdnUrl ?? fallbackUrl ?? raw?.uri ?? '');

  const mimeType =
    raw?.mimetype ??
    raw?.mimeType ??
    raw?.contentType ??
    raw?.type ??
    inferMimeFromKey(key, 'application/octet-stream');

  return {
    id: (raw?.id ?? raw?._id ?? key) || `attachment-${index}-${generateId()}`,
    key,
    name: raw?.name ?? raw?.fileName ?? deriveFileName(key, `attachment-${index + 1}`),
    type: mimeType,
    size: raw?.size ?? raw?.fileSize ?? raw?.contentLength ?? 0,
    uri: resolvedUrl ?? '',
    s3Url: cdnUrl ?? fallbackUrl ?? undefined,
    viewUrl: raw?.viewUrl ?? fallbackUrl ?? cdnUrl ?? undefined,
    downloadUrl: raw?.downloadUrl ?? fallbackUrl ?? cdnUrl ?? undefined,
    status: (raw?.status as ExpenseAttachment['status']) ?? 'ready',
  };
};

const toIsoStringSafe = (value: any, fallback?: string) => {
  if (!value) {
    return fallback ?? new Date().toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback ?? new Date().toISOString();
  }
  return date.toISOString();
};

const mapExpenseFromApi = (raw: any, companionIdFallback?: string): Expense => {
  const attachments = Array.isArray(raw?.attachments) ? raw.attachments : [];
  const mappedAttachments = attachments.map((item: any, idx: number) => mapAttachmentFromApi(item, idx));

  const companionId =
    raw?.companionId ?? raw?.companion_id ?? raw?.petId ?? companionIdFallback ?? '';
  const createdAt = raw?.createdAt ?? raw?.created_at ?? raw?.date ?? new Date().toISOString();
  const updatedAt = raw?.updatedAt ?? raw?.updated_at ?? createdAt;
  const date = raw?.date ?? createdAt;
  const rawStatus =
    raw?.status ?? raw?.paymentStatus ?? raw?.state ?? raw?.payment_state ?? raw?.paymentState;
  const source = normalizeSource(raw?.source);
  const resolvedSource = source === 'external' && (raw?.invoiceId ?? raw?.invoice_id) ? 'inApp' : source;

  return {
    id: raw?.id ?? raw?._id ?? raw?.expenseId ?? generateId(),
    companionId,
    title: raw?.title ?? raw?.expenseName ?? raw?.name ?? 'Expense',
    category: normalizeCategory(raw?.category ?? raw?.categoryId ?? ''),
    subcategory: normalizeSubcategory(raw?.subcategory ?? raw?.subCategory ?? ''),
    visitType: normalizeVisitType(
      raw?.visitType ?? raw?.visit_type ?? raw?.visitTypeName ?? raw?.visit_type_name,
    ),
    amount: Number(raw?.amount ?? 0),
    currencyCode: raw?.currency ?? raw?.currencyCode ?? 'USD',
    status: normalizeStatus(rawStatus),
    rawStatus: rawStatus ?? null,
    source: resolvedSource,
    date: toIsoStringSafe(date),
    createdAt: toIsoStringSafe(createdAt),
    updatedAt: toIsoStringSafe(updatedAt),
    attachments: mappedAttachments,
    providerName: raw?.providerName ?? raw?.businessName ?? raw?.organization ?? raw?.organisation,
    businessName: raw?.businessName ?? raw?.providerName ?? raw?.organization ?? raw?.organisation,
    description: raw?.description ?? raw?.note ?? '',
    invoiceId: raw?.invoiceId ?? raw?.invoice_id ?? raw?.invoice?.id ?? null,
    note: raw?.note ?? null,
    parentId: raw?.parentId ?? raw?.parent_id ?? null,
  };
};

const mapSummaryFromApi = (raw: any, currencyCodeFallback = 'USD'): ExpenseSummary => ({
  total: Number(raw?.totalExpense ?? raw?.total ?? 0),
  invoiceTotal: Number(raw?.invoiceTotal ?? raw?.inAppTotal ?? 0),
  externalTotal: Number(raw?.externalTotal ?? raw?.external ?? 0),
  currencyCode: raw?.currency ?? raw?.currencyCode ?? currencyCodeFallback,
  lastUpdated: new Date().toISOString(),
});

const serializeAttachmentsForApi = (attachments: ExpenseAttachment[]) =>
  attachments
    .filter(file => file.key)
    .map(file => ({
      key: file.key as string,
      mimetype: file.type ?? 'application/octet-stream',
    }));

const ensureUploadedAttachments = async ({
  attachments,
  companionId,
  accessToken,
}: {
  attachments: ExpenseAttachment[];
  companionId: string;
  accessToken: string;
}): Promise<ExpenseAttachment[]> => {
  if (!attachments?.length) {
    return [];
  }

  const uploaded: ExpenseAttachment[] = [];
  for (const file of attachments) {
    if (file.key) {
      uploaded.push({...file, status: 'ready'});
      continue;
    }
    if (!file.uri) {
      throw new Error(`File path missing for upload: ${file.name || file.id}`);
    }
    const uploadedFile = await documentApi.uploadAttachment({
      file,
      companionId,
      accessToken,
    });
    uploaded.push({
      ...file,
      ...uploadedFile,
      status: 'ready',
    });
  }
  return uploaded;
};

const toApiPayload = (input: ExpenseInputPayload) => {
  const {
    companionId,
    parentId,
    category,
    subcategory,
    visitType,
    expenseName,
    businessName,
    date,
    amount,
    currency,
    attachments,
    note,
  } = input;

  const normalizedDate = (() => {
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) {
      return date;
    }
    return parsed.toISOString().split('T')[0];
  })();

  const categoryLabel = resolveCategoryLabel(category);
  const subcategoryLabel = subcategory ? resolveSubcategoryLabel(category, subcategory) : '';
  const visitTypeLabel = visitType ? resolveVisitTypeLabel(visitType) : '';

  return {
    companionId,
    parentId: parentId ?? '',
    category: categoryLabel ?? category,
    subcategory: subcategoryLabel ?? subcategory ?? '',
    visitType: visitTypeLabel ?? visitType ?? '',
    expenseName,
    businessName: businessName ?? '',
    date: normalizedDate,
    amount,
    currency,
    attachments: serializeAttachmentsForApi(attachments),
    note: note ?? '',
  };
};

const extractPaymentIntentId = (invoicePayload: any): string | null => {
  const extensions = Array.isArray(invoicePayload?.extension) ? invoicePayload.extension : [];
  const extIntent =
    extensions.find(
      (ext: any) =>
        ext?.url === 'https://yosemitecrew.com/fhir/StructureDefinition/stripe-payment-intent-id',
    )?.valueString ?? null;
  return (
    extIntent ??
    invoicePayload?.paymentIntentId ??
    invoicePayload?.stripePaymentIntentId ??
    invoicePayload?.payment_intent_id ??
    null
  );
};

export const expenseApi = {
  async fetchExpenses({
    companionId,
    accessToken,
  }: {
    companionId: string;
    accessToken: string;
  }): Promise<Expense[]> {
    const {data} = await apiClient.get(
      `/v1/expense/companion/${encodeURIComponent(companionId)}/list`,
      {headers: withAuthHeaders(accessToken)},
    );
    const collection = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : [];
    return collection.map((item: any) => mapExpenseFromApi(item, companionId));
  },

  async fetchSummary({
    companionId,
    accessToken,
    currencyCode,
  }: {
    companionId: string;
    accessToken: string;
    currencyCode: string;
  }): Promise<ExpenseSummary> {
    const {data} = await apiClient.get(
      `/v1/expense/companion/${encodeURIComponent(companionId)}/summary`,
      {headers: withAuthHeaders(accessToken)},
    );
    const payload = data?.data ?? data ?? {};
    return mapSummaryFromApi(payload, currencyCode);
  },

  async fetchExpenseById({
    expenseId,
    accessToken,
  }: {
    expenseId: string;
    accessToken: string;
  }): Promise<Expense> {
    const {data} = await apiClient.get(
      `/v1/expense/${encodeURIComponent(expenseId)}`,
      {headers: withAuthHeaders(accessToken)},
    );
    const payload = data?.data ?? data ?? {};
    return mapExpenseFromApi(payload, payload?.companionId);
  },

  async createExternal({
    input,
    accessToken,
  }: {
    input: ExpenseInputPayload;
    accessToken: string;
  }): Promise<Expense> {
    const uploadedAttachments = await ensureUploadedAttachments({
      attachments: input.attachments,
      companionId: input.companionId,
      accessToken,
    });

    const payload = toApiPayload({...input, attachments: uploadedAttachments});
    const {data} = await apiClient.post('/v1/expense/', payload, {
      headers: withAuthHeaders(accessToken),
    });
    const responsePayload = data?.data ?? data ?? payload;
    const mergedPayload = {...responsePayload, attachments: uploadedAttachments};
    return mapExpenseFromApi(mergedPayload, input.companionId);
  },

  async updateExternal({
    expenseId,
    input,
    accessToken,
  }: {
    expenseId: string;
    input: ExpenseInputPayload;
    accessToken: string;
  }): Promise<Expense> {
    const uploadedAttachments = await ensureUploadedAttachments({
      attachments: input.attachments,
      companionId: input.companionId,
      accessToken,
    });

    const payload = toApiPayload({...input, attachments: uploadedAttachments});
    const {data} = await apiClient.patch(
      `/v1/expense/${encodeURIComponent(expenseId)}`,
      payload,
      {headers: withAuthHeaders(accessToken)},
    );
    const responsePayload = data?.data ?? data ?? payload;
    const mergedPayload = {...responsePayload, attachments: uploadedAttachments, id: expenseId};
    return mapExpenseFromApi(mergedPayload, input.companionId);
  },

  async deleteExpense({
    expenseId,
    accessToken,
  }: {
    expenseId: string;
    accessToken: string;
  }) {
    await apiClient.delete(`/v1/expense/${encodeURIComponent(expenseId)}`, {
      headers: withAuthHeaders(accessToken),
    });
    return true;
  },

  async fetchInvoice({
    invoiceId,
    accessToken,
  }: {
    invoiceId: string;
    accessToken: string;
  }): Promise<{invoice: Invoice | null; paymentIntent: PaymentIntentInfo | null; paymentIntentId: string | null; organistion?: any; organisation?: any}> {
    const {data} = await apiClient.get(
      `/fhir/v1/invoice/mobile/${encodeURIComponent(invoiceId)}`,
      {headers: withAuthHeaders(accessToken)},
    );

    // Handle various response formats
    const payload = Array.isArray(data?.data)
      ? data.data[0]
      : Array.isArray(data)
        ? data[0]
        : data?.data ?? data ?? null;

    // Extract invoice data and organisation data from the response
    // The payload might be the wrapper object with {invoice, organistion} or just the invoice
    const invoiceData = payload?.invoice ?? payload;
    const organisationData = payload?.organistion ?? payload?.organisation;

    const {invoice, paymentIntent} = mapInvoiceFromResponse(invoiceData);
    const paymentIntentId = paymentIntent?.paymentIntentId ?? extractPaymentIntentId(invoiceData);

    return {
      invoice,
      paymentIntent: paymentIntent ?? null,
      paymentIntentId: paymentIntentId ?? null,
      organistion: organisationData ?? undefined,
      organisation: organisationData ?? undefined,
    };
  },

  async fetchPaymentIntent({
    paymentIntentId,
    accessToken,
  }: {
    paymentIntentId: string;
    accessToken: string;
  }): Promise<PaymentIntentInfo> {
    const {data} = await apiClient.get(
      `/v1/stripe/payment-intent/${encodeURIComponent(paymentIntentId)}`,
      {headers: withAuthHeaders(accessToken)},
    );
    const payload = data?.paymentIntent ?? data?.data ?? data ?? {};
    return {
      paymentIntentId: payload.paymentIntentId ?? payload.id ?? paymentIntentId,
      clientSecret: payload.clientSecret ?? payload.client_secret ?? '',
      amount: payload.amount ?? payload.value ?? 0,
      currency: payload.currency ?? payload.currencyCode ?? 'USD',
      paymentLinkUrl: payload.paymentLinkUrl ?? null,
    };
  },
};

export default expenseApi;
