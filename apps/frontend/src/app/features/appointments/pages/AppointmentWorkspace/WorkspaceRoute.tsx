'use client';
import React, { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  useAppointmentsForPrimaryOrg,
  useLoadAppointmentsForPrimaryOrg,
} from '@/app/hooks/useAppointments';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { isAppointmentRevampEnabled } from '@/app/lib/featureFlags';
import AppointmentWorkspace from '@/app/features/appointments/pages/AppointmentWorkspace';
import { YosemiteLoader } from '@/app/ui/overlays/Loader';
import {
  canEnterAppointmentWorkspace,
  getWorkspaceBlockedMessage,
} from '@/app/lib/appointmentWorkspace';

type WorkspaceRouteProps = {
  appointmentId: string;
};

/**
 * Client entry for the workspace route. Loads org appointments, resolves the one
 * named in the URL, and renders the workspace. Falls back to /appointments when
 * the revamp flag is off or the appointment cannot be found.
 */
const WorkspaceRoute = ({ appointmentId }: WorkspaceRouteProps) => {
  const router = useRouter();
  useLoadAppointmentsForPrimaryOrg();
  const appointments = useAppointmentsForPrimaryOrg();
  const status = useAppointmentStore((s) => s.status);

  const revampEnabled = isAppointmentRevampEnabled();

  const appointment = useMemo(
    () => appointments.find((a) => a.id === appointmentId),
    [appointments, appointmentId]
  );

  useEffect(() => {
    if (!revampEnabled) router.replace('/appointments');
  }, [revampEnabled, router]);

  if (!revampEnabled) return null;

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
          onClick={() => router.push('/appointments')}
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
        onClick={() => router.push('/appointments')}
        className="rounded-2xl border border-neutral-300 px-4 py-2 text-body-4 font-medium text-text-primary hover:bg-neutral-100"
      >
        Back to appointments
      </button>
    </div>
  );
};

export default WorkspaceRoute;
