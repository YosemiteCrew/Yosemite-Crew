// src/shared/utils/staleness.ts
//
// How old is the content on screen, expressed as an i18n key plus a count.
//
// Buckets use SHORT units ("5 min ago", "1 min ago") rather than full words on
// purpose: short forms read naturally at every count in both shipped locales,
// so no translation needs plural categories. That matters more than it sounds -
// plural rules differ per language, and a staleness banner is the wrong place
// to introduce a class of translation bug.

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export interface StalenessLabel {
  /** i18n key under `common`. */
  key: string;
  /** Interpolation value, absent for the "just now" and unknown cases. */
  count?: number;
}

/**
 * Describe the age of a last-successful-fetch timestamp.
 *
 * `undefined` means there has never been a successful fetch to age from, which
 * is a different statement from "it was a long time ago" and gets its own copy.
 * A timestamp in the future (clock skew, or a device whose time moved back) is
 * treated as "just now" rather than rendering a negative count.
 */
export const describeStaleness = (
  lastLoadedAt: number | undefined,
  now: number = Date.now(),
): StalenessLabel => {
  if (typeof lastLoadedAt !== 'number' || !Number.isFinite(lastLoadedAt)) {
    return {key: 'common.stale_updated_unknown'};
  }

  const age = now - lastLoadedAt;

  if (age < MINUTE_MS) {
    return {key: 'common.stale_updated_just_now'};
  }
  if (age < HOUR_MS) {
    return {
      key: 'common.stale_updated_minutes',
      count: Math.floor(age / MINUTE_MS),
    };
  }
  if (age < DAY_MS) {
    return {
      key: 'common.stale_updated_hours',
      count: Math.floor(age / HOUR_MS),
    };
  }
  return {key: 'common.stale_updated_days', count: Math.floor(age / DAY_MS)};
};
