'use client';
import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';
import { useAuthStore } from '@/app/stores/authStore';
import { resolvePostAuthRedirect } from '@/app/lib/postAuthRedirect';

function Page() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);

  // Redirect already-authenticated users away from the sign-up page
  useEffect(() => {
    if (status === 'authenticated' || status === 'signin-authenticated') {
      void resolvePostAuthRedirect({ fallbackRole: role }).then((route) => {
        router.replace(route);
      });
    }
  }, [status, role, router]);

  return (
    <Suspense fallback={null}>
      <SignUp />
    </Suspense>
  );
}

export default Page;
