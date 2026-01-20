export type Status =
  | "Requested"
  | "Upcoming"
  | "Checked-in"
  | "In-progress"
  | "Completed"
  | "Cancelled"
  | "Post-care";

export type AppointmentStatus =
  | "NO_PAYMENT"
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED";

export const AppointmentStatusOptions = [
  { value: "NO_PAYMENT", label: "No Payment" },
  { value: "REQUESTED", label: "Requested" },
  { value: "UPCOMING", label: "Upcoming" },
  { value: "CHECKED_IN", label: "Checked In" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

export type AppointmentsProps = {
  name: string;
  parentName: string;
  image: string;
  reason: string;
  emergency: boolean;
  service: string;
  room: string;
  time: string;
  date: string;
  lead: string;
  leadDepartment: string;
  support: string[];
  status: Status;
  breed: string;
  species: string;
  start: Date;
  end: Date;
};

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
}

export type AvailabilityData = {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: DayOfWeek;
  windows: AvailabilityWindow[];
}

export interface AvailabilityResponse {
  success: boolean;
  data: AvailabilityData;
}

export type Slot = {
  startTime: string;
  endTime: string;
  vetIds: string[];
}

export type SlotsResponse = {
  slots: Slot[];
}
