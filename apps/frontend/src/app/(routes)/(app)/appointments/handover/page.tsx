import type { Metadata } from 'next';
import React from 'react';
import NurseHandover from '@/app/features/appointments/pages/NurseHandover/NurseHandover';
import ProtectedRoute from '@/app/ui/layout/guards/ProtectedRoute';
import OrgGuard from '@/app/ui/layout/guards/OrgGuard';
import PageSkeleton from '@/app/ui/layout/PageSkeleton';

export const metadata: Metadata = { title: 'Shift handover — Yosemite Crew' };

const HandoverSkeleton = <PageSkeleton variant="planner" />;

const NurseHandoverRoute = () => (
  <ProtectedRoute skeleton={HandoverSkeleton}>
    <OrgGuard skeleton={HandoverSkeleton}>
      <NurseHandover />
    </OrgGuard>
  </ProtectedRoute>
);

export default NurseHandoverRoute;
