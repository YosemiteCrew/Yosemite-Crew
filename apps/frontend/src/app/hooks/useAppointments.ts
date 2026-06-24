import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import type { Appointment } from '@yosemite-crew/types';

const withCompanionFallback = (appointment?: Appointment): AppointmentWithCompanion | null => {
  const companion = appointment?.companion ?? appointment?.patient;
  if (!appointment || !companion) return null;
  return {
    ...appointment,
    companion,
  };
};

export const useLoadAppointmentsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    const state = useAppointmentStore.getState();
    if (state.status === 'loading') return;
    if (Object.hasOwn(state.appointmentIdsByOrgId ?? {}, primaryOrgId)) return;
    void loadAppointmentsForPrimaryOrg();
  }, [primaryOrgId]);
};

export const useAppointmentsForPrimaryOrg = (): AppointmentWithCompanion[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const appointmentsById = useAppointmentStore((s) => s.appointmentsById);
  const appointmentIdsByOrgId = useAppointmentStore((s) => s.appointmentIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = appointmentIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => appointmentsById[id])
      .map(withCompanionFallback)
      .filter((appointment): appointment is AppointmentWithCompanion => appointment !== null);
  }, [primaryOrgId, appointmentsById, appointmentIdsByOrgId]);
};

export const useAppointmentsForCompanionInPrimaryOrg = (
  companionId?: string
): AppointmentWithCompanion[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const appointmentsById = useAppointmentStore((s) => s.appointmentsById);
  const appointmentIdsByOrgId = useAppointmentStore((s) => s.appointmentIdsByOrgId);
  return useMemo(() => {
    if (!primaryOrgId || !companionId) return [];
    const ids = appointmentIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => appointmentsById[id])
      .map(withCompanionFallback)
      .filter((appointment): appointment is AppointmentWithCompanion => appointment !== null)
      .filter((appointment) => appointment.companion.id === companionId);
  }, [primaryOrgId, companionId, appointmentsById, appointmentIdsByOrgId]);
};
