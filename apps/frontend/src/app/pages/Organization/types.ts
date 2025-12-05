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
  "Vet",
  "Receptionist",
  "Technician",
  "Admin",
  "Assistant",
  "Admin",
];
export const StaffOptions: string[] = [
  "Dr. Emily brown",
  "Dr. Drake ramoray",
  "Dr. Philip philips",
];
