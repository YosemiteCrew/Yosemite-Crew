import apiClient, {withAuthHeaders} from '@/shared/services/apiClient';
import {uploadFileToPresignedUrl} from '@/shared/services/uploadService';
import {generateId} from '@/shared/utils/helpers';
import type {Document, DocumentFile} from '@/features/documents/types';
import {normalizeImageUri} from '@/shared/utils/imageUri';
import {buildCdnUrlFromKey} from '@/shared/utils/cdnHelpers';

const CATEGORY_ALIASES: Record<string, string> = {
  hygiene: 'hygiene-maintenance',
  'hygiene-maintenance': 'hygiene-maintenance',
  hygiene_maintenance: 'hygiene-maintenance',
};

const CATEGORY_API_MAP: Record<string, string> = {
  admin: 'ADMIN',
  health: 'HEALTH',
  'hygiene-maintenance': 'HYGIENE_MAINTENANCE',
  'dietary-plans': 'DIETARY_PLANS',
  others: 'OTHERS',
};

const SUBCATEGORY_API_MAP: Record<string, string> = {
  passport: 'PASSPORT',
  certificates: 'CERTIFICATES',
  insurance: 'INSURANCE',
  'hospital-visits': 'HOSPITAL_VISITS',
  'prescriptions-treatments': 'PRESCRIPTIONS_AND_TREATMENTS',
  'vaccination-parasite': 'VACCINATION_AND_PARASITE_PREVENTION',
  'lab-tests': 'LAB_TESTS',
  'grooming-visits': 'GROOMER_VISIT',
  'boarding-records': 'BOARDER_VISIT',
  'training-behaviour': 'TRAINING_AND_BEHAVIOUR_REPORTS',
  'breeder-interactions': 'BREEDER_VISIT',
  'nutrition-plans': 'NUTRITION_PLANS',
};

const normalizeKey = (value?: string | null): string => {
  const str = (value ?? '').toString().toLowerCase().replaceAll('&', 'and');
  // Replace non-alphanumeric characters with underscores
  const withUnderscores = str.replaceAll(/[^a-z0-9]+/g, '_');
  // Remove leading and trailing underscores (ReDoS-safe)
  let result = withUnderscores;
  while (result.startsWith('_')) {
    result = result.slice(1);
  }
  while (result.endsWith('_')) {
    result = result.slice(0, -1);
  }
  return result;
};

const SUBCATEGORY_API_TO_UI: Record<string, string> = (() => {
  const map: Record<string, string> = {};
  Object.entries(SUBCATEGORY_API_MAP).forEach(([uiSlug, apiSlug]) => {
    map[normalizeKey(apiSlug)] = uiSlug;
    map[normalizeKey(uiSlug)] = uiSlug;
  });
  map[normalizeKey('training-and-behaviour-reports')] = 'training-behaviour';
  map[normalizeKey('training & behaviour reports')] = 'training-behaviour';
  return map;
})();

const toUiSlug = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const lower = value.toString().toLowerCase();
  if (lower === 'other' || lower === 'others') {
    return 'others';
  }
  if (CATEGORY_ALIASES[lower]) {
    return CATEGORY_ALIASES[lower];
  }
  return lower.replaceAll('_', '-');
};

const toApiSlug = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const lower = value.toString().toLowerCase();
  let normalized = lower;
  if (lower === 'other' || lower === 'others') {
    normalized = 'others';
  } else if (CATEGORY_ALIASES[lower]) {
    normalized = CATEGORY_ALIASES[lower];
  }
  return CATEGORY_API_MAP[normalized] ?? normalized.replaceAll('-', '_').toUpperCase();
};

const normalizeSubcategoryFromApi = (
  subcategory?: string | null,
  category?: string | null,
): string => {
  const normalizedCategory = toUiSlug(category);
  if (!subcategory) {
    return normalizedCategory === 'others' ? 'other' : '';
  }
  const lower = subcategory.toString().toLowerCase();
  const mapped = SUBCATEGORY_API_TO_UI[normalizeKey(subcategory)];
  if (mapped) {
    return mapped;
  }
  if (lower === 'other' || lower === 'others') {
    return 'other';
  }
  return lower.replaceAll('_', '-');
};

