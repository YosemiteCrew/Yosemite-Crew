import { redirect } from 'next/navigation';

import {
  buildForwardedAuthLink,
  type AuthLinkSearchParams,
} from '@/app/features/auth/lib/authLinkForwarding';

/**
 * SuperTokens emails the password reset link as `/auth/reset-password?token=...`.
 * Forward it to the canonical `/reset-password`, preserving the token, which
 * `submitNewPassword` reads from the final URL. See `authLinkForwarding` for why
 * this route has to exist at all.
 */
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<AuthLinkSearchParams> }>) {
  redirect(buildForwardedAuthLink('/reset-password', await searchParams));
}
