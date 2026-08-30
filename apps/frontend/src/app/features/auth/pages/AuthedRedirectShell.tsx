'use client';

import { Suspense, useEffect, useState, type ReactNode } from 'react';
import { redirect } from 'next/navigation';
import { useAuthStore } from '@/app/stores/authStore';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

/**
 * Wrapper for the sign in / sign up route pages: forwards an already-authenticated
 * visitor to their post-auth destination, and renders the auth screen inside a
 * Suspense boundary otherwise.
 */
export default function AuthedRedirectShell({ children }: Readonly<{ children: ReactNode }>) {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);
  const roles = useAuthStore((s) => s.roles);
  const isAuthenticated = status === 'authenticated';
  const [route, setRoute] = useState<string | null>(null);

  // Public route pages don't otherwise bootstrap the SuperTokens session check, so an
  // already-authenticated visitor would sit at `idle` forever and never get forwarded.
  // Kick off the check once so `status` resolves and the redirect logic below can run.
  useEffect(() => {
    if (status === 'idle') {
      void useAuthStore.getState().checkSession();
    }
  }, [status]);

  // The destination depends on client-only session state, so it cannot be resolved on
  // the server. Resolve it in an effect and navigate with `redirect()` during render so
  // the auth screen is never painted for a visitor who is on their way somewhere else.
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    void resolvePostAuthRedirect({ fallbackRole: role, roles }).then((nextRoute) => {
      if (!cancelled) setRoute(nextRoute);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, role, roles]);

  if (route) {
    redirect(route);
  }

  if (isAuthenticated) {
    return null;
  }

  return <Suspense fallback={null}>{children}</Suspense>;
}
