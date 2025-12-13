import { useEffect, useMemo } from "react";
import { useOrgStore } from "../stores/orgStore";
import { loadAppointmentsForPrimaryOrg } from "../services/appointmentService";
import { Appointment } from "@yosemite-crew/types";
import { useAppointmentStore } from "../stores/appointmentStore";

export const useLoadAppointmentsForPrimaryOrg = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);

  useEffect(() => {
    if (!primaryOrgId) return;
    void loadAppointmentsForPrimaryOrg({ force: true });
  }, [primaryOrgId]);
};

export const useAppointmentsForPrimaryOrg = (): Appointment[] => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const appointmentsById = useAppointmentStore((s) => s.appointmentsById);
  const appointmentIdsByOrgId = useAppointmentStore(
    (s) => s.appointmentIdsByOrgId
  );

  return useMemo(() => {
    if (!primaryOrgId) return [];
    const ids = appointmentIdsByOrgId[primaryOrgId] ?? [];
    return ids
      .map((id) => appointmentsById[id])
      .filter((a): a is Appointment => a != null);
  }, [primaryOrgId, appointmentsById, appointmentIdsByOrgId]);
};
