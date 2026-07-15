import type {
  Gender,
  PatientType,
  RecordStatus,
  SourceType,
} from "@prisma/client";

export const modelsRequiringCompanionId = new Set([
  "PatientOrganisation",
  "Document",
  "ParentPatient",
]);

const slugifyRoomCode = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

const normalizeToken = (value: string) =>
  value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_")
    .replace(/__+/g, "_");

const normalizeEnumValue = <T extends string>(
  value: unknown,
  mapping: Record<string, T>,
): T | null => {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = normalizeToken(value);
  return mapping[normalized] ?? null;
};

export const normalizePatientType = (value: unknown): PatientType | null =>
  normalizeEnumValue(value, {
    DOG: "dog",
    CAT: "cat",
    HORSE: "horse",
    OTHER: "other",
    UNKNOWN: "other",
  });

export const normalizePatientGender = (value: unknown): Gender | null =>
  normalizeEnumValue(value, {
    MALE: "male",
    FEMALE: "female",
    OTHER: "unknown",
    UNKNOWN: "unknown",
  });

export const normalizePatientSource = (value: unknown): SourceType | null =>
  normalizeEnumValue(value, {
    SHOP: "shop",
    BREEDER: "breeder",
    FOSTER_SHELTER: "foster_shelter",
    FOSTER: "foster_shelter",
    FRIENDS_FAMILY: "friends_family",
    FRIENDS: "friends_family",
    STRAY: "stray",
    UNKNOWN: "unknown",
  });

export const normalizePatientStatus = (value: unknown): RecordStatus | null =>
  normalizeEnumValue(value, {
    ACTIVE: "active",
    ARCHIVED: "archived",
    INACTIVE: "inactive",
  });

export const getMissingCoParentInvitePatientIdReason = (
  data: Record<string, unknown>,
): string | null => {
  const patientId = data.patientId;
  if (typeof patientId !== "string" || patientId.trim().length === 0) {
    return "missing patientId";
  }

  return null;
};

export const getMissingExternalExpensePatientIdReason = (
  data: Record<string, unknown>,
): string | null => {
  const patientId = data.patientId;
  if (typeof patientId !== "string" || patientId.trim().length === 0) {
    return "missing patientId";
  }

  return null;
};

export const resolveLegacyPatientId = (
  data: Record<string, unknown>,
  candidateFields: string[] = [
    "patientId",
    "companionId",
    "patient",
    "companion",
  ],
): string | null => {
  for (const field of candidateFields) {
    if (!(field in data)) continue;
    const value = data[field];
    if (value === undefined || value === null) continue;

    const normalized =
      typeof value === "string" ? value.trim() : value.toString().trim();
    if (normalized.length > 0 && normalized !== "[object Object]") {
      return normalized;
    }
  }

  return null;
};

export const getMissingMongooseModelReason = (
  modelName: string,
  registeredModelNames: Iterable<string>,
): string | null => {
  for (const registeredModelName of registeredModelNames) {
    if (registeredModelName === modelName) {
      return null;
    }
  }

  return `Mongoose model ${modelName} is not registered`;
};

export const chooseMongooseSourceModelName = (args: {
  preferredNames: string[];
  registeredModelNames: Iterable<string>;
  documentCounts: Map<string, number>;
}): string | null => {
  const registered = new Set(args.registeredModelNames);

  for (const name of args.preferredNames) {
    if (!registered.has(name)) continue;
    if ((args.documentCounts.get(name) ?? 0) > 0) {
      return name;
    }
  }

  for (const name of args.preferredNames) {
    if (registered.has(name)) {
      return name;
    }
  }

  return null;
};

export const getMissingCompanionForeignKeyReason = (
  prismaName: string,
  data: Record<string, unknown>,
  existingCompanionIds: Set<string>,
): string | null => {
  if (!modelsRequiringCompanionId.has(prismaName)) {
    return null;
  }

  const patientId = data.patientId;
  if (typeof patientId !== "string" || patientId.trim().length === 0) {
    return "missing patientId";
  }

  if (!existingCompanionIds.has(patientId)) {
    return `unknown patientId ${patientId}`;
  }

  return null;
};

export const deriveOrganisationRoomCode = (args: {
  data: Record<string, unknown>;
}): string | null => {
  const code = args.data.code;
  if (typeof code === "string" && code.trim().length > 0) {
    return code.trim();
  }

  const fhirId = args.data.fhirId;
  if (typeof fhirId === "string" && fhirId.trim().length > 0) {
    return fhirId.trim();
  }

  const name = args.data.name;
  const id = args.data.id;
  if (typeof name === "string" && name.trim().length > 0) {
    const slug = slugifyRoomCode(name);
    if (slug.length > 0 && typeof id === "string" && id.trim().length > 0) {
      return `${slug}-${id.trim().slice(0, 6)}`;
    }
    if (slug.length > 0) {
      return slug;
    }
  }

  if (typeof id === "string" && id.trim().length > 0) {
    return `room-${id.trim().slice(0, 6)}`;
  }

  return null;
};
