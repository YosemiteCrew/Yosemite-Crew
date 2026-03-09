'use client';
import React, { Suspense, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { useAuthStore } from '@/app/stores/authStore';
import SignIn from '@/app/features/auth/pages/SignIn/SignIn';
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
    <Suspense fallback={<div></div>}>
      <SignIn />
    </Suspense>
  );
}

export default Page;
