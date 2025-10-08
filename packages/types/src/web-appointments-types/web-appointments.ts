export type NormalPetData = {
  petId: string;
  petName: string;
  petImage: string;
  petParentId: string;
  petParentName?: string;
  microChipNumber?:string;
  passportNumber?:string
};


export type FhirPetResource = {
  resourceType: "Patient";
  id: string;
  name: { text: string }[];
  photo: { url: string }[];
  extension: {
    url: string;
    valueString: string;
  }[];
};


export type OperationOutcomeIssue = {
  severity: "error" | "warning" | "information";
  code: string;
  details: { text: string };
};

export type OperationOutcome = {
  resourceType: "OperationOutcome";
  issue: OperationOutcomeIssue[];
};

export type PetResponse = {
  _id?:string
  petId: string;
  petName: string;
  petImage?: string;
  petParentId: string;
};




// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<doctors select options >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

export type NormalDoctorOption = {
  label: string;
  value: string;
};


export type FHIRDoctorOption = {
  resourceType: 'Practitioner';
  id: string;
  name: {
    text: string;
  };
};



// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< for getting slots to book >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

// types.ts
export type ForBookingTimeSlot = {
  time: string;
  selected: boolean;
  _id: string;
};

export type ForBookingFHIRSlot = {
  resourceType: "Slot";
  id: string;
  start: string;
  status: "free" | "busy";
};

export type TimeSlotFHIRBundle = {
  resourceType: "Bundle";
  type: "collection";
  entry: { resource: ForBookingFHIRSlot }[];
};






  //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< for book appointment >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
  export type NormalAppointmentData = {
  petId: string; // ✅ added
  petName: string;
  ownerId: string; // ✅ added
  ownerName: string;
  passportNumber: string;
  microChipNumber: string;
  purposeOfVisit: string;
  appointmentDate: string;
  appointmentTime: string;
  appointmentType: string;
  day: string;
  department: string;
  slotsId: string;
  veterinarian: string;
};

export type FHIRAppointmentBooking = {
  resourceType: "Appointment";
  id: string;
  status: string;
  serviceType: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
  }[];
  start: string;
  extension: {
    url: string;
    valueString: string;
  }[];
  participant: {
    actor: {
      reference: string; // Practitioner/{id}, RelatedPerson/{id}, Patient/{id}
      display: string;
    };
    status: string;
  }[];
};



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
  pet:string;
  breed:string
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
