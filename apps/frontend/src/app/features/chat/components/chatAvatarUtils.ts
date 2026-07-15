const AVATAR_ACCENTS = [
  'bg-primary-100 text-primary-700',
  'bg-success-100 text-success-700',
  'bg-warning-100 text-warning-700',
  'bg-danger-100 text-danger-700',
  'bg-brand-100 text-brand-950',
  'bg-neutral-200 text-neutral-700',
] as const;

/** Deterministic palette index from a stable seed, so a person keeps one color. */
export const accentFor = (seed: string): string => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + (seed.codePointAt(i) ?? 0)) >>> 0;
  }
  return AVATAR_ACCENTS[hash % AVATAR_ACCENTS.length];
};

/** Up to two uppercase initials, ignoring any "(owner)" suffix. */
export const initialsOf = (name: string): string => {
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
