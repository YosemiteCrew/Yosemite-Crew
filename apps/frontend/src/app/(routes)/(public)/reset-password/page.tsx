import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import ResetPassword from '@/app/features/auth/pages/ResetPassword/ResetPassword';

export const metadata: Metadata = {
  title: 'Reset Password — Yosemite Crew',
  description: 'Set a new password for your Yosemite Crew account.',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}
