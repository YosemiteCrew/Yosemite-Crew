import type {
  Attachment,
  CodeableConcept,
  Extension,
  Identifier,
  Patient,
} from "@yosemite-crew/fhirtypes";
import type {
  Companion,
  CompanionType,
  Gender,
  RecordStatus,
  SourceType,
} from "../companion";
import {
  COMPANION_SPECIES_MAP,
  EXTENSION_AGE_WHEN_NEUTERED_URL,
  EXTENSION_ALLERGY_URL,
  EXTENSION_BLOOD_GROUP_URL,
  EXTENSION_COLOUR_URL,
  EXTENSION_COUNTRY_OF_ORIGIN_URL,
  EXTENSION_SOURCE_URL,
  EXTENSION_WEIGHT_URL,
  GENDER_STATUS_SYSTEM_URL,
  MICROCHIP_IDENTIFIER_SYSTEM_URL,
  PASSPORT_IDENTIFIER_SYSTEM_URL,
  SPECIES_SYSTEM_URL,
  toFHIRCompanion,
} from "../companion";

const SPECIES_CODE_TO_TYPE = Object.entries(COMPANION_SPECIES_MAP).reduce(
  (acc, [companionType, config]) => {
    if (config.code) {
      acc.set(config.code, companionType as CompanionType);
    }
    return acc;
  },
  new Map<string, CompanionType>()
);

const SPECIES_DISPLAY_TO_TYPE = Object.entries(COMPANION_SPECIES_MAP).reduce(
  (acc, [companionType, config]) => {
    acc.set(config.display.toLowerCase(), companionType as CompanionType);
    return acc;
  },
  new Map<string, CompanionType>()
);

const SOURCE_VALUES = new Set<string>([
  "shop",
  "breeder",
  "foster_shelter",
  "friends_family",
  "unknown",
]);

const parseDate = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const parseName = (names?: Patient["name"]): Companion["name"] | undefined => {
  if (!names?.length) {
    return undefined;
  }

  const [primary] = names;

  const text = primary.text?.trim();
  if (text) {
    return text;
  }

  const given = primary.given?.find(Boolean);
  if (given) {
    return given;
  }

  const family = primary.family?.trim();
  if (family) {
    return family;
  }

  return undefined;
};

const parseGender = (gender?: Patient["gender"]): Gender => {
  if (gender === "male" || gender === "female") {
    return gender;
  }
  return "unknown";
};

const parseStatus = (active?: boolean): RecordStatus | undefined => {
  if (typeof active === "boolean") {
    return active ? "active" : "archived";
  }
  return undefined;
};

const parseSpecies = (
  species?: CodeableConcept
): CompanionType | undefined => {
  if (!species) {
    return undefined;
  }

  const codingMatch = species.coding?.find(
    (coding) =>
      coding.system === SPECIES_SYSTEM_URL &&
      typeof coding.code === "string" &&
      SPECIES_CODE_TO_TYPE.has(coding.code)
  );

  if (codingMatch?.code) {
    return SPECIES_CODE_TO_TYPE.get(codingMatch.code);
  }

  const text = species.text?.toLowerCase().trim();
  if (text && SPECIES_DISPLAY_TO_TYPE.has(text)) {
    return SPECIES_DISPLAY_TO_TYPE.get(text);
  }

  return undefined;
};

const parseBreed = (breed?: CodeableConcept): Companion["breed"] | undefined =>
  breed?.text || undefined;

const parseGenderStatus = (
  genderStatus?: CodeableConcept
): Companion["isneutered"] => {
  const codingMatch = genderStatus?.coding?.find(
    (coding) => coding.system === GENDER_STATUS_SYSTEM_URL && coding.code
  );

  const code = codingMatch?.code?.toLowerCase() || genderStatus?.text?.trim()?.toLowerCase();

  if (code === "neutered") {
    return true;
  }

  if (code === "intact") {
    return false;
  }

  return undefined;
};

const findIdentifierValue = (
  identifiers: Identifier[] | undefined,
  system: string
): string | undefined =>
  identifiers?.find((identifier) => identifier.system === system)?.value ||
  undefined;

const filterExtensions = (
  extensions: Extension[] | undefined,
  url: string
): Extension[] => extensions?.filter((extension) => extension.url === url) ?? [];

