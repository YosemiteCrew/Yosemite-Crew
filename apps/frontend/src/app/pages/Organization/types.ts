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
  { label: "Owner", value: "OWNER" },
  { label: "Admin", value: "ADMIN" },
  { label: "Supervisor", value: "SUPERVISOR" },
  { label: "Veterinarian", value: "VETERINARIAN" },
  { label: "Technician", value: "TECHNICIAN" },
  { label: "Assistant", value: "ASSISTANT" },
  { label: "Receptionist", value: "RECEPTIONIST" },
];
export const StaffOptions: string[] = [
  "Dr. Emily brown",
  "Dr. Drake ramoray",
  "Dr. Philip philips",
];
export const EmploymentTypes = [
  { label: "Full time", value: "FULL_TIME" },
  { label: "Part time", value: "PART_TIME" },
  { label: "Contract", value: "CONTRACTOR" },
];
export const RoomsTypes = [
  { label: "Consultation", value: "CONSULTATION" },
  { label: "Waiting area", value: "WAITING_AREA" },
  { label: "Surgery", value: "SURGERY" },
  { label: "Icu", value: "ICU" },
];
export const OrgDocumentCategoryOptions = [
  { label: "Terms and conditions", value: "TERMS_AND_CONDITIONS" },
  { label: "Privacy policy", value: "PRIVACY_POLICY" },
  { label: "Cancellation policy", value: "CANCELLATION_POLICY" },
  { label: "Fire safety", value: "FIRE_SAFETY" },
  { label: "General", value: "GENERAL" },
];
