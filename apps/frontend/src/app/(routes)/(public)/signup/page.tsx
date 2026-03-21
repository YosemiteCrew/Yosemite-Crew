'use client';
import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';
import { useAuthStore } from '@/app/stores/authStore';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

function Page() {
  const router = useRouter();
  const { status, role } = useAuthStore();

  useEffect(() => {
    if (status === 'authenticated') {
      router.push(resolveDefaultOpenScreenRoute(role));
    }
  }, [status, role, router]);

  return (
    <Suspense fallback={null}>
      <SignUp />
    </Suspense>
  );
}

export default Page;
