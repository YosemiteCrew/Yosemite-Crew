export interface IBookAppointmentRequestBody {
    data?: string;
}
export interface IParsedAppointmentDetails {
    appointmentDate: string;
    purposeOfVisit?: string;
    hospitalId: string;
    department: string;
    veterinarian: string;
    petId: string;
    slotsId: string;
    timeslot: string;
    concernOfVisit?: string;
}
export interface IAppointmentData {
    userId: string;
    hospitalId: string;
    tokenNumber: string;
    department: string;
    veterinarian: string;
    petId: string;
    ownerName: string;
    petName: string;
    petAge: string;
    petType: string;
    gender: string;
    breed: string;
    day: string;
    appointmentDate: string;
    slotsId: string;
    appointmentTime: string;
    appointmentTime24: string;
    purposeOfVisit: string;
    concernOfVisit?: string;
    appointmentSource: string;
    document: string[];
}
export interface IFHIRAppointmentData {
    resourceType: "Appointment";
    start: number;
    reasonCode: Array<{
        text: string;
    }>;
    participant: Array<{
        actor: {
            reference: string;
            display: string;
        };
        status: string;
    }>;
    description: string;
    extension: Array<{
        url: string;
        valueString: string;
    }>;
    serviceType?: Array<{
        coding: Array<{
            code: string;
        }>;
    }>;
}
// --- Types ---
export interface AppointmentInput {
    _id: string;
    ownerName: string;
    petName: string;
    appointmentTime: string; // e.g., "11:00 AM"
    hospitalId: string;
    appointmentStatus: string; // e.g., "booked", "cancelled"
    appointmentDate: string; // e.g., "2025-06-04T00:00:00.000Z"
    department: string;
    veterinarian: string | null;
}

export interface FHIRAppointmentBundleParams {
    status?: string;
    appointments: AppointmentInput[];
    totalCount: number;
}
export interface SimplifiedAppointment {
    id: string;
    petName?: string;
    veterinarian?: string;
    ownerName?: string;
    department?: string;
    dateTime: string;
    status: string;
  }
  export interface FHIRAppointment  {
    resourceType: "Appointment";
    id: string;
    status: string;
    serviceType: { text: string }[];
    start: string;
    participant: { actor: { display: string }; status: string }[];
    extension?: {
      url: string;
      valueString: string;
    }[];
  };



  //<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<Emergency Section>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

export  type NormalDoctor = {
  cognitoId: string;
  department: string;
  fullName: string;
};

export type FHIRPractitioner = {
  resourceType: "Practitioner";
  id: string;
  name: { text: string }[];
  extension?: { url: string; valueString: string }[]; // for department
};


export type NormalEmergencyAppointment = {
  email?: string;
  ownerName?: string;
  petName?: string;
  petBreed?: string;
  petType?: string;
  countryCode?: string;
  department?: string;
  gender?: string;
  phoneNumber?: string;
  userId?: string|null;
  veterinarian?: string;
  
};

export type FHIREmergencyAppointment = {
  resourceType?: "Appointment";
  id?: string;
  participant?: {
    actor: { reference: string; display?: string };
    status: string;
  }[];
  extension?: { url: string; valueString: string }[];
};





// Normal data format
export type NormalEmergencyAppointmentForTable = {
  _id: string;
  userId: string;
  hospitalId: string;
  tokenNumber: string;
  ownerName: string;
  petName: string;
  appointmentStatus: string;
  petType: string;
  petBreed: string;
  gender: string;
  phoneNumber: number;
  email: string;
  veterinarian: string; // Doctor Name
  departmentName: string;
  appointmentTime: string; // e.g., "11:00 AM"
};

// FHIR Appointment format
export type FHIREmergencyAppointmentForTable = {
  resourceType: "Appointment";
  id: string;
  identifier: { system: string; value: string }[];
  status: string;
  participant: {
    actor: {
      reference: string;
      display: string;
    };
    status: string;
  }[];
  description?: string;
  supportingInformation?: { reference: string; display: string }[];
  extension?: { url: string; valueString: string }[];
};