const parseStringExtension = (
  extensions: Extension[] | undefined,
  url: string
): string | undefined =>
  filterExtensions(extensions, url).find(
    (extension) => typeof extension.valueString === "string"
  )?.valueString;

const parseDecimalExtension = (
  extensions: Extension[] | undefined,
  url: string
): number | undefined => {
  const decimalExtension = filterExtensions(extensions, url).find(
    (extension) => typeof extension.valueDecimal === "number"
  );
  return decimalExtension?.valueDecimal;
};

const parseAllergyExtension = (
  extensions: Extension[] | undefined
): Companion["allergy"] => {
  const value = parseStringExtension(extensions, EXTENSION_ALLERGY_URL);
  return value?.trim() || undefined;
};

const parseSourceExtension = (
  extensions: Extension[] | undefined
): SourceType | undefined => {
  const value = parseStringExtension(extensions, EXTENSION_SOURCE_URL);
  return SOURCE_VALUES.has(value || "")
    ? (value as SourceType)
    : undefined;
};

const parsePhoto = (
  photos?: Attachment[]
): Companion["photoUrl"] | undefined =>
  photos?.find((attachment) => typeof attachment.url === "string")?.url;

const parseUpdatedAt = (dto: Patient): Date | undefined =>
  parseDate(dto.meta?.lastUpdated);

export type CompanionRequestDTO = Patient;

export type CompanionResponseDTO = Patient;

export type CompanionDTOAttributes = {
  _id?: Companion["_id"];
  name?: Companion["name"];
  type?: Companion["type"];
  breed?: Companion["breed"];
  dateOfBirth?: Companion["dateOfBirth"];
  gender?: Companion["gender"];
  photoUrl?: Companion["photoUrl"];
  currentWeight?: Companion["currentWeight"];
  colour?: Companion["colour"];
  allergy?: Companion["allergy"];
  bloodGroup?: Companion["bloodGroup"];
  isneutered?: Companion["isneutered"];
  ageWhenNeutered?: Companion["ageWhenNeutered"];
  isInsured?: Companion["isInsured"];
  microchipNumber?: Companion["microchipNumber"];
  passportNumber?: Companion["passportNumber"];
  countryOfOrigin?: Companion["countryOfOrigin"];
  source?: Companion["source"];
  status?: Companion["status"];
  updatedAt?: Companion["updatedAt"];
};

export const fromCompanionRequestDTO = (
  dto: CompanionRequestDTO
): CompanionDTOAttributes => {
  const extensions = dto.extension;

  const type =
    parseSpecies(dto.animal?.species) ?? ("other" as CompanionType);

  return {
    _id: dto.id,
    name: parseName(dto.name),
    type,
    breed: parseBreed(dto.animal?.breed),
    dateOfBirth: parseDate(dto.birthDate),
    gender: parseGender(dto.gender),
    photoUrl: parsePhoto(dto.photo),
    currentWeight: parseDecimalExtension(extensions, EXTENSION_WEIGHT_URL),
    colour: parseStringExtension(extensions, EXTENSION_COLOUR_URL),
    allergy: parseAllergyExtension(extensions),
    bloodGroup: parseStringExtension(extensions, EXTENSION_BLOOD_GROUP_URL),
    isneutered: parseGenderStatus(dto.animal?.genderStatus),
    ageWhenNeutered: parseStringExtension(
      extensions,
      EXTENSION_AGE_WHEN_NEUTERED_URL
    ),
    microchipNumber: findIdentifierValue(
      dto.identifier,
      MICROCHIP_IDENTIFIER_SYSTEM_URL
    ),
    passportNumber: findIdentifierValue(
      dto.identifier,
      PASSPORT_IDENTIFIER_SYSTEM_URL
    ),
    countryOfOrigin: parseStringExtension(
      extensions,
      EXTENSION_COUNTRY_OF_ORIGIN_URL
    ),
    source: parseSourceExtension(extensions),
    status: parseStatus(dto.active),
    updatedAt: parseUpdatedAt(dto),
  };
};

export const toCompanionResponseDTO = (
  companion: Companion
): CompanionResponseDTO => toFHIRCompanion(companion);
