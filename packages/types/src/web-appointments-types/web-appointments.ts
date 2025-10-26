// types.ts
export interface MyAppointmentData {
  _id: string;
  tokenNumber: string;
  ownerName: string;
  petName: string;
  purposeOfVisit: string;
  passportNumber: string;
  microChipNumber: string;
  appointmentType: string;
  appointmentSource: string;
  slotsId: string;
  appointmentStatus: string;
  petImage: string | null;
  departmentName: string;
  veterinarianId: string;
  doctorName: string;
  pet: string;
  breed: string;
  appointmentDate: string; // e.g. "12 Aug 2025"
  appointmentTime: string; // e.g. "01:30 PM"
}

export interface FHIRAppointmentData {
  resourceType: "Appointment";
  id: string;
  status: string;
  description?: string;
  start?: string; // in our case we'll keep custom fields
  participant: Array<{
    actor?: {
      reference: string;
      display: string;
    };
    status: string;
  }>;
  extension?: Array<{
    url: string;
    valueString: string;
  }>;
}

// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< web appointments types for table >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// types.ts
export type AppointmentForTable = {
  _id: string;
  tokenNumber: string;
  petName: string;
  ownerName: string;
  slotsId: string;
  pet: string;
  breed: string;
  petImage: string;
  departmentName: string;
  purposeOfVisit: string;
  appointmentType: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentStatus: string;
  doctorName: string;
};

export type NormalResponseForTable = {
  message: string;
  totalAppointments: number;
  Appointments: AppointmentForTable[];
  pagination: {
    offset: number;
    limit: number;
    hasMore: boolean;
  };
};
