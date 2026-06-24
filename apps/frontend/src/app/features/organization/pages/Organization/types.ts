export const SpecialityOptions = ['Internal medicine', 'Surgery', 'Dermatology'];
export const RoleOptions = [
  { label: 'Owner', value: 'OWNER' },
  { label: 'Admin', value: 'ADMIN' },
  { label: 'Supervisor', value: 'SUPERVISOR' },
  { label: 'Veterinarian', value: 'VETERINARIAN' },
  { label: 'Technician', value: 'TECHNICIAN' },
  { label: 'Assistant', value: 'ASSISTANT' },
  { label: 'Receptionist', value: 'RECEPTIONIST' },
];
export const StaffOptions: string[] = [
  'Dr. Emily brown',
  'Dr. Drake ramoray',
  'Dr. Philip philips',
];
export const EmploymentTypes = [
  { label: 'Full time', value: 'FULL_TIME' },
  { label: 'Part time', value: 'PART_TIME' },
  { label: 'Contract', value: 'CONTRACTOR' },
];
export const RoomsTypes = [
  { label: 'Exam room', value: 'EXAM_ROOM' },
  { label: 'Treatment', value: 'TREATMENT' },
  { label: 'Surgery', value: 'SURGERY' },
  { label: 'Dental', value: 'DENTAL' },
  { label: 'Imaging', value: 'IMAGING' },
  { label: 'Waiting', value: 'WAITING' },
  { label: 'Grooming', value: 'GROOMING' },
  { label: 'ICU', value: 'ICU' },
  { label: 'Inpatient', value: 'INPATIENT' },
  { label: 'Isolation', value: 'ISOLATION' },
  { label: 'Boarding', value: 'BOARDING' },
  { label: 'Reception', value: 'RECEPTION' },
  { label: 'Consultation', value: 'CONSULTATION' },
];
export const UnitCapableRoomTypes = ['ICU', 'INPATIENT', 'ISOLATION', 'BOARDING'] as const;
export const RoomSpeciesOptions = [
  { label: 'Canine', value: 'CANINE' },
  { label: 'Feline', value: 'FELINE' },
  { label: 'Equine', value: 'EQUINE' },
];
export const RoomDaysOptions = [
  { label: 'Mon - Sat', value: 'MON_SAT' },
  { label: 'Mon - Fri', value: 'MON_FRI' },
  { label: 'Every day', value: 'EVERY_DAY' },
  { label: 'Weekends', value: 'WEEKENDS' },
];
export const RoomUnitSizeOptions = [
  { label: 'Small', value: 'Small' },
  { label: 'Medium', value: 'Medium' },
  { label: 'Large', value: 'Large' },
  { label: 'Extra large', value: 'Extra large' },
];
export const RoomEquipmentOptions = [
  'Oxygen Tank',
  'Anesthesia Machine',
  'Isolation Ventilation',
  'Heating Support',
  'Dental Unit',
  'Isolation unit',
  'X Ray',
  'Ultrasound Machine',
  'Wash area',
];
export const OrgDocumentCategoryOptions = [
  { label: 'Terms and conditions', value: 'TERMS_AND_CONDITIONS' },
  { label: 'Privacy policy', value: 'PRIVACY_POLICY' },
  { label: 'Cancellation policy', value: 'CANCELLATION_POLICY' },
  { label: 'Fire safety', value: 'FIRE_SAFETY' },
  { label: 'General', value: 'GENERAL' },
];
