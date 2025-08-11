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


export type SearchPetsRequestBody = {
  names?: string;
  microChip?: string;
};

// Optional: define response structure (simplified for clarity)
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
  petName: string;
  ownerName: string;
  passportNumber: string;
  microChipNumber: string;
  purposeOfVisit: string;
  appointmentDate: string; // keep as-is
  appointmentTime: string; // keep as-is
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
    coding: { system: string; code: string; display: string }[];
  }[];
  start: string; // appointmentDate as-is
  extension: { url: string; valueString: string }[];
  participant: {
    actor: { reference: string; display: string };
    status: string;
  }[];
};
