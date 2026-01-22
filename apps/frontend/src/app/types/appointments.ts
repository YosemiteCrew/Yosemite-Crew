import { StatusOption } from "../pages/Companions/types";

export type AppointmentStatus =
  | "NO_PAYMENT"
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

export const AppointmentStatusOptions = [
  { value: "NO_PAYMENT", label: "No payment" },
  { value: "REQUESTED", label: "Requested" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "CHECKED_IN", label: "Checked in" },
  { value: "IN_PROGRESS", label: "In progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "NO_SHOW", label: "No show" },
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
  {
    name: "All",
    key: "all",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "No payment",
    key: "no_payment",
    bg: "#5C614B",
    text: "#fff",
  },
  {
    name: "Requested",
    key: "requested",
    bg: "#747283",
    text: "#fff",
  },
  {
    name: "Upcoming",
    key: "upcoming",
    bg: "#F1D4B0",
    text: "#000",
  },
  {
    name: "Checked-in",
    key: "checked_in",
    bg: "#A8A181",
    text: "#fff",
  },
  {
    name: "In progress",
    key: "in_progress",
    bg: "#BF9FAA",
    text: "#fff",
  },
  {
    name: "Completed",
    key: "completed",
    bg: "#D28F9A",
    text: "#fff",
  },
  {
    name: "Cancelled",
    key: "cancelled",
    bg: "#D9A488",
    text: "#fff",
  },
  {
    name: "No show",
    key: "no_show",
    bg: "#747283",
    text: "#fff",
  },
];

export const AppointmentFilters = [
  {
    name: "All",
    key: "all",
  },
  {
    name: "Emergencies",
    key: "emergencies",
  },
];