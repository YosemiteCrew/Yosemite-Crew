const AVATAR_ACCENTS = [
  'bg-[var(--avatar-violet-bg)] text-[var(--avatar-violet-ink)]',
  'bg-[var(--avatar-green-bg)] text-[var(--avatar-green-ink)]',
  'bg-[var(--avatar-amber-bg)] text-[var(--avatar-amber-ink)]',
  'bg-[var(--blue-soft)] text-[var(--blue-text)]',
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