const serializeSubcategoryForApi = (
  category: string | null,
  subcategory: string | null,
): string => {
  const categoryLower = category?.toString().toLowerCase() ?? '';
  if (!subcategory || categoryLower === 'others' || categoryLower === 'other') {
    return '';
  }
  const lower = subcategory.toString().toLowerCase();
  if (lower === 'other' || lower === 'others') {
    return '';
  }
  return SUBCATEGORY_API_MAP[lower] ?? lower.replaceAll('-', '_').toUpperCase();
};

const normalizeVisitType = (value?: string | null): string =>
  value ? value.toString().toLowerCase().replaceAll('_', '-') : '';

const serializeVisitTypeForApi = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const normalized = value.toString().trim();
  if (!normalized) {
    return '';
  }
  return normalized.replaceAll('-', '_').toUpperCase();
};

const toSafeIsoString = (value?: string | null, fallbackNow: boolean = false): string => {
  if (!value) {
    return fallbackNow ? new Date().toISOString() : '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallbackNow ? new Date().toISOString() : '';
  }
  return date.toISOString();
};

const serializeIssueDateForApi = (value?: string | null): string => {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toISOString().split('T')[0];
};

const formatAppointmentId = (payload: any): string => {
  if (payload?.appointmentId != null) {
    return String(payload.appointmentId);
  }
  if (payload?.appointment_id != null) {
    return String(payload.appointment_id);
  }
  return '';
};

const deriveNameFromKey = (key?: string | null, fallback?: string): string => {
  if (key) {
    const cleaned = key.split('/').filter(Boolean);
    const last = cleaned.at(-1);
    if (last) {
      // If the name is a UUID-like string without proper extension inference,
      // still return it but ensure it has an extension for preview purposes
      if (/^[a-f0-9]{8}-[a-f0-9]{4}-/i.exec(last)) {
        // It's a UUID, keep it but don't strip extension
        return last;
      }
      return last;
    }
  }
  return fallback ?? 'document';
};

const pickAttachmentList = (payload: any): any[] => {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.attachments)) {
    return payload.attachments;
  }
  if (Array.isArray(payload.files)) {
    return payload.files;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
};

const mapAttachmentFromApi = (
  raw: any,
  index: number,
  fallback?: Partial<DocumentFile>,
): DocumentFile => {
  const key =
    raw?.key ??
    raw?.fileKey ??
    raw?.storageKey ??
    raw?.attachmentKey ??
    fallback?.key ??
    '';

  const cdnUrl =
    buildCdnUrlFromKey(key) ??
    normalizeImageUri(key ?? undefined) ??
    normalizeImageUri(fallback?.s3Url ?? undefined) ??
    null;

  const resolvedUrl =
    raw?.url ??
    raw?.fileUrl ??
    raw?.s3Url ??
    raw?.signedUrl ??
    raw?.viewUrl ??
    raw?.downloadUrl ??
    cdnUrl ??
    fallback?.s3Url ??
    fallback?.uri ??
    null;

  const mimeType =
    raw?.mimeType ??
    raw?.contentType ??
    raw?.type ??
    fallback?.type ??
    'application/octet-stream';

  const name =
    raw?.name ??
    raw?.fileName ??
    fallback?.name ??
    deriveNameFromKey(key, `document-${index + 1}`);

  const id =
    raw?.id ??
    raw?._id ??
    fallback?.id ??
    key ??
    `doc-file-${index}-${generateId()}`;

  const size = (() => {
    if (typeof raw?.size === 'number') {
      return raw.size;
    }
    if (typeof raw?.fileSize === 'number') {
      return raw.fileSize;
    }
    if (typeof raw?.contentLength === 'number') {
      return raw.contentLength;
    }
    if (typeof fallback?.size === 'number') {
      return fallback.size;
    }
    return 0;
  })();

  const resolvedUri =
    typeof resolvedUrl === 'string' ? resolvedUrl : fallback?.uri ?? '';
  const resolvedS3 =
    typeof resolvedUrl === 'string' ? resolvedUrl : fallback?.s3Url ?? cdnUrl ?? undefined;
  const resolvedView =
    raw?.viewUrl ??
    (typeof resolvedUrl === 'string' ? resolvedUrl : fallback?.viewUrl ?? cdnUrl ?? undefined);
  const resolvedDownload =
    raw?.downloadUrl ??
    (typeof resolvedUrl === 'string' ? resolvedUrl : fallback?.downloadUrl ?? cdnUrl ?? undefined);

  return {
    id,
    key,
    name,
    type: mimeType,
    size,
    uri: raw?.uri ?? resolvedUri,
    s3Url: resolvedS3,
    viewUrl: resolvedView,
    downloadUrl: resolvedDownload,
    status: (raw?.status as DocumentFile['status']) ?? fallback?.status ?? 'ready',
  };
};

