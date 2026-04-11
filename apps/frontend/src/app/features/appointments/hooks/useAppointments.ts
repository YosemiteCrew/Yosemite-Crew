import { useAppointmentStore } from "@/app/stores/appointmentStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { loadAppointmentsForPrimaryOrg } from "@/app/features/appointments/services/appointmentService";

export const useAppointments = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  return useAppointmentStore((s) =>
    primaryOrgId ? s.getAppointmentsByOrgId(primaryOrgId) : [],
  );
};

export const useAppointmentsStatus = () =>
  useAppointmentStore((s) => s.status);

export const useAppointmentActions = () => ({
  loadAppointmentsForPrimaryOrg,
});

export { useAppointmentById } from "@/app/features/appointments/services/appointmentService";
