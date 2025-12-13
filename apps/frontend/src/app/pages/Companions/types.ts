import {
  Companion,
  CompanionRequestDTO,
  Parent,
  ParentRequestDTO,
} from "@yosemite-crew/types";

export type CompanionProps = {
  image: string;
  name: string;
  breed: string;
  species: string;
  parent: string;
  gender: string;
  age: string;
  lastMedication: string;
  vaccineDue: string;
  upcomingAppointent: string;
  upcomingAppointentTime: string;
  status: string;

  dateOfBirth?: string;
  weight?: string;
  color?: string;
  neuteredStatus?: "yes" | "no";
  ageWhenNeutered?: string;
  bloodGroup?: string;
  countryOfOrigin?: string;
  petCameFrom?: string;
  microchipNumber?: string;
  passportNumber?: string;
  insurancePolicy?: string;
  insuranceNumber?: string;
  parentNumber?: string;
  parentEmail?: string;
  coParentName?: string;
  coParentEmail?: string;
  coParentNumber?: string;
};

export type StoredParent = Parent & {
  id: string;
};

export type StoredCompanion = Companion & {
  id: string;
  organisationId: string;
  parentId: string;
};

export type CompanionParent = {
  companion: StoredCompanion;
  parent: StoredParent;
};

export type RequestCompanion = {
  companion: CompanionRequestDTO;
  parent: ParentRequestDTO;
};

export type GetCompanionResponse = RequestCompanion[];
