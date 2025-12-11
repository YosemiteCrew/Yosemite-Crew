export type Room = {
  name: string;
  type: string;
  assignedSpeciality: string;
  assignedStaff: string;
};

export type Document = {
  title: string;
  description: string;
  date: string;
  lastUpdated: string;
};

export type AvailabilityProps = {
  name: string;
  image: string;
  role: string;
  speciality: string;
  todayAppointment: string;
  weeklyWorkingHours: string;
  status: string;
};

export const SpecialityOptions = [
  "Internal medicine",
  "Surgery",
  "Dermatology",
];
export const RoleOptions = [
  "OWNER",
  "ADMIN",
  "SUPERVISOR",
  "VETERINARIAN",
  "TECHNICIAN",
  "ASSISTANT",
  "RECEPTIONIST",
];
export const StaffOptions: string[] = [
  "Dr. Emily brown",
  "Dr. Drake ramoray",
  "Dr. Philip philips",
];
export const EmploymentTypes = [
  { name: "Full time", key: "FULL_TIME" },
  { name: "Part time", key: "PART_TIME" },
  { name: "Contract", key: "CONTRACTOR" },
];
