'use client';
import React from 'react';
import { redirect, usePathname } from 'next/navigation';
import { getStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore } from '@/app/stores/authStore';
import NotADeveloperState from './NotADeveloperState';

const isLocalDeveloperFallbackEnabled = () => {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD !== 'true') return false;
  const hostname = (
    process.env.YC_TEST_HOSTNAME ?? globalThis.window?.location?.hostname
  )?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

/**
 * Blocks access to developer routes unless authenticated with developer role.
 *
 * A signed-in non-developer is shown NotADeveloperState rather than being signed
 * out. Signing them out was worse in both directions: it destroyed a perfectly
 * good session for the rest of the app just because the user opened a
 * `/developers/*` URL, and because the redirect that followed landed on the
 * developer sign-in page, a successful sign-in with the same account looped
 * straight back here. The visible result was a sign-in form that appeared to
 * reject valid credentials without ever saying why.
 */
const DevRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const authStore = useAuthStore();
  const { status, role } = authStore;
  const isPending = status === 'idle' || status === 'checking';
  const isDevPath = pathname?.startsWith('/developers');
  const devFlag =
    isLocalDeveloperFallbackEnabled() && getStorageItem('session', 'devAuth') === 'true';
  const isDevRole = role === 'developer' || devFlag;
  const isAuthenticated = status === 'authenticated' || status === 'signin-authenticated';

  // Nothing renders until auth status is known - neither the children nor the
  // rejection, since both would be a guess.
  if (isPending) return null;

  // Non-developer routes are none of this guard's business.
  if (!isDevPath) return <>{children}</>;

  if (isAuthenticated) {
    return isDevRole ? <>{children}</> : <NotADeveloperState onSignOut={authStore.signout} />;
  }

  redirect('/developers/signin');
};

export default DevRouteGuard;