const normalizeDocumentFromApi = (
  payload: any,
  companionIdFallback?: string,
): Document => {
  const attachments = pickAttachmentList(payload);
  const files = attachments.map((item, index) => mapAttachmentFromApi(item, index));

  const category = toUiSlug(
    payload?.category ?? payload?.categoryId ?? payload?.type ?? payload?.documentCategory,
  );
  const subcategory = normalizeSubcategoryFromApi(
    payload?.subcategory ??
      payload?.subCategory ??
      payload?.sub_type ??
      payload?.subType ??
      payload?.documentSubcategory,
    category,
  );

  const issueDateRaw =
    payload?.issueDate ?? payload?.issue_date ?? payload?.issuedAt ?? payload?.issued_at ?? '';

  const createdAtRaw = payload?.createdAt ?? payload?.created_at ?? '';
  const updatedAtRaw = payload?.updatedAt ?? payload?.updated_at ?? createdAtRaw;

  const visitType = normalizeVisitType(
    payload?.visitType ?? payload?.visit_type ?? payload?.visit_type_name,
  );

  const isSynced =
    Boolean(
      payload?.isSynced ??
        payload?.synced ??
        payload?.syncedFromPms ??
        payload?.pmsVisible ??
        payload?.isPms,
    ) ||
    payload?.source === 'pms' ||
    payload?.origin === 'pms';

  const uploadedByParentId =
    payload?.uploadedByParentId ?? payload?.uploadedByParent ?? payload?.parentId ?? null;
  const uploadedByPmsUserId =
    payload?.uploadedByPmsUserId ?? payload?.uploadedByPmsUser ?? payload?.pmsUserId ?? null;

  const userAddedFallback = Boolean(uploadedByParentId) || !isSynced;
  let isUserAdded = userAddedFallback;
  if (uploadedByPmsUserId) {
    isUserAdded = false;
  } else if (typeof payload?.isUserAdded === 'boolean') {
    isUserAdded = payload.isUserAdded;
  }

  return {
    id: payload?.id ?? payload?._id ?? payload?.documentId ?? generateId(),
    companionId:
      payload?.companionId ?? payload?.companion_id ?? companionIdFallback ?? payload?.petId ?? '',
    category,
    subcategory: subcategory || '',
    visitType: visitType || '',
    title: payload?.title ?? payload?.name ?? payload?.documentTitle ?? 'Document',
    businessName:
      payload?.issuingBusinessName ??
      payload?.issuing_business_name ??
      payload?.businessName ??
      payload?.business_name ??
      payload?.business ??
      payload?.issuer ??
      '',
    issueDate: toSafeIsoString(issueDateRaw),
    files,
    createdAt: toSafeIsoString(createdAtRaw, true),
    updatedAt: toSafeIsoString(updatedAtRaw, true),
    isSynced,
    isUserAdded,
    uploadedByParentId,
    uploadedByPmsUserId,
    appointmentId: formatAppointmentId(payload),
  };
};

const normalizeViewResponse = (
  payload: any,
  existingFiles: DocumentFile[] = [],
): DocumentFile[] => {
  let candidates = pickAttachmentList(payload);

  if (!candidates.length && payload && typeof payload === 'object') {
    if (payload.viewUrl || payload.url || payload.downloadUrl) {
      candidates = [payload];
    }
  }

  if (!candidates.length && typeof payload === 'string') {
    candidates = [{url: payload}];
  }

  if (!candidates.length) {
    return existingFiles.map(file => ({...file}));
  }

  return candidates.map((item, index) => {
    const fallback =
      existingFiles.find(file => file.key && (file.key === item?.key || file.key === item?.fileKey)) ??
      existingFiles[index];

    return mapAttachmentFromApi(
      {
        ...item,
        url: item?.url ?? item?.viewUrl ?? item?.downloadUrl,
        mimeType: item?.mimeType ?? item?.contentType ?? item?.type,
        key: item?.key ?? item?.fileKey ?? fallback?.key,
      },
      index,
      fallback,
    );
  });
};

