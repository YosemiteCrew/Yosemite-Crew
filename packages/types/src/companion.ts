import type {
  CodeableConcept,
  Extension,
  Identifier,
  Patient,
} from "@yosemite-crew/fhirtypes";

export interface InsuranceDetails {
  isInsured: boolean;
  companyName?: string;
  policyNumber?: string;
}

export type CompanionType = "dog" | "cat" | "horse" | "other";
export type Gender = "male" | "female" | "unknown";
export type SourceType =
  | "shop"
  | "breeder"
  | "foster_shelter"
  | "friends_family"
  | "unknown";
export type RecordStatus = "active" | "archived" | "inactive";

export interface physicalAttribute {
  coatType?: string;
  coatColour?: string;
  eyeColour?: string;
  height?: string;
  weight?: string;
  markings?: string;
  build?: string;
}

export interface Companion {
  id?: string;
  name: string;
  type: CompanionType;
  breed: string;
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

  physicalAttribute?: physicalAttribute;

  // Breeding information
  breedingInfo?: {
    sire?: {
      name?: string;
      registrationNumber?: string;
      breed?: string;
      microchipNumber?: string;
      dateOfBirth?: Date;
      ownerBreederName?: string;
    };
    dam?: {
      name?: string;
      registrationNumber?: string;
      breed?: string;
      microchipNumber?: string;
      dateOfBirth?: Date;
      ownerBreederName?: string;
    };
  };

  // Medical documents
  medicalRecords?: Array<{
    fileUrl: string;
    fileName: string;
    uploadedAt: Date;
  }>;

