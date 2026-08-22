'use client';
import React, { useEffect } from 'react';
import { redirect, usePathname } from 'next/navigation';

import { removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useFullscreenLoader } from '@/app/hooks/useFullscreenLoader';
import { useAuthStore } from '@/app/stores/authStore';
import { isLocalGuardBypassEnabled } from '@/app/lib/localGuardBypass';

type ProtectedRouteProps = {
  children: React.ReactNode;
  skeleton?: React.ReactNode;
};

const AUTH_SESSION_KEY = 'yc_auth_passed';
const writeAuthPassed = () => setStorageItem('session', AUTH_SESSION_KEY, '1');
const clearAuthPassed = () => removeStorageItem('session', AUTH_SESSION_KEY);

const ProtectedRoute = ({ children, skeleton = null }: ProtectedRouteProps) => {
  const status = useAuthStore((s) => s.status);
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
    }
  }, [isAuthGuardDisabled, isChecking, isAuthed]);

  if (isAuthGuardDisabled) {
    return <>{children}</>;
  }

  // Do not mount protected children until the auth provider confirms the
  // session. Cached proof only avoids skeleton flicker; it must not allow
  // stale org loaders to fire while the session is being refreshed.
  if (isChecking) {
    return <>{skeleton}</>;
  }
  if (!isAuthed) {
    redirect(`/signin?next=${encodeURIComponent(pathname)}`);
  }

  return <>{children}</>;
};

export default ProtectedRoute;
