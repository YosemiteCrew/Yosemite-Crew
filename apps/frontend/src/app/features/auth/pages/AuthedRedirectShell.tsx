'use client';

import { Suspense, useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/app/stores/authStore';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

/**
 * Wrapper for the sign in / sign up route pages: forwards an already-authenticated
 * visitor to their post-auth destination, and renders the auth screen inside a
 * Suspense boundary otherwise.
 */
export default function AuthedRedirectShell({ children }: Readonly<{ children: ReactNode }>) {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);

  useEffect(() => {
    if (status === 'authenticated') {
      void resolvePostAuthRedirect({ fallbackRole: role }).then((route) => {
        router.replace(route);
      });
    }
  }, [status, role, router]);

  return <Suspense fallback={null}>{children}</Suspense>;
}
