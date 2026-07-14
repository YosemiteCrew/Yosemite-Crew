'use client';
import React, { useEffect, useState } from 'react';
import { redirect, usePathname } from 'next/navigation';
import { getStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore } from '@/app/stores/authStore';

const isLocalDeveloperFallbackEnabled = () => {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD !== 'true') return false;
  const hostname = (
    process.env.YC_TEST_HOSTNAME ?? globalThis.window?.location?.hostname
  )?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

/**
 * Blocks access to developer routes unless authenticated with developer role.
 */
const DevRouteGuard = ({ children }: { children: React.ReactNode }) => {
  const pathname = usePathname();
  const authStore = useAuthStore();
  const { status, role } = authStore;
  const [allowed, setAllowed] = useState(false);
  const isPending = status === 'idle' || status === 'checking';
  const isDevPath = pathname?.startsWith('/developers');
  const devFlag =
    isLocalDeveloperFallbackEnabled() && getStorageItem('session', 'devAuth') === 'true';
  const isDevRole = role === 'developer' || devFlag;
  const isAuthenticated = status === 'authenticated' || status === 'signin-authenticated';

  useEffect(() => {
    // Wait for auth status to be determined
    if (isPending) return;

    if (!isDevPath) {
      setAllowed(true);
      return;
    }

    if (isAuthenticated && isDevRole) {
      setAllowed(true);
      return;
    }

    // Authenticated but not a developer - sign out and redirect
    if (isAuthenticated && !isDevRole) {
      authStore.signout();
    }
  }, [isPending, isDevPath, isAuthenticated, isDevRole, authStore]);

  // Only redirect once the session is actually cleared. For an authenticated
  // non-developer the effect above calls signout() first, which flips status to
  // 'unauthenticated' and lands us here on the next render — redirecting eagerly
  // during this render would throw before that signout effect ever commits,
  // leaving the user logged in while bounced to the developer sign-in page.
  if (!isPending && isDevPath && status === 'unauthenticated') {
    redirect('/developers/signin');
  }

  if (!allowed) return null;

  return <>{children}</>;
};

export default DevRouteGuard;
