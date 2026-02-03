import { Appointment } from "@yosemite-crew/types";

export const getAppointmentByIdFromList = (
  appointments: Appointment[],
  appointmentId: string | undefined
): Appointment | undefined => {
  if (!appointmentId) return undefined;
  return appointments.find((a) => a.id === appointmentId);
};

export const getCompanionNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return match?.companion?.name || "-";
};

export const getParentNameFromAppointments = (
  appointments: Appointment[],
  appointmentId: string | undefined
): string => {
  const match = getAppointmentByIdFromList(appointments, appointmentId);
  return match?.companion?.parent?.name || "-";
};
