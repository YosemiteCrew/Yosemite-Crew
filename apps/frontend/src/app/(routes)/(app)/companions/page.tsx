import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Companions — Yosemite Crew' };
import React from 'react';
import dynamic from 'next/dynamic';

const ProtectedCompanions = dynamic(
  () => import('@/app/features/companions/pages/Companions/Companions'),
  {
    loading: () => <div className="min-h-[50vh]" aria-hidden="true" />,
  }
);

function page() {
  return <ProtectedCompanions />;
}

export default page;
