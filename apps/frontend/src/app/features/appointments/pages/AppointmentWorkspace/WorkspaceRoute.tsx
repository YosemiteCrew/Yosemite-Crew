'use client';
import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAppointmentsForPrimaryOrg,
  useLoadAppointmentsForPrimaryOrg,
} from '@/app/hooks/useAppointments';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import AppointmentWorkspace from '@/app/features/appointments/pages/AppointmentWorkspace';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import {
  canEnterAppointmentWorkspace,
  getWorkspaceBlockedMessage,
} from '@/app/lib/appointmentWorkspace';
import { startRouteLoader } from '@/app/lib/routeLoader';

type WorkspaceRouteProps = {
  appointmentId: string;
};

/**
 * Client entry for the workspace route. Loads org appointments, resolves the one
 * named in the URL, and renders the workspace. Falls back to /appointments when
 * the appointment cannot be found.
 */
const WorkspaceRoute = ({ appointmentId }: WorkspaceRouteProps) => {
  const router = useRouter();
  useLoadAppointmentsForPrimaryOrg();
  const appointments = useAppointmentsForPrimaryOrg();
  const status = useAppointmentStore((s) => s.status);

  const appointment = useMemo(
    () => appointments.find((a) => a.id === appointmentId),
    [appointments, appointmentId]
  );

  if (appointment) {
    if (canEnterAppointmentWorkspace(appointment.status)) {
      return <AppointmentWorkspace appointment={appointment} />;
    }

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-body-2 text-text-primary">
          {getWorkspaceBlockedMessage(appointment.status)}
        </p>
        <button
          type="button"
          onClick={() => {
            startRouteLoader();
            router.push('/appointments');
          }}
          className="rounded-2xl border border-neutral-300 px-4 py-2 text-body-4 font-medium text-text-primary hover:bg-neutral-100"
        >
          Back to appointments
        </button>
      </div>
    );
  }

  if (status === 'loading' || status === 'idle') {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <YosemiteLoader testId="workspace-loader" />
      </div>
    );
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
      <p className="text-body-2 text-text-primary">Appointment not found.</p>
      <button
        type="button"
        onClick={() => {
          startRouteLoader();
          router.push('/appointments');
        }}
        className="rounded-2xl border border-neutral-300 px-4 py-2 text-body-4 font-medium text-text-primary hover:bg-neutral-100"
      >
        Back to appointments
      </button>
    </div>
  );
};

export default WorkspaceRoute;
