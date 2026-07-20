/**
 * Build the shareable deep link for a guide. Falls back to a relative path when
 * there is no window (SSR / tests without jsdom origin).
 */
export const buildGuideDeepLink = (guideId: string): string => {
  /* v8 ignore next 2 -- SSR/empty-origin fallback; window.location.origin is always defined and not redefinable under jsdom */
  const origin =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  return `${origin}/guides?guide=${guideId}`;
};

export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the graceful failure below
  }
  return false;
};
