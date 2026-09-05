import countries from '@/app/lib/data/countryList';
import { parsePhoneNumberFromString } from 'libphonenumber-js';
import { isEmail } from 'validator';

export const validatePhone = (phone: string) => {
  const number = parsePhoneNumberFromString(phone);
  return number?.isValid() || false;
};

export const getCountryCode = (country: string | undefined) => {
  if (!country) {
    return null;
  }
  const temp = countries.filter((c) => c.name === country);
  if (temp.length > 0) return temp[0];
  return null;
};

export const isValidEmail = (email: string) => {
  const cleaned = email.trim();
  return isEmail(cleaned);
};

export const normalizeEmail = (email: string) => email.trim();

export const getEmailValidationError = (
  email: string,
  requiredMessage = 'Email is required',
  invalidMessage = 'Enter a valid email'
) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return requiredMessage;
  }

  if (!isValidEmail(normalizedEmail)) {
    return invalidMessage;
  }

  return null;
};

export const toTitleCase = (value = '') => {
  if (typeof value !== 'string' || !value.length) return '';
  return value[0].toUpperCase() + value.slice(1).toLowerCase();
};

export const toTitle = (str = '') => {
  const s = String(str).trim().replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').toLowerCase();

  return s.charAt(0).toUpperCase() + s.slice(1);
};

export const toNumberSafe = (value: unknown, fallback = 0): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * True when a field carries no value at all, as opposed to the value zero.
 *
 * `Number('')`, `Number('   ')` and `Number(null)` are all 0, so neither
 * `toNumberSafe` above nor the inventory one can tell "nobody filled this in"
 * from "somebody typed 0". That conflation is the root of a family of bugs: an
 * unpriced item reported as free, an uncounted item reported as worthless, and
 * a blank price SAVED as a real zero.
 */
const isBlank = (value: unknown): boolean =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

/**
 * For anything a person READS: blank is unknown, not zero. Returns undefined
 * for a missing value so the caller can show an em dash, and for a value that
 * is not a number at all.
 */
export const toDisplayNumber = (value: unknown): number | undefined => {
  if (isBlank(value)) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

/**
 * For anything the app SENDS to an API. Three states, because the API has
 * three:
 *
 * - blank -> `null`, which an update path writes as null and so CLEARS the
 *   field, and which a create path maps back to undefined and so omits.
 *   Sending 0 here is what stored an unpriced item as costing nothing.
 * - not a number -> `undefined`, omitted, so a malformed field leaves the
 *   stored value alone rather than wiping it.
 * - a number -> itself, zero included.
 *
 * Verified against apps/backend/src/services/inventory.service.ts:
 * `applyNullableUpdates` skips undefined and writes `value ?? null`, the create
 * path does `input.sellingPrice ?? undefined`, and `ensureNonNegativeNumbers`
 * only rejects negatives, so it tolerates both null and undefined.
 */
export const toPayloadNumber = (value: unknown): number | null | undefined => {
  if (isBlank(value)) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};
