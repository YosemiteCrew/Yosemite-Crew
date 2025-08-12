export type FHIRDepartment = {
  resourceType: string;
  id: string;
  providedBy?: {
    reference: string;
  };
  telecom?: { system: string; value: string }[];
  extension?: { url: string; valueString: string }[];
  serviceType?: { type: { text: string } }[];
};


export type DepartmentCustomFormat = {
  departmentId: string;
  bussinessId: string;
  phone: string;
  countrycode: string;
  email: string;
  biography: string;
  departmentHeadId: string;
  services: string[];
};

export type DepartmentAppointmentSummary ={
  _id: string;
  departmentId: string;
  count: number;
}

export type FHIRAppointmentObservation ={
  resourceType: 'Observation';
  id?: string;
  status: 'final';
  code: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  effectiveDateTime: string;
  valueInteger: number;
  extension: {
    url: string;
    valueString: string;
  }[];
}
export type CustomDepartmentInput = {
  departmentId: string;
  description: string;
  email: string;
  phone: string;
  countrycode: string;
  services: string[]; // e.g., ['E001', 'S001']
  conditionsTreated: string[]; // e.g., ['D001', 'H001']
  consultationModes: string[]; // ['In-person', 'Online']
  departmentHeadId: string;
  bussinessId: string;
}







export type NormalDepartment = {
  _id: string;
  name: string;
};

export type FHIRHealthcareService = {
  resourceType: "HealthcareService";
  id: string;
  name: string;
};