const extractDocumentsCollection = (payload: any): any[] => {
  const candidate = payload?.data ?? payload;
  if (Array.isArray(candidate)) {
    return candidate;
  }
  if (Array.isArray(candidate?.documents)) {
    return candidate.documents;
  }
  if (Array.isArray(candidate?.results)) {
    return candidate.results;
  }
  if (Array.isArray(candidate?.items)) {
    return candidate.items;
  }
  if (Array.isArray(candidate?.data)) {
    return candidate.data;
  }

  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload?.documents)) {
    return payload.documents;
  }
  if (Array.isArray(payload?.data)) {
    return payload.data;
  }
  if (Array.isArray(payload?.results)) {
    return payload.results;
  }
  if (Array.isArray(payload?.items)) {
    return payload.items;
  }
  return [];
};

const resolveUploadMeta = (payload: any) => {
  const candidate = payload?.data ?? payload;
  const uploadUrl =
    candidate?.uploadUrl ?? candidate?.url ?? candidate?.signedUrl ?? candidate?.uploadURL;
  const key = candidate?.key ?? candidate?.fileKey ?? candidate?.storageKey ?? candidate?.filePath;
  const fileUrl = candidate?.fileUrl ?? candidate?.publicUrl;

  if (!uploadUrl || !key) {
    throw new Error('Unable to request upload URL. Missing uploadUrl or key.');
  }

  return {uploadUrl, key, fileUrl};
};

