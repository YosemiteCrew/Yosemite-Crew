import type {
  CodeableConcept,
  Identifier,
  Patient,
  Extension,
} from "@yosemite-crew/fhirtypes";
import { InsuranceDetails } from "./insuranceDetails";

export type CompanionType = "dog" | "cat" | "horse" | "other";
export type Gender = "male" | "female" | "unknown";
export type SourceType =
  | "shop"
  | "breeder"
  | "foster_shelter"
  | "friends_family"
  | "unknown";
export type RecordStatus = "active" | "archived" | "deleted";

export interface Companion {
  _id?: string;
  name: string;
  type: CompanionType;
  breed: string;
  //breedID
  dateOfBirth: Date;
  gender: Gender;
  photoUrl?: string;

  currentWeight?: number;
  colour?: string;
  allergy?: string;
  bloodGroup?: string;

  isneutered?: boolean; 
  ageWhenNeutered?: string;

  microchipNumber?: string;
  passportNumber?: string;

  isInsured: boolean;
  insurance?: InsuranceDetails;

  countryOfOrigin?: string;
  source?: SourceType;
  status?: RecordStatus;
  createdAt?: Date;
  updatedAt?: Date;
}

export const SPECIES_SYSTEM_URL = "http://hl7.org/fhir/animal-species";
export const GENDER_STATUS_SYSTEM_URL = "http://hl7.org/fhir/animal-genderstatus";
export const MICROCHIP_IDENTIFIER_SYSTEM_URL =
  "http://example.org/fhir/Identifier/microchip";
export const PASSPORT_IDENTIFIER_SYSTEM_URL =
  "http://example.org/fhir/Identifier/passport";
export const EXTENSION_BLOOD_GROUP_URL =
  "http://example.org/fhir/StructureDefinition/companion-blood-group";
export const EXTENSION_COLOUR_URL =
  "http://example.org/fhir/StructureDefinition/companion-colour";
export const EXTENSION_COUNTRY_OF_ORIGIN_URL =
  "http://example.org/fhir/StructureDefinition/companion-country-of-origin";
export const EXTENSION_SOURCE_URL =
  "http://example.org/fhir/StructureDefinition/companion-source";
export const EXTENSION_WEIGHT_URL =
  "http://example.org/fhir/StructureDefinition/companion-weight";
export const EXTENSION_ALLERGY_URL =
  "http://example.org/fhir/StructureDefinition/companion-allergy";
export const EXTENSION_AGE_WHEN_NEUTERED_URL =
  "http://example.org/fhir/StructureDefinition/companion-age-when-neutered";

export const COMPANION_SPECIES_MAP: Record<
  CompanionType,
  { code?: string; display: string }
> = {
  dog: { code: "canislf", display: "Dog" },
  cat: { code: "feline", display: "Cat" },
  horse: { code: "equine", display: "Horse" },
  other: { display: "Other" },
};

const formatToFHIRDate = (value?: Date | string): string | undefined => {
  const date = normalizeToDate(value);
  return date ? date.toISOString().split("T")[0] : undefined;
};

const formatToFHIRDateTime = (value?: Date | string): string | undefined => {
  const date = normalizeToDate(value);
  return date ? date.toISOString() : undefined;
};

