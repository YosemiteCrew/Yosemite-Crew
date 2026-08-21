import { redirect } from 'next/navigation';

import {
  buildForwardedAuthLink,
  type AuthLinkSearchParams,
} from '@/app/features/auth/lib/authLinkForwarding';

/**
 * SuperTokens emails the verification link as `/auth/verify-email?token=...`.
 * Forward it to the canonical `/verify-email`, preserving the token. See
 * `authLinkForwarding` for why this route has to exist at all.
 */
export default async function Page({
  searchParams,
}: Readonly<{ searchParams: Promise<AuthLinkSearchParams> }>) {
  redirect(buildForwardedAuthLink('/verify-email', await searchParams));
}
