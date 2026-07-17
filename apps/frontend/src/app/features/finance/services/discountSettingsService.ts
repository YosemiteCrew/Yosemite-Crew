import { getData, putData } from '@/app/services/axios';

const FINANCE_BASE_PATH = '/v1/finance';

export type OrganisationDiscountSettings = {
  organisationId: string;
  /** Null is a real state: no cap configured, so the overall discount is unconstrained. */
  maxOverallDiscountPercent: number | null;
};

type FinanceEnvelope<T> = {
  data: T;
  meta?: unknown;
  error?: { code?: string; message?: string } | null;
};

const discountSettingsPath = (organisationId: string) =>
  `${FINANCE_BASE_PATH}/organisation/${organisationId}/discount-settings`;

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

const normalizeSettings = (
  value: unknown,
  organisationId: string
): OrganisationDiscountSettings => {
  const settings = (value ?? {}) as Partial<OrganisationDiscountSettings>;
  const percent = settings.maxOverallDiscountPercent;
  return {
    organisationId: settings.organisationId ?? organisationId,
    maxOverallDiscountPercent: typeof percent === 'number' ? percent : null,
  };
};

/**
 * Human-readable message from a finance API error. The finance controllers reply
 * with a bare `{ message }` on failure (not the success envelope), and axios only
 * carries "Request failed with status code N" on `error.message` — so read the body.
 */
export const getDiscountSettingsErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const data = (error as { response?: { data?: unknown } }).response?.data;
    if (typeof data === 'object' && data !== null) {
      const body = data as { message?: unknown; error?: { message?: unknown } };
      const message = body.error?.message ?? body.message;
      if (typeof message === 'string' && message.trim()) return message.trim();
    }
  }
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return fallback;
};

export const getOrganisationDiscountSettings = async (
  organisationId: string
): Promise<OrganisationDiscountSettings> => {
  if (!organisationId) throw new Error('Organisation ID missing');
  const res = await getData<FinanceEnvelope<unknown> | unknown>(
    discountSettingsPath(organisationId)
  );
  return normalizeSettings(unwrapFinanceData(res.data), organisationId);
};

export const updateOrganisationDiscountSettings = async (
  organisationId: string,
  input: { maxOverallDiscountPercent: number | null }
): Promise<OrganisationDiscountSettings> => {
  if (!organisationId) throw new Error('Organisation ID missing');
  const res = await putData<FinanceEnvelope<unknown> | unknown>(
    discountSettingsPath(organisationId),
    input
  );
  return normalizeSettings(unwrapFinanceData(res.data), organisationId);
};
