import type { Metadata } from 'next';
export const metadata: Metadata = { title: 'Appointments — Yosemite Crew' };
import React from 'react';
import ProtectedAppointments from '@/app/features/appointments/pages/Appointments';

function page() {
  return <ProtectedAppointments />;
}

export default page;