  isProfileComplete?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

type BreedingParentDetails = NonNullable<
  NonNullable<Companion["breedingInfo"]>["sire"]
>;
type MedicalRecord = NonNullable<Companion["medicalRecords"]>[number];

export const SPECIES_SYSTEM_URL = "http://hl7.org/fhir/animal-species";
export const GENDER_STATUS_SYSTEM_URL =
  "http://hl7.org/fhir/animal-genderstatus";
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
export const EXTENSION_INSURANCE_URL =
  "http://example.org/fhir/StructureDefinition/companion-insurance";
export const EXTENSION_PHYSICAL_ATTRIBUTE_URL =
  "http://example.org/fhir/StructureDefinition/companion-physical-attributes";
export const EXTENSION_BREEDING_INFO_URL =
  "http://example.org/fhir/StructureDefinition/companion-breeding-info";
export const EXTENSION_MEDICAL_RECORD_URL =
  "http://example.org/fhir/StructureDefinition/companion-medical-record";
export const EXTENSION_PROFILE_COMPLETE_URL =
  "http://example.org/fhir/StructureDefinition/companion-profile-complete";

type SpeciesConfig = {
  code?: string;
  display: string;
};

export const COMPANION_SPECIES_MAP: Record<CompanionType, SpeciesConfig> = {
  dog: {
    code: "canislf",
    display: "Dog",
  },
  cat: {
    code: "feliscat",
    display: "Cat",
  },
  horse: {
    code: "equuscab",
    display: "Horse",
  },
  other: {
    display: "Other",
  },
};

const SOURCE_VALUES = new Set<SourceType>([
  "shop",
  "breeder",
  "foster_shelter",
  "friends_family",
  "unknown",
]);

const toFHIRBirthDate = (date?: Date): string | undefined => {
  if (!date) {
    return undefined;
  }
  return date.toISOString().split("T")[0];
};

const toFHIRSpecies = (type: CompanionType): CodeableConcept | undefined => {
  const config = COMPANION_SPECIES_MAP[type];
  if (!config) {
    return undefined;
  }
  return {
    coding: config.code
      ? [
          {
            system: SPECIES_SYSTEM_URL,
            code: config.code,
            display: config.display,
          },
        ]
      : undefined,
    text: config.display,
  };
};

const toFHIRGenderStatus = (
  isNeutered?: boolean
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

const addStringExtension = (
  extensions: Extension[],
  url: string,
  value?: string
): void => {
  if (!value) {
    return;
  }
  extensions.push({
    url,
    valueString: value,
  });
};

const addDecimalExtension = (
  extensions: Extension[],
  url: string,
  value?: number
): void => {
  if (typeof value !== "number") {
    return;
  }
  extensions.push({
    url,
    valueDecimal: value,
  });
};

const addPhysicalAttributeExtension = (
  extensions: Extension[],
  attributes?: physicalAttribute
): void => {
  if (!attributes) {
    return;
  }

  const nested: Extension[] = [];
  addStringExtension(nested, "coatType", attributes.coatType);
  addStringExtension(nested, "coatColour", attributes.coatColour);
  addStringExtension(nested, "eyeColour", attributes.eyeColour);
  addStringExtension(nested, "height", attributes.height);
  addStringExtension(nested, "weight", attributes.weight);
  addStringExtension(nested, "markings", attributes.markings);
  addStringExtension(nested, "build", attributes.build);

  if (!nested.length) {
    return;
  }

  extensions.push({
    url: EXTENSION_PHYSICAL_ATTRIBUTE_URL,
    extension: nested,
  });
};

const buildParentDetailsExtension = (
  details: BreedingParentDetails | undefined,
  url: string
): Extension | undefined => {
  if (!details) {
    return undefined;
  }

  const nested: Extension[] = [];
  addStringExtension(nested, "name", details.name);
  addStringExtension(nested, "registrationNumber", details.registrationNumber);
  addStringExtension(nested, "breed", details.breed);
  addStringExtension(nested, "microchipNumber", details.microchipNumber);
  addStringExtension(nested, "ownerBreederName", details.ownerBreederName);

  const dateValue = toFHIRBirthDate(details.dateOfBirth);
  if (dateValue) {
    nested.push({
      url: "dateOfBirth",
      valueDate: dateValue,
    });
  }

  if (!nested.length) {
    return undefined;
  }

  return {
    url,
    extension: nested,
  };
};

const addBreedingInfoExtension = (
  extensions: Extension[],
  breedingInfo?: Companion["breedingInfo"]
): void => {
  if (!breedingInfo) {
    return;
  }

  const nested: Extension[] = [];
  const sireExtension = buildParentDetailsExtension(breedingInfo.sire, "sire");
  const damExtension = buildParentDetailsExtension(breedingInfo.dam, "dam");

  if (sireExtension) {
    nested.push(sireExtension);
  }
  if (damExtension) {
    nested.push(damExtension);
  }

  if (!nested.length) {
    return;
  }

  extensions.push({
    url: EXTENSION_BREEDING_INFO_URL,
    extension: nested,
  });
};

const addMedicalRecordsExtensions = (
  extensions: Extension[],
  medicalRecords?: Companion["medicalRecords"]
): void => {
  if (!medicalRecords?.length) {
    return;
  }

  medicalRecords.forEach((record) => {
    if (!record.fileUrl || !record.fileName || !record.uploadedAt) {
      return;
    }

    extensions.push({
      url: EXTENSION_MEDICAL_RECORD_URL,
      extension: [
        {
          url: "fileUrl",
          valueUrl: record.fileUrl,
        },
        {
          url: "fileName",
          valueString: record.fileName,
        },
        {
          url: "uploadedAt",
          valueDateTime: record.uploadedAt.toISOString(),
        },
      ],
    });
  });
};

const addInsuranceExtension = (
  extensions: Extension[],
  companion: Companion
): void => {
  const nested: Extension[] = [
    {
      url: "isInsured",
      valueBoolean: companion.isInsured,
    },
  ];

  if (companion.insurance?.companyName) {
    nested.push({
      url: "companyName",
      valueString: companion.insurance.companyName,
    });
  }

  if (companion.insurance?.policyNumber) {
    nested.push({
      url: "policyNumber",
      valueString: companion.insurance.policyNumber,
    });
  }

  extensions.push({
    url: EXTENSION_INSURANCE_URL,
    extension: nested,
  });
};

const buildIdentifiers = (companion: Companion): Identifier[] => {
  const identifiers: Identifier[] = [];
  if (companion.microchipNumber) {
    identifiers.push({
      system: MICROCHIP_IDENTIFIER_SYSTEM_URL,
      value: companion.microchipNumber,
    });
  }

  if (companion.passportNumber) {
    identifiers.push({
      system: PASSPORT_IDENTIFIER_SYSTEM_URL,
      value: companion.passportNumber,
    });
  }

  return identifiers;
};

const buildExtensions = (companion: Companion): Extension[] => {
  const extensions: Extension[] = [];

  addDecimalExtension(extensions, EXTENSION_WEIGHT_URL, companion.currentWeight);
  addStringExtension(extensions, EXTENSION_COLOUR_URL, companion.colour);
  addStringExtension(extensions, EXTENSION_ALLERGY_URL, companion.allergy);
  addStringExtension(extensions, EXTENSION_BLOOD_GROUP_URL, companion.bloodGroup);
  addStringExtension(
    extensions,
    EXTENSION_AGE_WHEN_NEUTERED_URL,
    companion.ageWhenNeutered
  );
  addStringExtension(
    extensions,
    EXTENSION_COUNTRY_OF_ORIGIN_URL,
    companion.countryOfOrigin
  );
  addStringExtension(extensions, EXTENSION_SOURCE_URL, companion.source);
  addPhysicalAttributeExtension(extensions, companion.physicalAttribute);
  addBreedingInfoExtension(extensions, companion.breedingInfo);
  addMedicalRecordsExtensions(extensions, companion.medicalRecords);

  if (companion.isInsured || companion.insurance) {
    addInsuranceExtension(extensions, companion);
  }

  if (companion.isProfileComplete !== undefined) {
    extensions.push({
      url: EXTENSION_PROFILE_COMPLETE_URL,
      valueBoolean: companion.isProfileComplete,
    });
  }

  return extensions;
};

const toFHIRAnimal = (
  companion: Companion
): Patient["animal"] | undefined => {
  const species = toFHIRSpecies(companion.type);
  const breed = companion.breed
    ? ({ text: companion.breed } as CodeableConcept)
    : undefined;
  const genderStatus = toFHIRGenderStatus(companion.isneutered);

  if (!species && !breed && !genderStatus) {
    return undefined;
  }

  return {
    species,
    breed,
    genderStatus,
  };
};

const toFHIRPhoto = (photoUrl?: string): Patient["photo"] | undefined => {
  if (!photoUrl) {
    return undefined;
  }
  return [
    {
      url: photoUrl,
    },
  ];
};

const parseDate = (value?: string): Date | undefined => {
  if (!value) {
    return undefined;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
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
      Object.values(COMPANION_SPECIES_MAP).some(
        (config) => config.code === coding.code
      )
  );

  if (codingMatch?.code) {
    const entry = Object.entries(COMPANION_SPECIES_MAP).find(
      ([, config]) => config.code === codingMatch.code
    );
    if (entry) {
      return entry[0] as CompanionType;
    }
  }

  const text = species.text?.toLowerCase().trim();
  if (text) {
    const entry = Object.entries(COMPANION_SPECIES_MAP).find(
      ([, config]) => config.display.toLowerCase() === text
    );
    if (entry) {
      return entry[0] as CompanionType;
    }
  }

  return undefined;
};

const parseBreed = (
  breed?: CodeableConcept
): Companion["breed"] | undefined => {
  const codingMatch = breed?.coding?.find(
    (coding) => typeof coding.display === "string"
  );

  if (codingMatch?.display) {
    return codingMatch.display;
  }

  const text = breed?.text?.trim();
  if (text) {
    return text;
  }

  return undefined;
};

const parseGenderStatus = (
  genderStatus?: CodeableConcept
): Companion["isneutered"] => {
  const codingMatch = genderStatus?.coding?.find(
    (coding) => coding.system === GENDER_STATUS_SYSTEM_URL && coding.code
  );

  const code =
    codingMatch?.code?.toLowerCase() ||
    genderStatus?.text?.trim()?.toLowerCase();

  if (code === "neutered") {
    return true;
  }

  if (code === "intact") {
    return false;
  }

  return undefined;
};

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

const parsePhysicalAttribute = (
  extensions: Extension[] | undefined
): physicalAttribute | undefined => {
  const extension = filterExtensions(
    extensions,
    EXTENSION_PHYSICAL_ATTRIBUTE_URL
  )[0];

  const nested = extension?.extension;
  if (!nested?.length) {
    return undefined;
  }

  const getString = (url: string): string | undefined =>
    nested.find((ext) => ext.url === url)?.valueString;

  const attributes: physicalAttribute = {
    coatType: getString("coatType"),
    coatColour: getString("coatColour"),
    eyeColour: getString("eyeColour"),
    height: getString("height"),
    weight: getString("weight"),
    markings: getString("markings"),
    build: getString("build"),
  };

  return Object.values(attributes).some(
    (value) => value !== undefined && value !== null
  )
    ? attributes
    : undefined;
};

const parseBreedingInfo = (
  extensions: Extension[] | undefined
): Companion["breedingInfo"] => {
  const extension = filterExtensions(
    extensions,
    EXTENSION_BREEDING_INFO_URL
  )[0];

  const nested = extension?.extension;
  if (!nested?.length) {
    return undefined;
  }

  const parseParent = (url: "sire" | "dam"): BreedingParentDetails | undefined => {
    const parentExtension = nested.find((ext) => ext.url === url);
    const parentNested = parentExtension?.extension;
    if (!parentNested?.length) {
      return undefined;
    }

    const getString = (field: string): string | undefined =>
      parentNested.find((ext) => ext.url === field)?.valueString;
    const dateValue = parentNested.find(
      (ext) => ext.url === "dateOfBirth"
    )?.valueDate;
    const dateOfBirth = parseDate(dateValue);

    const parent: BreedingParentDetails = {
      name: getString("name"),
      registrationNumber: getString("registrationNumber"),
      breed: getString("breed"),
      microchipNumber: getString("microchipNumber"),
      dateOfBirth,
      ownerBreederName: getString("ownerBreederName"),
    };

    return Object.values(parent).some(
      (value) => value !== undefined && value !== null
    )
      ? parent
      : undefined;
  };

  const sire = parseParent("sire");
  const dam = parseParent("dam");

  if (!sire && !dam) {
    return undefined;
  }

  return {
    ...(sire ? { sire } : {}),
    ...(dam ? { dam } : {}),
  };
};

const parseMedicalRecords = (
  extensions: Extension[] | undefined
): Companion["medicalRecords"] => {
  const records = filterExtensions(
    extensions,
    EXTENSION_MEDICAL_RECORD_URL
  )
    .map((recordExtension) => {
      const nested = recordExtension.extension ?? [];
      const fileUrlExtension = nested.find((ext) => ext.url === "fileUrl");
      const fileUrl =
        fileUrlExtension?.valueUrl ?? fileUrlExtension?.valueUri;
      const fileName = nested.find((ext) => ext.url === "fileName")
        ?.valueString;
      const uploadedAtValue = nested.find(
        (ext) => ext.url === "uploadedAt"
      )?.valueDateTime;
      const uploadedAt = parseDate(uploadedAtValue);

      if (fileUrl && fileName && uploadedAt) {
        return {
          fileUrl,
          fileName,
          uploadedAt,
        } as MedicalRecord;
      }

      return undefined;
    })
    .filter((record): record is MedicalRecord => Boolean(record));

  return records.length ? records : undefined;
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
  return value && SOURCE_VALUES.has(value as SourceType)
    ? (value as SourceType)
    : undefined;
};

const parsePhoto = (
  photos?: Patient["photo"]
): Companion["photoUrl"] | undefined =>
  photos?.find((attachment) => typeof attachment.url === "string")?.url;

const parseUpdatedAt = (dto: Patient): Date | undefined =>
  parseDate(dto.meta?.lastUpdated);

const parseInsuranceExtension = (
  extensions: Extension[] | undefined
): { isInsured: boolean; insurance?: InsuranceDetails } => {
  const insuranceExtension = filterExtensions(
    extensions,
    EXTENSION_INSURANCE_URL
  )[0];

  const nested = insuranceExtension?.extension ?? [];
  const isInsured =
    nested.find((ext) => ext.url === "isInsured")?.valueBoolean ?? false;

  const companyName = nested.find(
    (ext) => ext.url === "companyName"
  )?.valueString;
  const policyNumber = nested.find(
    (ext) => ext.url === "policyNumber"
  )?.valueString;

  const hasDetails = companyName || policyNumber;

  return {
    isInsured,
    insurance: hasDetails
      ? {
          isInsured,
          companyName,
          policyNumber,
        }
      : undefined,
  };
};

const findIdentifierValue = (
  identifiers: Identifier[] | undefined,
  system: string
): string | undefined =>
  identifiers?.find((identifier) => identifier.system === system)?.value ||
  undefined;

const requireField = <T>(value: T | undefined, field: string): T => {
  if (value === undefined || value === null) {
    throw new Error(
      `Cannot convert FHIR Patient to Companion: missing ${field}`
    );
  }
  return value;
};

export const toFHIRCompanion = (companion: Companion): Patient => {
  const extensions = buildExtensions(companion);
  const identifiers = buildIdentifiers(companion);
  const photo = toFHIRPhoto(companion.photoUrl);
  const animal = toFHIRAnimal(companion);

  return {
    resourceType: "Patient",
    id: companion.id,
    active:
      companion.status === "active"
        ? true
        : companion.status === "archived"
        ? false
        : undefined,
    name: companion.name
      ? [
          {
            text: companion.name,
          },
        ]
      : undefined,
    gender: companion.gender,
    birthDate: toFHIRBirthDate(companion.dateOfBirth),
    photo,
    identifier: identifiers.length ? identifiers : undefined,
    extension: extensions.length ? extensions : undefined,
    animal,
    meta: companion.updatedAt
      ? {
          lastUpdated: companion.updatedAt.toISOString(),
        }
      : undefined,
  };
};

export const fromFHIRCompanion = (dto: Patient): Companion => {
  const extensions = dto.extension;
  const species =
    parseSpecies(dto.animal?.species) ?? ("other" as CompanionType);
  const breed = requireField(
    parseBreed(dto.animal?.breed),
    "animal.breed.text"
  );
  const dateOfBirth = requireField(
    parseDate(dto.birthDate),
    "birthDate"
  );
  const name = requireField(parseName(dto.name), "name");
  const { isInsured, insurance } = parseInsuranceExtension(extensions);

  return {
    id: dto.id,
    name,
    type: species,
    breed,
    dateOfBirth,
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
    isInsured,
    insurance,
    countryOfOrigin: parseStringExtension(
      extensions,
      EXTENSION_COUNTRY_OF_ORIGIN_URL
    ),
    source: parseSourceExtension(extensions),
    physicalAttribute: parsePhysicalAttribute(extensions),
    breedingInfo: parseBreedingInfo(extensions),
    medicalRecords: parseMedicalRecords(extensions),
    status: parseStatus(dto.active),
    updatedAt: parseUpdatedAt(dto),
  };
};
