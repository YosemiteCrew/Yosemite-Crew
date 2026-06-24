import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';

export const metadata: Metadata = { title: 'Appointment Workspace — Yosemite Crew' };

const WorkspaceRoute = dynamic(
  () => import('@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceRoute'),
  { loading: () => <div className="min-h-[60vh]" aria-hidden="true" /> }
);

type WorkspacePageProps = {
  params: Promise<{ appointmentId: string }>;
};

async function page({ params }: WorkspacePageProps) {
  const { appointmentId } = await params;
  return (
    <main className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
        <WorkspaceRoute appointmentId={decodeURIComponent(appointmentId)} />
      </Suspense>
    </main>
  );
}

export default page;
