import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import ResetPassword from '@/app/features/auth/pages/ResetPassword/ResetPassword';

export const metadata: Metadata = {
  title: 'Reset Password — Yosemite Crew',
  description: 'Set a new password for your Yosemite Crew account.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}
