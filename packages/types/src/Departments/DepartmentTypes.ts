export type FHIRDepartment = {
  id: string;
  name: string;
  extraDetails?: string;
  telecom?: {
    system: string;
    value: string;
  }[];
  serviceType?: {
    concept?: {
      text?: string;
    };
  }[];
  specialty?: {
    text?: string;
  }[];
  program?: {
    text?: string;
  }[];
  endpoint?: {
    reference?: string;
  }[];
}

export type DepartmentCustomFormat = {
  departmentName: string;
  description: string;
  email: string;
  phone: string;
  bussinessId: string;
  countrycode: string;
  services: string[];
  conditionsTreated: string[];
  consultationModes: string[];
  departmentHeadId: string | null;
}

export type DepartmentAppointmentSummary ={
  _id: string;
  departmentName: string;
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
  departmentName: string;
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