export const documentApi = {
  async requestUploadUrl({
    mimeType,
    companionId,
    accessToken,
  }: {
    mimeType: string;
    companionId: string;
    accessToken: string;
  }) {
    const response = await apiClient.post(
      '/v1/document/mobile/upload-url',
      {mimeType, companionId},
      {headers: withAuthHeaders(accessToken)},
    );
    return resolveUploadMeta(response.data);
  },

  async uploadAttachment({
    file,
    companionId,
    accessToken,
  }: {
    file: DocumentFile;
    companionId: string;
    accessToken: string;
  }): Promise<DocumentFile> {
    if (file.key) {
      return {...file, status: 'ready'};
    }

    const uploadMeta = await documentApi.requestUploadUrl({
      mimeType: file.type ?? 'application/octet-stream',
      companionId,
      accessToken,
    });

    if (!file.uri) {
      throw new Error(`File path missing for upload: ${file.name || file.key || 'unknown file'}`);
    }

    // Preserve the original URI (content:// or file://); the upload service will normalize.
    const filePath = file.uri;

    await uploadFileToPresignedUrl({
      filePath,
      mimeType: file.type ?? 'application/octet-stream',
      url: uploadMeta.uploadUrl,
      expectedSize: file.size,
    });

    const cdnUrl = buildCdnUrlFromKey(uploadMeta.key);

    // Preserve the original file name for display purposes
    const uploadedFile: DocumentFile = {
      ...file,
      key: uploadMeta.key,
      s3Url: uploadMeta.fileUrl ?? cdnUrl ?? file.s3Url,
      downloadUrl: uploadMeta.fileUrl ?? cdnUrl ?? file.downloadUrl,
      viewUrl: uploadMeta.fileUrl ?? cdnUrl ?? file.viewUrl,
      status: 'ready',
    };

    console.log('[documentService] File uploaded successfully', {
      originalName: file.name,
      key: uploadMeta.key,
      type: file.type,
    });

    return uploadedFile;
  },

  async create({
    companionId,
    category,
    subcategory,
    visitType,
    title,
    businessName,
    issueDate,
    files,
    appointmentId,
    accessToken,
  }: {
    companionId: string;
    category: string;
    subcategory: string | null;
    visitType: string | null;
    title: string;
    businessName: string;
    issueDate: string;
    files: DocumentFile[];
    appointmentId?: string;
    accessToken: string;
  }): Promise<Document> {
    const attachments = files
      .filter(file => file.key)
      .map(file => ({
        mimeType: file.type ?? 'application/octet-stream',
        key: file.key as string,
      }));

    if (!attachments.length) {
      throw new Error('Please upload at least one document.');
    }

    const payload = {
      title,
      category: toApiSlug(category),
      subcategory: serializeSubcategoryForApi(category, subcategory),
      attachments,
      appointmentId: appointmentId ?? '',
      visitType: serializeVisitTypeForApi(visitType),
      issuingBusinessName: businessName,
      issueDate: serializeIssueDateForApi(issueDate),
    };

    const response = await apiClient.post(
      `/v1/document/mobile/${encodeURIComponent(companionId)}`,
      payload,
      {headers: withAuthHeaders(accessToken)},
    );

    const responseData = response?.data;
    const hasResponseBody =
      !!responseData &&
      typeof responseData === 'object' &&
      !Array.isArray(responseData) &&
      Object.keys(responseData as Record<string, unknown>).length > 0;

    const normalized = normalizeDocumentFromApi(
      hasResponseBody ? response.data : {...payload, attachments},
      companionId,
    );

    if (!normalized.files.length && files.length) {
      normalized.files = files;
    }

    return normalized;
  },

  async update({
    documentId,
    companionId,
    category,
    subcategory,
    visitType,
    title,
    businessName,
    issueDate,
    files,
    accessToken,
  }: {
    documentId: string;
    companionId?: string;
    category: string;
    subcategory: string | null;
    visitType: string | null;
    title: string;
    businessName: string;
    issueDate: string;
    files?: DocumentFile[];
    accessToken: string;
  }): Promise<Document> {
    const attachments = (files ?? [])
      .filter(file => file.key)
      .map(file => ({
        mimeType: file.type ?? 'application/octet-stream',
        key: file.key as string,
      }));

    const payload: Record<string, any> = {
      title,
      category: toApiSlug(category),
      subcategory: serializeSubcategoryForApi(category, subcategory),
      visitType: serializeVisitTypeForApi(visitType),
      issuingBusinessName: businessName,
      issueDate: serializeIssueDateForApi(issueDate),
    };

    if (attachments.length) {
      payload.attachments = attachments;
    }

    const {data} = await apiClient.patch(
      `/v1/document/mobile/details/${encodeURIComponent(documentId)}`,
      payload,
      {headers: withAuthHeaders(accessToken)},
    );

    const normalized = normalizeDocumentFromApi(
      data ?? {...payload, id: documentId, attachments},
      companionId,
    );

    if (!normalized.files.length && files?.length) {
      normalized.files = files;
    }

    return normalized;
  },

  async list({
    companionId,
    accessToken,
  }: {
    companionId: string;
    accessToken: string;
  }): Promise<Document[]> {
    const {data} = await apiClient.get(
      `/v1/document/mobile/${encodeURIComponent(companionId)}`,
      {headers: withAuthHeaders(accessToken)},
    );

    const collection = extractDocumentsCollection(data);
    return collection.map(doc => normalizeDocumentFromApi(doc, companionId));
  },

  async search({
    companionId,
    query,
    accessToken,
  }: {
    companionId: string;
    query: string;
    accessToken: string;
  }): Promise<Document[]> {
    const url = `/v1/document/search/${encodeURIComponent(
      companionId,
    )}?title=${encodeURIComponent(query)}`;
    const {data} = await apiClient.get(url, {
      headers: withAuthHeaders(accessToken),
    });
    const collection = extractDocumentsCollection(data);
    return collection.map(doc => normalizeDocumentFromApi(doc, companionId));
  },

  async remove({documentId, accessToken}: {documentId: string; accessToken: string}) {
    await apiClient.delete(
      `/v1/document/mobile/${encodeURIComponent(documentId)}`,
      {headers: withAuthHeaders(accessToken)},
    );
    return true;
  },

  async fetchView({
    documentId,
    accessToken,
    existingFiles,
  }: {
    documentId: string;
    accessToken: string;
    existingFiles?: DocumentFile[];
  }): Promise<DocumentFile[]> {
    const {data} = await apiClient.get(
      `/v1/document/mobile/view/${encodeURIComponent(documentId)}`,
      {headers: withAuthHeaders(accessToken)},
    );

    return normalizeViewResponse(data, existingFiles ?? []);
  },
};
