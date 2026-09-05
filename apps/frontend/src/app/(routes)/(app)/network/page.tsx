'use client';

import { Suspense } from 'react';
import dynamic from 'next/dynamic';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';

const NetworkDirectory = dynamic(
  () => import('@/app/features/federation/components/NetworkDirectory'),
  { ssr: false, loading: () => null }
);

function NetworkPageContent() {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <div className="yc-page-content">
          <NetworkDirectory />
        </div>
      </OrgGuard>
    </ProtectedRoute>
  );
}

export default function NetworkPage() {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <NetworkPageContent />
    </Suspense>
  );
}
