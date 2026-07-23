import { toTitle } from '@/app/lib/validators';
import type { StatusPillTokens } from '@/app/ui/primitives/StatusPill/StatusPill';

/**
 * Warm-bone avatar palette used across the organization surfaces. Mirrors the
 * design's SW/MB/AK monogram tiles. Kept area-local so the organization feature
 * stays self-contained (the chat feature has an equivalent list).
 */
const AVATAR_ACCENTS = [
  'bg-[var(--avatar-violet-bg)] text-[var(--avatar-violet-ink)]',
  'bg-[var(--avatar-green-bg)] text-[var(--avatar-green-ink)]',
  'bg-[var(--avatar-amber-bg)] text-[var(--avatar-amber-ink)]',
  'bg-[var(--blue-soft)] text-[var(--blue-text)]',
] as const;

/** Deterministic palette index from a stable seed, so a person keeps one color. */
export const avatarAccentFor = (seed = ''): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + (seed.codePointAt(i) ?? 0)) >>> 0;
  }
  return AVATAR_ACCENTS[hash % AVATAR_ACCENTS.length];
};

/** Up to two uppercase initials from a name; falls back to a single glyph. */
export const initialsOf = (name = ''): string => {
  const initials = name
    .split('(')[0]
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
};

export type StatusPillStyle = { label: string; tokens: StatusPillTokens };

/** The organization surfaces' status pill colours, as `StatusPill` token sets. */
export const COMPLETED_PILL_TOKENS: StatusPillTokens = {
  bg: 'var(--status-completed-bg)',
  text: 'var(--status-completed-text)',
  border: 'var(--status-completed-border)',
};
export const REQUESTED_PILL_TOKENS: StatusPillTokens = {
  bg: 'var(--status-requested-bg)',
  text: 'var(--status-requested-text)',
  border: 'var(--status-requested-border)',
};
export const UPCOMING_PILL_TOKENS: StatusPillTokens = {
  bg: 'var(--status-upcoming-bg)',
  text: 'var(--status-upcoming-text)',
  border: 'var(--status-upcoming-border)',
};
const MUTED_PILL_TOKENS: StatusPillTokens = {
  bg: 'var(--band)',
  text: 'var(--ink-muted)',
  border: 'var(--hairline)',
};

/**
 * Maps the team member's availability status onto the design's uppercase
 * micro-badge. "Requested" reads as an invited/pending member (amber), an
 * off-duty member is muted, and available/consulting members are the completed
 * green pill. The real status text is preserved rather than flattened to the
 * design's mock ACTIVE/INVITED wording; the pill renders it uppercase.
 */
export const teamStatusPill = (status?: string): StatusPillStyle => {
  const value = (status ?? '').trim().toLowerCase();
  if (value === 'requested') return { label: 'INVITED', tokens: REQUESTED_PILL_TOKENS };
  if (value === 'off-duty') return { label: 'OFF DUTY', tokens: MUTED_PILL_TOKENS };
  const label = value ? status! : 'ACTIVE';
  return { label, tokens: COMPLETED_PILL_TOKENS };
};

/** Organization type for the identity band's uppercase type pill. */
export const orgTypePillLabel = (type?: string): string =>
  (type ?? '').trim() ? type!.trim() : 'CLINIC';

/** Humanized role label (VETERINARIAN -> Veterinarian, FRONT_DESK -> Front desk). */
export const humanize = (value?: string): string => (value ? toTitle(value) : '');
