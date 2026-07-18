import React, { Suspense } from 'react';
import type { Metadata } from 'next';

import VerifyEmail from '@/app/features/auth/pages/VerifyEmail/VerifyEmail';

export const metadata: Metadata = {
  title: 'Verify Email — Yosemite Crew',
  description: 'Verify your Yosemite Crew account email address.',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}
