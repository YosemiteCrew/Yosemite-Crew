export interface PetDetails {
  id: string;
  name: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate: string;
  speciesDisplay?: { value: 'Horse' | 'Dog' | 'Cat' };
  breed: string;
  genderStatusDisplay: string;
  weight: string;
  color: string;
  ageWhenNeutered: string;
  microchipNumber: string;
  insuranceCompany: string;
  policyNumber: string;
  passportNumber: string;
  origin: string;
  isInsured: boolean;
}

export interface FHIRPatient {
  resourceType: 'Patient';
  id: string;
  name: { text: string }[];
  gender: string;
  birthDate: string;
  animal: {
    species: {
      coding: {
        system: string;
        code: string;
        display?: string;
      }[];
    };
    breed: {
      text: string;
    };
    genderStatus: {
      coding: {
        system: string;
        code: string;
        display: string;
      }[];
    };
  };
  extension: any[];
}

// Add these to src/types/api.ts

// Describes the input for the buildImmunization function
export interface ImmunizationDetails {
  manufacturer: string;
  vaccineName: string;
  batchNumber: string;
  expiryDate: string;      // e.g., "2025-12-31"
  vaccinationDate: string; // e.g., "2024-09-15"
  businessName: string;
  nextDueOn: string;
  patientId: string;
}

// Describes the FHIR Immunization object that is returned
export interface FHIRImmunization {
  resourceType: 'Immunization';
  status: 'completed';
  vaccineCode: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  patient: {
    reference: string;
  };
  occurrenceDateTime: string;
  primarySource: boolean;
  manufacturer: { display: string };
  lotNumber: string;
  expirationDate: string;
  performer: {
    actor: {
      display: string;
    };
  }[];
  note: {
    text: string;
  }[];
}

// Add these to src/types/api.ts

// Describes the input for the buildMonthlySlotFHIRResource function
export interface MonthlySlotDetails {
  startDate: string; // e.g., "2025-09-01T10:00:00Z"
  month: number;     // e.g., 9
  year: number;      // e.g., 2025
  practitionerId: string;
  status?: 'proposed' | 'pending' | 'booked'; // Optional, as it has a default
  description?: string; // Optional, as it has a default
}

// Describes the FHIR Appointment object that is returned
export interface FHIRAppointment {
  resourceType: 'Appointment';
  status: string;
  description: string;
  start: string;
  extension: {
    url: string;
    valueInteger: number;
  }[];
  participant: {
    actor: {
      reference: string;
    };
    status: 'accepted';
  }[];
}

// Add these to src/types/api.ts

// Describes the input for the buildOrganizationFHIR function. All are optional.
export interface OrganizationDetails {
  id?: string;
  name?: string;
  email?: string;
  website?: string;
  phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  subjectReference?: string;
}

// Describes the FHIR Organization object that is returned
export interface FHIROrganization {
  resourceType: 'Organization';
  id: string;
  name: string;
  subject?: {
    reference: string;
  };
  telecom: {
    system: 'phone' | 'email' | 'url';
    value: string;
  }[];
  address: {
    line?: string[];
    city?: string;
    postalCode?: string;
    country?: string;
  }[];
}

// Add these to src/types/api.ts

// Create a specific type for all the possible component keys
export type FHIRComponentKey =
  | 'activityLevel' | 'glucose' | 'weight' | 'insulinIntake'
  | 'hba1c' | 'mealInfo' | 'stressLevel' | 'sleepHours'
  | 'bloodPressureSystolic' | 'bloodPressureDiastolic' | 'notes';

// Describes the input for the buildDiabetesObservation function
export interface DiabetesObservationDetails {
  patientId: string;
  encounterId: string;
  componentsData: {
    key: FHIRComponentKey;
    value: string | number | boolean;
  }[];
}

// Describes the structure of a single component in the FHIR Observation
interface FHIRObservationComponent {
  code: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueQuantity?: {
    value: number;
    unit: string;
    system: string;
    code: string;
  };
}

// Describes the final FHIR Observation object
export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'final';
  category: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
  }[];
  code: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  subject: {
    reference: string;
  };
  encounter: {
    reference: string;
  };
  effectiveDateTime: string;
  component: FHIRObservationComponent[];
}

// Add these to src/types/api.ts

// Describes the input for the createDocumentReference function
export interface DocumentReferenceDetails {
  resourceType?: 'DocumentReference';
  typeText?: string;
  description: string;
  date: string; // e.g., "2025-09-15T12:00:00Z"
  contextPeriodEnd: string;
  patientId: string;
  folderId: string;
}

// Describes the FHIR DocumentReference object that is returned
export interface FHIRDocumentReference {
  resourceType: 'DocumentReference';
  type: {
    text: string;
    reference: string;
  };
  author: {
    display: 'petOwner';
  };
  description: string;
  date: string;
  context: {
    period: {
      end: string;
    };
  };
  subject: {
    reference: string;
  };
}

// Add these to src/types/api.ts

// Describes the input for the createObservation function
export interface ObservationDetails {
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  valueString: string; // The feedback text
  rating: number;      // The star rating
}

// Describes the FHIR Observation object that is returned
export interface FHIRObservationFeedback {
  resourceType: 'Observation';
  status: 'final';
  category: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
  }[];
  code: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
    text: string;
  };
  subject: {
    reference: string;
  };
  performer: {
    reference: string;
  }[];
  basedOn: {
    reference: string;
  }[];
  effectiveDateTime: string;
  valueString: string;
  component: {
    code: {
      coding: {
        system: string;
        code: string;
        display: string;
      }[];
    };
    valueQuantity: {
      value: number;
      unit: string;
      system: string;
      code: string;
    };
  }[];
}

// Add these to src/types/api.ts

// Describes the input for the createPetAppointmentFHIRResource function
export interface PetAppointmentDetails {
  petId: string;
  doctorId: string;
  businessId: string;
  startDateTime: string; // e.g., "2025-09-15T11:00:00+05:30"
  description: string;
  reasonText: string;
  departmentId: string;
  departmentName: string;
  slotId: string;
}

// Describes the FHIR Appointment object that is returned
export interface FHIRPetAppointment {
  resourceType: 'Appointment';
  status: 'booked';
  start: string;
  description: string;
  participant: {
    actor: {
      reference: string;
    };
    status: 'accepted';
  }[];
  reasonCode: {
    text: string;
  }[];
  serviceType: {
    coding: {
      system: string;
      code: string;
      display: string;
    }[];
  }[];
  extension: {
    url: string;
    valueString: string;
  }[];
}

// Add these to src/types/api.ts

// Describes a single extension within a FHIR resource
interface FHIRExtension {
  title: string;
  valueString?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  // Special case for petImage which is an object
  valueAttachment?: {
    url: string;
    originalname: string;
    mimetype: string;
    _id: string;
  };
}

// Describes the FHIR Patient resource as it exists in your bundle
interface FHIRPatientWithExtensions {
  id: string;
  name?: { text: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  animal?: {
    species?: { coding?: { display: string }[] };
    breed?: { coding?: { display: string }[] };
    genderStatus?: { coding?: { display: string }[] };
  };
  extension: FHIRExtension[];
}

// Describes the top-level FHIR Bundle structure
export interface FHIRBundle {
  entry: {
    resource: FHIRPatientWithExtensions;
  }[];
}

// Describes the final, simplified Pet object that the function returns
export interface ExtractedPet {
  id: string;
  name: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  species: string;
  breed: string;
  genderStatus: string;
  // Allows for any other properties extracted from extensions
  [key: string]: any;
}