const normalizeToDate = (value?: Date | string): Date | undefined => {
  if (!value) {
    return undefined;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const buildSpeciesConcept = (type: CompanionType): CodeableConcept => {
  const config = COMPANION_SPECIES_MAP[type];
  const text = config.display;

  return {
    coding: config.code
      ? [
          {
            system: SPECIES_SYSTEM_URL,
            code: config.code,
            display: text,
          },
        ]
      : undefined,
    text,
  };
};

const buildGenderStatusConcept = (
  isNeutered: boolean | undefined
): CodeableConcept | undefined => {
  if (typeof isNeutered !== "boolean") {
    return undefined;
  }

  const code = isNeutered ? "neutered" : "intact";
  const display = isNeutered ? "Neutered" : "Intact";

  return {
    coding: [
      {
        system: GENDER_STATUS_SYSTEM_URL,
        code,
        display,
      },
    ],
    text: display,
  };
};

const buildIdentifiers = (companion: Companion): Identifier[] | undefined => {
  const identifiers: Identifier[] = [];

  if (companion.microchipNumber) {
    identifiers.push({
      system: MICROCHIP_IDENTIFIER_SYSTEM_URL,
      value: companion.microchipNumber,
      type: {
        text: "Microchip Number",
      },
    });
  }

  if (companion.passportNumber) {
    identifiers.push({
      system: PASSPORT_IDENTIFIER_SYSTEM_URL,
      value: companion.passportNumber,
      type: {
        text: "Passport Number",
      },
    });
  }

  return identifiers.length > 0 ? identifiers : undefined;
};

const buildExtensions = (companion: Companion): Extension[] | undefined => {
  const extensions: Extension[] = [];

  if (companion.bloodGroup) {
    extensions.push({
      url: EXTENSION_BLOOD_GROUP_URL,
      valueString: companion.bloodGroup,
    });
  }

  if (companion.colour) {
    extensions.push({
      url: EXTENSION_COLOUR_URL,
      valueString: companion.colour,
    });
  }

  if (typeof companion.currentWeight === "number") {
    extensions.push({
      url: EXTENSION_WEIGHT_URL,
      valueDecimal: companion.currentWeight,
    });
  }

  if (companion.countryOfOrigin) {
    extensions.push({
      url: EXTENSION_COUNTRY_OF_ORIGIN_URL,
      valueString: companion.countryOfOrigin,
    });
  }

  if (companion.source) {
    extensions.push({
      url: EXTENSION_SOURCE_URL,
      valueString: companion.source,
    });
  }

  if (companion.ageWhenNeutered) {
    extensions.push({
      url: EXTENSION_AGE_WHEN_NEUTERED_URL,
      valueString: companion.ageWhenNeutered,
    });
  }

  if (companion.allergy) {
    extensions.push({
      url: EXTENSION_ALLERGY_URL,
      valueString: companion.allergy,
    });
  }

  return extensions.length > 0 ? extensions : undefined;
};

const toPatientGender = (gender: Gender | undefined): Patient["gender"] => {
  if (gender === "male" || gender === "female") {
    return gender;
  }
  return "unknown";
};

const toPatientActive = (status: RecordStatus | undefined): boolean | undefined => {
  if (!status) {
    return undefined;
  }

  if (status === "active") {
    return true;
  }

  return false;
};

export const toFHIRCompanion = (companion: Companion): Patient => {
  const birthDate = formatToFHIRDate(companion.dateOfBirth);
  const metaLastUpdated = formatToFHIRDateTime(
    companion.updatedAt ?? companion.createdAt
  );

  const name = companion.name?.trim();

  const animal: Patient["animal"] = {
    species: buildSpeciesConcept(companion.type),
    breed: companion.breed
      ? {
          text: companion.breed,
        }
      : undefined,
    genderStatus: buildGenderStatusConcept(companion.isneutered),
  };

  return {
    resourceType: "Patient",
    id: companion._id ? String(companion._id) : undefined,
    name: name
      ? [
          {
            use: "official",
            text: name,
            given: [name],
          },
        ]
      : undefined,
    gender: toPatientGender(companion.gender),
    birthDate,
    photo: companion.photoUrl
      ? [
          {
            url: companion.photoUrl,
          },
        ]
      : undefined,
    identifier: buildIdentifiers(companion),
    active: toPatientActive(companion.status),
    extension: buildExtensions(companion),
    animal:
      animal && Object.values(animal).some((value) => value !== undefined)
        ? animal
        : undefined,
    meta: metaLastUpdated
      ? {
          lastUpdated: metaLastUpdated,
        }
      : undefined,
  };
};
