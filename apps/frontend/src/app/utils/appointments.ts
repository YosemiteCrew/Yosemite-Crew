import { AppointmentStatus } from "../types/appointments";

export const allowReschedule = (status: AppointmentStatus) => {
  if (status === "REQUESTED" || status === "UPCOMING") {
    return true;
  }
  return false;
};
