'use client';
import React, { Suspense } from 'react';

import SignUp from '@/app/features/auth/pages/SignUp/SignUp';
import { useAuthStore } from '@/app/stores/authStore';
import PostAuthRedirect from '@/app/features/auth/components/PostAuthRedirect';

export default function SignUpPage() {
  const status = useAuthStore((s) => s.status);
  const role = useAuthStore((s) => s.role);

  if (status === 'authenticated') {
    return (
      <Suspense fallback={null}>
        <PostAuthRedirect fallbackRole={role} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={null}>
      <SignUp />
    </Suspense>
  );
}
