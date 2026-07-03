import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import VerifyEmail from '@/app/features/auth/pages/VerifyEmail/VerifyEmail';

export const metadata: Metadata = {
  title: 'Verify Email — Yosemite Crew',
  description: 'Verify your Yosemite Crew account email address.',
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
