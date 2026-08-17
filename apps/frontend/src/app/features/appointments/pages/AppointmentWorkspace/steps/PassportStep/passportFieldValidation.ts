import { isValidClinicalDate } from '@/app/features/petPassport/services/passportRecords.service';

/** Per-field messages keyed by draft field name; an absent key means "valid". */
export type FieldErrors = Record<string, string | undefined>;

export const hasFieldErrors = (errors: FieldErrors): boolean => Object.values(errors).some(Boolean);

export const requiredTextError = (label: string, value: string): string | undefined =>
  value.trim() ? undefined : `${label} is required.`;

/**
 * A passport date lands on a travel health document, so the backend takes only
 * an unambiguous ISO-8601 calendar date and rejects calendar overflow
 * ("2026-02-30") and ambiguous formats ("01/02/2026"). Validating with the same
 * rule keeps the clinician's feedback immediate instead of a round-trip 400.
 */
export const clinicalDateError = (
  label: string,
  value: string,
  options: { required?: boolean } = {}
): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return options.required ? `${label} is required.` : undefined;
  if (!isValidClinicalDate(trimmed)) {
    return `${label} must be a real calendar date in YYYY-MM-DD format.`;
  }
  return undefined;
};

// `datetime-local` yields "2026-02-14T09:30" - no seconds and no offset, which
// the backend rejects. The instant is resolved in the browser's zone and sent as
// a full ISO-8601 timestamp instead.
const LOCAL_DATE_TIME_PATTERN = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(:\d{2})?$/;

export const isoInstantFromLocal = (value: string): string | undefined => {
  const trimmed = value.trim();
  const match = LOCAL_DATE_TIME_PATTERN.exec(trimmed);
  // The date half is checked on its own because `new Date` silently rolls an
  // impossible day over ("2026-02-30T10:00" would become 2 March).
  if (!match || !isValidClinicalDate(match[1])) return undefined;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
};

export const localDateTimeError = (label: string, value: string): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return `${label} is required.`;
  if (!isoInstantFromLocal(trimmed)) return `${label} must be a real date and time.`;
  return undefined;
};

export const numberError = (
  label: string,
  value: string,
  options: { required?: boolean; min?: number } = {}
): string | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return options.required ? `${label} is required.` : undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return `${label} must be a number.`;
  if (options.min !== undefined && parsed < options.min) {
    return `${label} must be ${options.min} or more.`;
  }
  return undefined;
};

/** Optional payload fields are omitted rather than sent as an empty string. */
export const optionalText = (value: string): string | undefined => value.trim() || undefined;

export const optionalNumber = (value: string): number | undefined => {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};
