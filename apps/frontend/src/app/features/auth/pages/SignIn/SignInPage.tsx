'use client';
import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import SignIn from '@/app/features/auth/pages/SignIn/SignIn';
import { useAuthStore } from '@/app/stores/authStore';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

export default function SignInPage() {
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

  return (
    <Suspense fallback={null}>
      <SignIn />
    </Suspense>
  );
}
