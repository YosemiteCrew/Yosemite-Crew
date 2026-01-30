import { filter, status, StatusOption } from "../pages/Companions/types";

export type AppointmentStatus =
  | "NO_PAYMENT"
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

const opt = (value: string, label: string) => ({ value, label });

export const AppointmentStatusOptions = [
  opt("NO_PAYMENT", "No payment"),
  opt("REQUESTED", "Requested"),
  opt("UPCOMING", "Upcoming"),
  opt("CHECKED_IN", "Checked in"),
  opt("IN_PROGRESS", "In progress"),
  opt("COMPLETED", "Completed"),
  opt("CANCELLED", "Cancelled"),
  opt("NO_SHOW", "No show"),
];

export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type AvailabilityWindow = {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  isAvailable: boolean;
  vetIds: string[];
};

export type AvailabilityData = {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: DayOfWeek;
  windows: AvailabilityWindow[];
};

export interface AvailabilityResponse {
  success: boolean;
  data: AvailabilityData;
}

export type Slot = {
  startTime: string;
  endTime: string;
  vetIds: string[];
};

export type SlotsResponse = {
  slots: Slot[];
};

export const AppointmentStatusFilters: StatusOption[] = [
  status("All", "all", "#F1D4B0", "#000"),
  status("No payment", "no_payment", "#5C614B"),
  status("Requested", "requested", "#747283"),
  status("Upcoming", "upcoming", "#F1D4B0", "#000"),
  status("Checked-in", "checked_in", "#A8A181"),
  status("In progress", "in_progress", "#BF9FAA"),
  status("Completed", "completed", "#D28F9A"),
  status("Cancelled", "cancelled", "#D9A488"),
  status("No show", "no_show", "#747283"),
];

export const AppointmentFilters = [
  filter("All", "all"),
  filter("Emergencies", "emergencies"),
];

type ReasonOptions =
  | "APPOINTMENT_USAGE"
  | "MANUAL_ADJUSTMENT"
  | "GROOMING_USAGE"
  | "BOARDING_USAGE"
  | "OTHER";

export type InventoryConsumeRequest = {
  itemId: string;
  quantity: number;
  reason: ReasonOptions;
  referenceId?: string;
};
