'use client';
import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';

import ForgotPasswordPage from '@/app/features/auth/pages/ForgotPassword/ForgotPassword';
import { useAuthStore } from '@/app/stores/authStore';
import { resolveDefaultOpenScreenRoute } from '@/app/lib/defaultOpenScreen';

function Page() {
  const router = useRouter();
  const { user, role } = useAuthStore();

  useEffect(() => {
    if (user) {
      router.push(resolveDefaultOpenScreenRoute(role));
    }
  }, [user, role, router]);

  return <ForgotPasswordPage />;
}

export default Page;
