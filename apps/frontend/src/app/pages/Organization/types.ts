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
  { label: "Full time", value: "FULL_TIME" },
  { label: "Part time", value: "PART_TIME" },
  { label: "Contract", value: "CONTRACTOR" },
];
export const RoomsTypes = [
  { label: "CONSULTATION", value: "CONSULTATION" },
  { label: "WAITING_AREA", value: "WAITING_AREA" },
  { label: "SURGERY", value: "SURGERY" },
  { label: "ICU", value: "ICU" },
];
export const OrgDocumentCategoryOptions = [
  { label: "TERMS AND CONDITIONS", value: "TERMS_AND_CONDITIONS" },
  { label: "PRIVACY POLICY", value: "PRIVACY_POLICY" },
  { label: "CANCELLATION POLICY", value: "CANCELLATION_POLICY" },
  { label: "FIRE SAFETY", value: "FIRE_SAFETY" },
  { label: "GENERAL", value: "GENERAL" },
];
