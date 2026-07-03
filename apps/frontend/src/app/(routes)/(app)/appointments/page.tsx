import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Appointments — Yosemite Crew' };
import React from 'react';
import dynamic from 'next/dynamic';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

const AppointmentsPageLoader = () => (
  <div className="flex min-h-[50vh] items-center justify-center">
    <YosemiteLoader label="Loading appointments" size={96} testId="appointments-route-loader" />
  </div>
);

const ProtectedAppointments = dynamic(
  () => import('@/app/features/appointments/pages/Appointments'),
  {
    loading: () => <AppointmentsPageLoader />,
  }
);

function page() {
  return <ProtectedAppointments />;
}

export default page;
