import type { Metadata } from 'next';
import { Suspense } from 'react';
import AuthCallback from '@/app/features/auth/pages/AuthCallback/AuthCallback';

export const metadata: Metadata = {
  title: 'Signing in · Yosemite Crew',
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthCallback />
    </Suspense>
  );
}
