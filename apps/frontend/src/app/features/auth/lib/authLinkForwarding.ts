/**
 * Forwarding for the auth links SuperTokens puts in emails.
 *
 * SuperTokens builds every emailed link from the backend's websiteBasePath
 * (`AUTH_WEBSITE_BASE_PATH`, `/auth` in every environment), so a reset link
 * arrives as `/auth/reset-password?token=...` and a verification link as
 * `/auth/verify-email?token=...`. The UI for both lives one level up, at the
 * canonical `/reset-password` and `/verify-email`. Each emailed path therefore
 * needs a route that forwards to its canonical page, or the link 404s.
 *
 * That is not cosmetic for verification: `EmailVerification.init` runs with
 * `mode: 'REQUIRED'`, so a missing route blocks signup at the final step, after
 * the form has already succeeded.
 *
 * The emailed path and the app's route are decided in different places - one in
 * the backend's SuperTokens config, one by the filesystem - with nothing tying
 * them together, so this is easy to get wrong twice. Keeping the forwarding in
 * one place means the next `/auth/*` link needs only a four-line route.
 */

export type AuthLinkSearchParams = Record<string, string | string[] | undefined>;

/**
 * Build the canonical URL to forward an emailed auth link to, preserving the
 * token and every other query param.
 *
 * A repeated param keeps its first value, and empty ones are dropped, so the
 * forwarded URL is always well formed even if the mail client mangles the link.
 */
export const buildForwardedAuthLink = (
  destination: string,
  params: AuthLinkSearchParams
): string => {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value[0] != null) query.set(key, value[0]);
    } else if (value != null) {
      query.set(key, value);
    }
  }

  const qs = query.toString();
  return qs ? `${destination}?${qs}` : destination;
};
