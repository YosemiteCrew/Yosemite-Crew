import type { Metadata } from 'next';
import React from 'react';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PublicBookingSetup from '@/app/features/onboarding/pages/PublicBookingSetup/PublicBookingSetup';

export const metadata: Metadata = { title: 'Set up online booking — Yosemite Crew' };

const Page = () => (
  <ProtectedRoute>
    <OrgGuard>
      <PublicBookingSetup />
    </OrgGuard>
  </ProtectedRoute>
);

export default Page;
