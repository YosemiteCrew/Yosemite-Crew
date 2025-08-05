export type AppointmentStatus = {
  _id: string;
  appointmentDate: string;
  appointmentTime?: string;
  appointmentDay?:[ appointmentDay:string];
  ownerName: string;
  petName: string;
  department: string;
  veterinarian?: string;
};

export type AppointmentStatusFHIRBundleEntry = {
  fullUrl: string;
  resource: any; // You can define a specific FHIR Appointment type if available
};

export type AppointmentStatusFHIRBundle = {
  resourceType?: "Bundle";
  type?: "searchset";
  total?: number;
  link?: { relation: string; url: string }[];
  entry?: AppointmentStatusFHIRBundleEntry[];
  page?: number;
  limit?: number;
  totalPages?: number;
  hasMore?: boolean;
  appointmentDate?:AppointmentStatus
};




// <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<< Purpose of visit & Appointment Types >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


export type MongoPurposeOfVisit = {
  _id: string;
  name: string;
};

export type FhirPurposeOfVisit = {
  resourceType: "Basic";
  id: string;
  code: {
    coding: [
      {
        system: string;
        code: string;
        display: string;
      }
    ];
    text: string;
  };
};



export type AppointmentType = {
  _id: string;
  name: string;
  category: string;
};

export type FhirHealthcareService = {
  resourceType: "HealthcareService";
  id: string;
  type?: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text?: string;
  }[];
  category?: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text?: string;
  };
};