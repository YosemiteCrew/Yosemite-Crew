// The FINAL and COMPLETE code for src/types/api.ts

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
    species: { coding: { system: string; code: string; display?: string }[] };
    breed: { text: string };
    genderStatus: { coding: { system: string; code: string; display: string }[] };
  };
  extension: any[];
}

export interface ImmunizationDetails {
  manufacturer: string;
  vaccineName: string;
  batchNumber: string;
  expiryDate: string;
  vaccinationDate: string;
  businessName: string;
  nextDueOn: string;
  patientId: string;
}

export interface FHIRImmunization {
  resourceType: 'Immunization';
  status: 'completed';
  vaccineCode: { coding: { system: string; code: string; display: string }[]; text: string };
  patient: { reference: string };
  occurrenceDateTime: string;
  primarySource: boolean;
  manufacturer: { display: string };
  lotNumber: string;
  expirationDate: string;
  performer: { actor: { display: string } }[];
  note: { text: string }[];
}

export interface MonthlySlotDetails {
  startDate: string;
  month: number;
  year: number;
  practitionerId: string;
  status?: 'proposed' | 'pending' | 'booked';
  description?: string;
}

export interface FHIRAppointment {
  resourceType: 'Appointment';
  status: string;
  description: string;
  start: string;
  extension: { url: string; valueInteger: number }[];
  participant: { actor: { reference: string }; status: 'accepted' }[];
}

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

export interface FHIROrganization {
  resourceType: 'Organization';
  id: string;
  name: string;
  subject?: { reference: string };
  telecom: { system: 'phone' | 'email' | 'url'; value: string }[];
  address: { line?: string[]; city?: string; postalCode?: string; country?: string }[];
}

export type FHIRComponentKey =
  | 'activityLevel' | 'glucose' | 'weight' | 'insulinIntake'
  | 'hba1c' | 'mealInfo' | 'stressLevel' | 'sleepHours'
  | 'bloodPressureSystolic' | 'bloodPressureDiastolic' | 'notes';

export interface DiabetesObservationDetails {
  patientId: string;
  encounterId: string;
  componentsData: {
    key: FHIRComponentKey;
    value: string | number | boolean;
  }[];
}

export interface FHIRObservationComponent {
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueQuantity?: { value: number; unit: string; system: string; code: string };
}

export interface FHIRObservation {
  resourceType: 'Observation';
  id: string;
  status: 'final';
  category: { coding: { system: string; code: string; display: string }[] }[];
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  subject: { reference: string };
  encounter: { reference: string };
  effectiveDateTime: string;
  component: FHIRObservationComponent[];
}

export interface DocumentReferenceDetails {
  resourceType?: 'DocumentReference';
  typeText?: string;
  description: string;
  date: string;
  contextPeriodEnd: string;
  patientId: string;
  folderId: string;
}

export interface FHIRDocumentReference {
  resourceType: 'DocumentReference';
  type: { text: string; reference: string };
  author: { display: 'petOwner' };
  description: string;
  date: string;
  context: { period: { end: string } };
  subject: { reference: string };
}

export interface ObservationDetails {
  appointmentId: string;
  patientId: string;
  practitionerId: string;
  valueString: string;
  rating: number;
}

export interface FHIRObservationFeedback {
  resourceType: 'Observation';
  status: 'final';
  category: { coding: { system: string; code: string; display: string }[] }[];
  code: { coding: { system: string; code: string; display: string }[]; text: string };
  subject: { reference: string };
  performer: { reference: string }[];
  basedOn: { reference: string }[];
  effectiveDateTime: string;
  valueString: string;
  component: { code: { coding: { system: string; code: string; display: string }[] }; valueQuantity: { value: number; unit: string; system: string; code: string } }[];
}

export interface PetAppointmentDetails {
  petId: string;
  doctorId: string;
  businessId: string;
  startDateTime: string;
  description: string;
  reasonText: string;
  departmentId: string;
  departmentName: string;
  slotId: string;
}

export interface FHIRPetAppointment {
  resourceType: 'Appointment';
  status: 'booked';
  start: string;
  description: string;
  participant: { actor: { reference: string }; status: 'accepted' }[];
  reasonCode: { text: string }[];
  serviceType: { coding: { system: string; code: string; display: string }[] }[];
  extension: { url: string; valueString: string }[];
}

export interface FHIRExtension {
  title: string;
  valueString?: string;
  valueInteger?: number;
  valueBoolean?: boolean;
  valueAttachment?: { url: string; originalname: string; mimetype: string; _id: string };
}

