import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SuperTokens emails the verification link under the backend's websiteBasePath
 * (`AUTH_WEBSITE_BASE_PATH`, `/auth` in every environment), i.e.
 * `/auth/verify-email?token=...`. The verification UI lives at the canonical
 * `/verify-email`, so forward here while preserving the token and any other
 * query params.
 *
 * Without this route the emailed link 404s. That is not cosmetic:
 * `EmailVerification.init` runs with `mode: 'REQUIRED'`, so a new account cannot
 * be used until it is verified - a 404 here blocks every signup at the last
 * step, after the form has already succeeded. Reported from production by a
 * prospect who could sign up but never get in.
 *
 * This mirrors the sibling `auth/reset-password` route, which forwards the reset
 * link for the same reason. Keep the two in step: any future SuperTokens link
 * that is emailed under `/auth/*` needs a shim like this, because the emailed
 * path and the app's route are decided in different places.
 *
 * Deliberately a server-side redirect (no client-side navigation): VerifyEmail
 * reads the token from the final URL, so nothing is lost. Being a pure redirect
 * it renders no markup, which is why - like auth/reset-password - it is absent
 * from STRICT_CSP_PATH_PREFIXES in middleware.ts.
 */
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      if (value[0] != null) query.set(key, value[0]);
    } else if (value != null) {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  redirect(qs ? `/verify-email?${qs}` : '/verify-email');
}
