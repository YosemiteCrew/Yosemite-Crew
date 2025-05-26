export interface FHIRDepartment {
  id: string;
  name: string;
  extraDetails?: string;
  telecom?: { system: string; value: string }[];
  serviceType?: { concept?: { text?: string } }[];
  specialty?: { text?: string }[];
  program?: { text?: string }[];
  endpoint?: { reference?: string }[];
}

export interface DepartmentCustomFormat {
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

export interface DepartmentAppointmentSummary {
  _id: string;
  departmentName: string;
  count: number;
}

export interface FHIRAppointmentObservation {
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
