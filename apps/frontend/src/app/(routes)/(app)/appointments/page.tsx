import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Appointments — Yosemite Crew' };
import React from 'react';
import dynamic from 'next/dynamic';

const ProtectedAppointments = dynamic(
  () => import('@/app/features/appointments/pages/Appointments'),
  {
    loading: () => <div className="min-h-[50vh]" aria-hidden="true" />,
  }
);

function page() {
  return <ProtectedAppointments />;
}

export default page;
