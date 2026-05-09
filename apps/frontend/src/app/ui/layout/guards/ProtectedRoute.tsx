'use client';
import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { useAuthStore } from '@/app/stores/authStore';

type ProtectedRouteProps = {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
};

const AUTH_SESSION_KEY = 'yc_auth_passed';
const readAuthPassed = (): boolean => getStorageItem('session', AUTH_SESSION_KEY) === '1';
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

  // Fast-path: if this session has already authenticated, skip skeleton on the
  // idle→checking transition so navigations between pages feel instant.
  const [cachedAuthed] = useState(() => isAuthGuardDisabled || readAuthPassed());

  useFullscreenLoader('auth-guard', !isAuthGuardDisabled && isChecking && !cachedAuthed);

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

  // Show skeleton only when we're checking AND have no cached session proof.
  if (isChecking && !cachedAuthed) {
    return <>{skeleton}</>;
  }
  if (!isAuthed && !cachedAuthed) return null;

  return <>{children}</>;
};

export default ProtectedRoute;
