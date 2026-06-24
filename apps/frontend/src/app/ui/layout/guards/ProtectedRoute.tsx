'use client';
import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { useAuthStore } from '@/app/stores/authStore';

type ProtectedRouteProps = {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
};

const AUTH_SESSION_KEY = 'yc_auth_passed';
const writeAuthPassed = () => setStorageItem('session', AUTH_SESSION_KEY, '1');
const clearAuthPassed = () => removeStorageItem('session', AUTH_SESSION_KEY);

const isLocalGuardBypassEnabled = () => {
  if (process.env.NEXT_PUBLIC_DISABLE_AUTH_GUARD !== 'true') return false;
  const hostname = (
    process.env.YC_TEST_HOSTNAME ?? globalThis.window?.location?.hostname
  )?.toLowerCase();
  return hostname === 'localhost' || hostname === '127.0.0.1';
};

const ProtectedRoute = ({ children, skeleton = null }: ProtectedRouteProps) => {
  const status = useAuthStore((s) => s.status);
  const router = useRouter();
  const pathname = usePathname() || '/';

  const isChecking = status === 'idle' || status === 'checking';
  const isAuthed = status === 'authenticated' || status === 'signin-authenticated';

  const isAuthGuardDisabled = isLocalGuardBypassEnabled();

  useFullscreenLoader('auth-guard', !isAuthGuardDisabled && isChecking);

  useEffect(() => {
    if (isAuthGuardDisabled) return;
    if (isChecking) return;
    if (isAuthed) {
      writeAuthPassed();
    } else {
      clearAuthPassed();
      router.replace(`/signin?next=${encodeURIComponent(pathname)}`);
    }
  }, [isAuthGuardDisabled, isChecking, isAuthed, router, pathname]);

  if (isAuthGuardDisabled) {
    return <>{children}</>;
  }

  // Do not mount protected children until Cognito confirms the session. Cached
  // proof only avoids skeleton flicker; it must not allow stale org loaders to
  // fire while a token is being refreshed.
  if (isChecking) {
    return <>{skeleton}</>;
  }
  if (!isAuthed) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
