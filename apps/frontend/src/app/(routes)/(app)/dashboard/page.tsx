import React from 'react';
import type { Metadata } from 'next';
import dynamic from 'next/dynamic';

export const metadata: Metadata = { title: 'Dashboard — Yosemite Crew' };

const ProtectedDashboard = dynamic(() => import('@/app/features/dashboard/pages/Dashboard'), {
  loading: () => <div className="min-h-[50vh]" aria-hidden="true" />,
});

function page() {
  return <ProtectedDashboard />;
}

export default page;
