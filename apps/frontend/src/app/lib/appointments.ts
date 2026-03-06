import { AppointmentStatus } from "@/app/features/appointments/types/appointments";

export const allowReschedule = (status: AppointmentStatus) => {
  if (status === "UPCOMING") {
    return true;
  }
  return false;
};

export const allowCalendarDrag = (status: AppointmentStatus) => {
  if (
    status === "NO_PAYMENT" ||
    status === "REQUESTED" ||
    status === "UPCOMING"
  ) {
    return true;
  }
  return false;
};