export interface FHIRPatientWithExtensions {
  id: string;
  name?: { text: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  animal?: { species?: { coding?: { display: string }[] }; breed?: { coding?: { display: string }[] }; genderStatus?: { coding?: { display: string }[] } };
  extension: FHIRExtension[];
}

export interface FHIRBundle {
  entry: {
    resource: FHIRPatientWithExtensions;
  }[];
}

export interface ExtractedPet {
  id: string;
  name: string;
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  species: string;
  breed: string;
  genderStatus: string;
  [key: string]: any;
}

export interface FHIRHealthcareService {
  id: string;
  name: string;
  extension?: {
    url: string;
    valueInteger?: number;
  }[];
}

export interface FHIROrganizationWithDetails {
  id: string;
  name: string;
  image?: string;
  type?: { coding?: { display?: string; code?: string }[] }[];
  address?: { text?: string; extension?: { url: string; extension?: { url: 'latitude' | 'longitude'; valueDecimal?: string }[] }[] }[];
  extension?: { url: string; valueString?: string; valueDecimal?: number; valueUrl?: string }[];
  healthcareServices?: FHIRHealthcareService[];
}

export interface ParsedOrganization {
  id: string;
  name: string;
  logo?: string;
  type: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  healthcareServices: { id: string; name: string; doctorCount: number }[];
  [key: string]: any;
}

export interface FHIRPractitionerResource {
  id: string;
  name?: { text: string }[];
  department?: { code?: { text: string } }[];
  qualification?: { code?: { text: string } }[];
  extension?: {
    title: 'averageRating' | 'consultationFee' | 'experienceYears' | 'doctorImage';
    valueDecimal?: number;
    valueInteger?: number;
    valueString?: string;
  }[];
}

export interface ParsedPractitioner {
  id: string;
  name: string;
  specialization: string;
  qualification: string;
  averageRating?: number;
  consultationFee?: number;
  experienceYears?: number;
  doctorImage?: string;
}

export interface FHIRParticipant {
  actor: {
    reference: string;
    display?: string;
    extension?: {
      url: string;
      valueString?: string;
      valueArray?: { valueString: string }[];
    }[];
  };
}

export interface FHIRRawAppointment {
  id: string;
  start: string;
  status: string;
  reasonCode?: { text: string }[];
  participant: FHIRParticipant[];
  extension?: {
    url: string;
    valueString?: string;
    valueArray?: { valueString: string }[];
  }[];
}

export interface TransformedAppointment {
  id: string;
  date: string;
  time: string;
  slotId: string;
  status: string;
  reason: string;
  vetId: string;
  petId: string;
  vet: {
    name: string;
    departmentId: string;
    qualification: string;
    specialization: string;
    image: string;
  };
  pet: {
    name: string;
    image: string;
  };
  location: string;
  businessId: string;
}

export interface AllAppointmentsApiResponse {
  data?: {
    [key in 'upcoming' | 'pending' | 'past' | 'cancel']?: {
      data: FHIRRawAppointment[];
    };
  };
}

export interface AllAppointments {
  upcoming: TransformedAppointment[];
  pending: TransformedAppointment[];
  past: TransformedAppointment[];
  cancel: TransformedAppointment[];
}

export interface FHIRRawDocument {
  id?: string;
  type?: { text: string };
  description?: string;
  date?: string;
  context?: { period?: { end: string } };
  effectiveDateTime?: string;
  subject?: {
    identifier?: { value: string };
    image?: string;
  };
  content?: { attachment?: { url?: string; title?: string; contentType?: string } }[];
  extension?: {
    url?: string;
    valueString?: string;
    valueInteger?: number;
    valueBoolean?: boolean;
    valueDateTime?: string;
  }[];
}

export interface TransformedDocument {
  id: string;
  type: string;
  description: string;
  date: string;
  expiry: string;
  createdDate: string;
  patientId: string;
  petId: string;
  petImageUrl: string;
  attachments: { url: string; title: string; contentType: string }[];
  [key: string]: any;
}

export interface FHIRRawImmunization {
  id: string;
  vaccineCode?: { text: string };
  status?: string;
  occurrenceDateTime?: string;
  manufacturer?: { display: string };
  lotNumber?: string;
  location?: { display: string };
  patient?: {
    petImageUrl?: string;
    reference?: string;
  };
  note?: { text: string }[];
  contained?: { content?: { attachment: { contentType?: string; title?: string; url?: string } }[] }[];
}

export interface TransformedImmunization {
  id: string | number;
  status: string;
  vaccine: string;
  date: string | null;
  manufacturer: string | null;
  lotNumber: string | null;
  location: string | null;
  nextDue: string | null;
  expiryDate: string | null;
  petImage: string | null;
  petId: string | null;
  attachments: { title: string; url: string; type: 'image' | 'pdf' | 'other' }[];
}

export interface FHIRRawObservationFeedback {
  id?: string;
  extension?: { url: string; valueString?: string }[];
  performer?: { reference?: string }[];
  subject?: { reference?: string };
  valueInteger?: number;
  note?: { text: string }[];
  effectiveDateTime?: string;
}

export interface TransformedObservation {
  appointmentId: string;
  vetId: string;
  petId: string;
  feedbackText: string;
  rating: number | null;
  date: string;
  vet: { name: string; qualification: string; specialization: string; image: string };
  feedBackId?: string;
}

export interface FHIRPatientForList {
  id: string;
  name?: { text?: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  animal?: {
    species?: { coding?: { display: string }[] };
    breed?: { coding?: { display: string }[] };
    genderStatus?: { coding?: { display: string }[] };
  };
  profileCompletion?: number;
  extension?: {
    url?: string;
    valueString?: string | { url?: string };
    valueInteger?: number;
    valueBoolean?: boolean;
  }[];
}

export interface TransformedPet {
  id: string | number;
  title: string;
  textColor: string;
  petImage: string | null;
}

// New types for updateObservation.js
export interface UpdateObservationDetails {
  patientId: string;
  feedback: string;
  rating: number;
  date?: string;
}

export interface FHIRObservationUpdate {
  resourceType: 'Observation';
  status: 'final';
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
  effectiveDateTime: string;
  valueString: string;
  component: {
    code: {
      text: string;
    };
    valueInteger: number;
  }[];
}

