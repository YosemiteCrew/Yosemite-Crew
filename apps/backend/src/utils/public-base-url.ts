import { stripTrailingSlash } from "src/utils/strip-trailing-slash";

/**
 * Resolve the first usable absolute http(s) base URL from a list of candidates.
 *
 * `??` is not enough here: `.env.example` ships the passport and card base URLs
 * pre-declared as empty strings, and `""` is neither null nor undefined, so a
 * nullish chain stops at the blank value and shadows a correctly configured
 * fallback. Every emitted QR payload then becomes a relative, unscannable
 * `/passport/<token>`. Candidates are trimmed, blanks discarded, and the first
 * one that parses as an absolute http(s) URL wins.
 *
 * Returns null when no candidate is usable so each caller can raise the error
 * that suits its surface.
 */
export const resolvePublicBaseUrl = (
  candidates: (string | undefined)[],
): string | null => {
  for (const candidate of candidates) {
    const raw = candidate?.trim() ?? "";
    if (!raw) continue;
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      parsed = null;
    }
    if (parsed?.protocol === "http:" || parsed?.protocol === "https:") {
      return stripTrailingSlash(raw);
    }
  }
  return null;
};

/**
 * Base URL for the public passport pages, shared by the wallet pass QR and the
 * owner notification email link so the two can never disagree.
 */
export const resolvePublicPassportBaseUrl = (): string | null =>
  resolvePublicBaseUrl([
    process.env.PUBLIC_PASSPORT_BASE_URL,
    process.env.PUBLIC_CARD_BASE_URL,
  ]);
