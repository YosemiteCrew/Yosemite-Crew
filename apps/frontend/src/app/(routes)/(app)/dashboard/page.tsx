import React from 'react';
import type { Metadata } from 'next';
import ProtectedDashboard from '@/app/features/dashboard/pages/Dashboard';

export const metadata: Metadata = { title: 'Dashboard — Yosemite Crew' };

function page() {
  return <ProtectedDashboard />;
}

export default page;
