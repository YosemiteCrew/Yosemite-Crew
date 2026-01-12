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
export const RoomsTypes = [
  { label: "CONSULTATION", key: "CONSULTATION" },
  { label: "WAITING_AREA", key: "WAITING_AREA" },
  { label: "SURGERY", key: "SURGERY" },
  { label: "ICU", key: "ICU" },
];
export const RoomsTypes2 = [
  { label: "CONSULTATION", value: "CONSULTATION" },
  { label: "WAITING_AREA", value: "WAITING_AREA" },
  { label: "SURGERY", value: "SURGERY" },
  { label: "ICU", value: "ICU" },
];
export const OrgDocumentCategoryOptions = [
  { label: "TERMS AND CONDITIONS", key: "TERMS_AND_CONDITIONS" },
  { label: "PRIVACY POLICY", key: "PRIVACY_POLICY" },
  { label: "CANCELLATION POLICY", key: "CANCELLATION_POLICY" },
  { label: "FIRE SAFETY", key: "FIRE_SAFETY" },
  { label: "GENERAL", key: "GENERAL" },
];
export const OrgDocumentCategoryOptions2 = [
  { label: "TERMS AND CONDITIONS", value: "TERMS_AND_CONDITIONS" },
  { label: "PRIVACY POLICY", value: "PRIVACY_POLICY" },
  { label: "CANCELLATION POLICY", value: "CANCELLATION_POLICY" },
  { label: "FIRE SAFETY", value: "FIRE_SAFETY" },
  { label: "GENERAL", value: "GENERAL" },
];
