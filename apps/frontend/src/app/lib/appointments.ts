import { AppointmentStatus } from "@/app/features/appointments/types/appointments";

export const allowReschedule = (status: AppointmentStatus) => {
  if (status === "REQUESTED" || status === "UPCOMING" || status === "NO_PAYMENT") {
    return true;
  }
  return false;
};
