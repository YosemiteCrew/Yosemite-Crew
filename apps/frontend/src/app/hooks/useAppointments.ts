import { useEffect, useMemo } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { Appointment } from '@yosemite-crew/types';
import { useAppointmentStore } from '@/app/stores/appointmentStore';

export const useLoadAppointmentsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const appointmentIdsByOrgId = useAppointmentStore((s) => s.appointmentIdsByOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    if (useAppointmentStore.getState().status === 'loading') return;
    if (Object.hasOwn(appointmentIdsByOrgId, primaryOrgId)) return;
    void loadAppointmentsForPrimaryOrg();
  }, [primaryOrgId, appointmentIdsByOrgId]);
};

export const useAppointmentsForPrimaryOrg = (): Appointment[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const appointmentsById = useAppointmentStore((s) => s.appointmentsById);
  const appointmentIdsByOrgId = useAppointmentStore((s) => s.appointmentIdsByOrgId);

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = appointmentIdsByOrgId[primaryOrgId] ?? [];
    return ids.map((id) => appointmentsById[id]).filter((a): a is Appointment => a != null);
  }, [primaryOrgId, appointmentsById, appointmentIdsByOrgId]);
};

export const useAppointmentsForCompanionInPrimaryOrg = (companionId?: string): Appointment[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const appointmentsById = useAppointmentStore((s) => s.appointmentsById);
  const appointmentIdsByOrgId = useAppointmentStore((s) => s.appointmentIdsByOrgId);
  return useMemo(() => {
    if (!primaryOrgId || !companionId) return [];
    const ids = appointmentIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => appointmentsById[id])
      .filter(Boolean)
      .filter((a) => a.companion.id === companionId);
  }, [primaryOrgId, companionId, appointmentsById, appointmentIdsByOrgId]);
};
