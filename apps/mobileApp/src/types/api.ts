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