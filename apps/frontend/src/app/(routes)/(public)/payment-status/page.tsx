import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import { PaymentStatusContent } from './PaymentStatusContent';

export const metadata: Metadata = {
  title: 'Payment Status — Yosemite Crew',
};

// Rendered per request so the middleware's nonce CSP applies. A prerendered
// page has no per-request nonce, which would force script-src 'unsafe-inline'.
export const dynamic = 'force-dynamic';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <PaymentStatusContent />
    </Suspense>
  );
}
