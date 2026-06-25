import type { Metadata } from 'next';
import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';

export const metadata: Metadata = { title: 'Appointment Workspace — Yosemite Crew' };

const WorkspacePageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <YosemiteLoader label="Loading workspace" size={96} testId="workspace-route-loader" />
  </div>
);

const WorkspaceRoute = dynamic(
  () => import('@/app/features/appointments/pages/AppointmentWorkspace/WorkspaceRoute'),
  { loading: () => <WorkspacePageLoader /> }
);

type WorkspacePageProps = {
  params: Promise<{ appointmentId: string }>;
};

async function page({ params }: WorkspacePageProps) {
  const { appointmentId } = await params;
  return (
    <main className="w-full px-4 py-5 sm:px-6 lg:px-8">
      <Suspense fallback={<WorkspacePageLoader />}>
        <WorkspaceRoute appointmentId={decodeURIComponent(appointmentId)} />
      </Suspense>
    </main>
  );
}

export default page;
