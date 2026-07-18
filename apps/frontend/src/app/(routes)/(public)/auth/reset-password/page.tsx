import { redirect } from 'next/navigation';

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * SuperTokens emails the password reset link under the backend's websiteBasePath
 * (default `/auth`), i.e. `/auth/reset-password?token=...`. The reset UI lives at the
 * canonical `/reset-password`, so forward here while preserving the token and any
 * other query params. This is a server-side redirect (no client-side navigation);
 * submitNewPassword reads the token from the final URL, so nothing is lost.
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
  redirect(qs ? `/reset-password?${qs}` : '/reset-password');
}
