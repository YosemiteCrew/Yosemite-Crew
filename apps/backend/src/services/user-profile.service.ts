import UserProfileModel, {
  type UserProfileDocument,
  type UserProfileMongo,
  type UserProfilePersonalDetailsMongo,
  type UserProfileProfessionalDetailsMongo,
  type UserProfileAddressMongo,
  type UserProfileDocumentMongo,
} from "../models/user-profile";
import type {
  UserProfile as UserProfileType,
  UserAvailability,
} from "@yosemite-crew/types";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
} from "./base-availability.service";

export class UserProfileServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UserProfileServiceError";
  }
}

type UnknownRecord = Record<string, unknown>;

const forbidQueryOperators = (input: string, field: string) => {
  if (input.includes("$")) {
    throw new UserProfileServiceError(`Invalid character in ${field}.`, 400);
  }
};

const assertPlainObject = (value: unknown, field: string): UnknownRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new UserProfileServiceError(`${field} must be an object.`, 400);
  }

  return value as UnknownRecord;
};

const requireString = (value: unknown, field: string): string => {
  if (typeof value !== "string") {
    throw new UserProfileServiceError(`${field} is required.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new UserProfileServiceError(`${field} cannot be empty.`, 400);
  }

  forbidQueryOperators(trimmed, field);

  return trimmed;
};

const requireUserId = (value: unknown): string => {
  const identifier = requireString(value, "User id");

  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(identifier)) {
    throw new UserProfileServiceError("Invalid user id format.", 400);
  }

  return identifier;
};

const requireOrganizationId = (value: unknown): string => {
  const identifier = requireString(value, "Organization id");

  if (!/^[A-Za-z0-9_.-]{1,64}$/.test(identifier)) {
    throw new UserProfileServiceError("Invalid organization id format.", 400);
  }

  return identifier;
};

const optionalString = (value: unknown, field: string): string | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new UserProfileServiceError(`${field} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  forbidQueryOperators(trimmed, field);

  return trimmed;
};

const optionalEnum = <T extends string>(
  value: unknown,
  allowed: readonly T[],
  field: string,
): T | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new UserProfileServiceError(`${field} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  const matches = allowed.find((item) => item === trimmed);

  if (!matches) {
    throw new UserProfileServiceError(
      `${field} must be one of: ${allowed.join(", ")}.`,
      400,
    );
  }

  return matches;
};

const optionalDate = (value: unknown, field: string): Date | undefined => {
  if (value == null) {
    return undefined;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new UserProfileServiceError(`${field} must be a valid date.`, 400);
    }

    return value;
  }

  if (typeof value !== "string" && typeof value !== "number") {
    throw new UserProfileServiceError(`${field} must be a date string.`, 400);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new UserProfileServiceError(`${field} must be a valid date.`, 400);
  }

  return date;
};

const optionalNumber = (value: unknown, field: string): number | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "number") {
    if (Number.isNaN(value)) {
      throw new UserProfileServiceError(
        `${field} must be a valid number.`,
        400,
      );
    }

    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (!trimmed) {
      return undefined;
    }

    const parsed = Number(trimmed);

    if (Number.isNaN(parsed)) {
      throw new UserProfileServiceError(
        `${field} must be a valid number.`,
        400,
      );
    }

    return parsed;
  }

  throw new UserProfileServiceError(`${field} must be a number.`, 400);
};

const optionalBoolean = (
  value: unknown,
  field: string,
): boolean | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  throw new UserProfileServiceError(`${field} must be a boolean.`, 400);
};

// NOSONAR: Values are validated and sanitized before persistence, no query concatenation.
const sanitizeAddress = (
  value: unknown,
): UserProfileAddressMongo | undefined => {
  if (value == null) {
    return undefined;
  }

  const record = assertPlainObject(value, "Personal details address");

  return pruneUndefined({
    addressLine: optionalString(record.addressLine, "Address line"),
    country: optionalString(record.country, "Address country"),
    city: optionalString(record.city, "Address city"),
    state: optionalString(record.state, "Address state"),
    postalCode: optionalString(record.postalCode, "Address postal code"),
    latitude: optionalNumber(record.latitude, "Address latitude"),
    longitude: optionalNumber(record.longitude, "Address longitude"),
  });
};

const sanitizeDocuments = (
  value: unknown,
): UserProfileDocumentMongo[] | undefined => {
  if (value == null) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new UserProfileServiceError(
      "Professional documents must be an array.",
      400,
    );
  }

  return value.map((item, index) => {
    const record = assertPlainObject(item, `Professional document[${index}]`);

    const type = optionalEnum(
      record.type,
      ["LICENSE", "CERTIFICATE", "CV", "OTHER"] as const,
      `Professional document[${index}].type`,
    );

    if (!type) {
      throw new UserProfileServiceError(
        `Professional document[${index}].type is required.`,
        400,
      );
    }

    const fileUrl = requireString(
      record.fileUrl,
      `Professional document[${index}].fileUrl`,
    );
    const uploadedAt = optionalDate(
      record.uploadedAt,
      `Professional document[${index}].uploadedAt`,
    );

    if (!uploadedAt) {
      throw new UserProfileServiceError(
        `Professional document[${index}].uploadedAt is required.`,
        400,
      );
    }

    return pruneUndefined({
      type,
      fileUrl,
      uploadedAt,
      verified: optionalBoolean(
        record.verified,
        `Professional document[${index}].verified`,
      ),
    });
  });
};

const sanitizePersonalDetails = (
  value: unknown,
): UserProfilePersonalDetailsMongo | undefined => {
  if (value == null) {
    return undefined;
  }

  const record = assertPlainObject(value, "Personal details");

  return pruneUndefined({
    gender: optionalEnum(
      record.gender,
      ["MALE", "FEMALE", "OTHER"] as const,
      "Gender",
    ),
    dateOfBirth: optionalDate(record.dateOfBirth, "Date of birth"),
    employmentType: optionalEnum(
      record.employmentType,
      ["FULL_TIME", "PART_TIME", "CONTRACT"] as const,
      "Employment type",
    ),
    address: sanitizeAddress(record.address),
    phoneNumber: optionalString(record.phoneNumber, "Phone number"),
    profilePictureUrl: optionalString(
      record.profilePictureUrl,
      "Profile picture URL",
    ),
  });
};

const sanitizeProfessionalDetails = (
  value: unknown,
): UserProfileProfessionalDetailsMongo | undefined => {
  if (value == null) {
    return undefined;
  }

  const record = assertPlainObject(value, "Professional details");

  return pruneUndefined({
    medicalLicenseNumber: optionalString(
      record.medicalLicenseNumber,
      "Medical license number",
    ),
    yearsOfExperience: optionalNumber(
      record.yearsOfExperience,
      "Years of experience",
    ),
    specialization: optionalString(record.specialization, "Specialization"),
    qualification: optionalString(record.qualification, "Qualification"),
    biography: optionalString(record.biography, "Biography"),
    linkedin: optionalString(record.linkedin, "LinkedIn"),
    documents: sanitizeDocuments(record.documents),
  });
};

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const arrayValue = value as unknown[];

    for (let index = arrayValue.length - 1; index >= 0; index -= 1) {
      const next = pruneUndefined(arrayValue[index]);

      if (next === undefined) {
        arrayValue.splice(index, 1);
      } else {
        arrayValue[index] = next;
      }
    }

    return value;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    const record = value as UnknownRecord;

    for (const key of Object.keys(record)) {
      const next = pruneUndefined(record[key]);

      if (next === undefined) {
        delete record[key];
      } else {
        record[key] = next;
      }
    }

    return value;
  }

  return value;
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isPersonalDetailsComplete = (
  details: UserProfileMongo["personalDetails"],
): boolean => {
  if (!details) {
    return false;
  }

  const hasGender = isNonEmptyString(details.gender);
  const hasEmploymentType = isNonEmptyString(details.employmentType);
  const hasPhone = isNonEmptyString(details.phoneNumber);

  const address = details.address;

  const hasAddress =
    !!address &&
    ["addressLine", "city", "state", "postalCode", "country"].every((field) =>
      isNonEmptyString((address as Record<string, unknown>)[field]),
    );

  return hasGender && hasEmploymentType && hasPhone && hasAddress;
};

const isProfessionalDetailsComplete = (
  details: UserProfileMongo["professionalDetails"],
): boolean => {
  if (!details) {
    return false;
  }

  const hasLicense = isNonEmptyString(details.medicalLicenseNumber);
  const hasSpecialization = isNonEmptyString(details.specialization);
  const hasQualification = isNonEmptyString(details.qualification);

  return hasLicense && hasSpecialization && hasQualification;
};

const hasValidAvailability = (availability: UserAvailability[]): boolean =>
  availability.some(
    (entry) =>
      Array.isArray(entry.slots) &&
      entry.slots.some(
        (slot) =>
          Boolean(slot) &&
          isNonEmptyString(slot.startTime) &&
          isNonEmptyString(slot.endTime) &&
          slot.isAvailable === true,
      ),
  );

const determineProfileStatus = (
  profile: UserProfileMongo,
  availability: UserAvailability[],
): UserProfileMongo["status"] => {
  const personalComplete = isPersonalDetailsComplete(profile.personalDetails);
  const professionalComplete = isProfessionalDetailsComplete(
    profile.professionalDetails,
  );
  const availabilityComplete = hasValidAvailability(availability);

  return personalComplete && professionalComplete && availabilityComplete
    ? "COMPLETED"
    : "DRAFT";
};

const applyProfileStatus = async (
  document: UserProfileDocument,
  availability: UserAvailability[],
): Promise<UserProfileMongo["status"]> => {
  const status = determineProfileStatus(document, availability);

  if (document.status !== status) {
    document.status = status;
    await document.save();
  }

  return status;
};

const buildDomainProfile = (
  document: UserProfileDocument,
  options?: { statusOverride?: UserProfileMongo["status"] },
): UserProfileType => {
  const raw = document.toObject({ virtuals: false }) as UserProfileMongo & {
    _id?: unknown;
  };

  const idSource = raw._id ?? document._id;
  const id =
    typeof idSource === "string"
      ? idSource
      : typeof idSource === "object" &&
          idSource !== null &&
          "toString" in idSource
        ? String((idSource as { toString: () => string }).toString())
        : undefined;

  const personalDetails = raw.personalDetails
    ? pruneUndefined({
        ...raw.personalDetails,
        address: raw.personalDetails.address
          ? pruneUndefined(raw.personalDetails.address)
          : undefined,
      })
    : undefined;

  const professionalDetails = raw.professionalDetails
    ? pruneUndefined({
        ...raw.professionalDetails,
        documents: raw.professionalDetails.documents
          ? raw.professionalDetails.documents.map((documentItem) =>
              pruneUndefined(documentItem),
            )
          : undefined,
      })
    : undefined;

  const profile: UserProfileType = {
    _id: id,
    userId: raw.userId,
    organizationId: raw.organizationId,
    personalDetails: personalDetails,
    professionalDetails: professionalDetails,
    status: options?.statusOverride ?? raw.status ?? "DRAFT",
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };

  return pruneUndefined(profile);
};

export type CreateUserProfilePayload = {
  userId: unknown;
  organizationId: unknown;
  personalDetails?: unknown;
  professionalDetails?: unknown;
  baseAvailability: unknown;
};

export type UpdateUserProfilePayload = {
  personalDetails?: unknown;
  professionalDetails?: unknown;
  baseAvailability?: unknown;
};

const sanitizeCreatePayload = (
  payload: CreateUserProfilePayload,
): { profile: UserProfileMongo; baseAvailability: unknown } => {
  if (!("baseAvailability" in payload)) {
    throw new UserProfileServiceError("Base availability is required.", 400);
  }

  const personalDetails = sanitizePersonalDetails(payload.personalDetails);
  const professionalDetails = sanitizeProfessionalDetails(
    payload.professionalDetails,
  );

  const profile = pruneUndefined({
    userId: requireUserId(payload.userId),
    organizationId: requireOrganizationId(payload.organizationId),
    personalDetails,
    professionalDetails,
  });

  return { profile, baseAvailability: payload.baseAvailability };
};

const sanitizeUpdatePayload = (
  payload: UpdateUserProfilePayload,
): { attributes: Partial<UserProfileMongo>; baseAvailability?: unknown } => {
  const sanitized: Partial<UserProfileMongo> = {};
  let hasProfileUpdate = false;

  if ("personalDetails" in payload) {
    sanitized.personalDetails = sanitizePersonalDetails(
      payload.personalDetails,
    );
    hasProfileUpdate = true;
  }

  if ("professionalDetails" in payload) {
    sanitized.professionalDetails = sanitizeProfessionalDetails(
      payload.professionalDetails,
    );
    hasProfileUpdate = true;
  }

  const hasAvailabilityUpdate = "baseAvailability" in payload;

  if (!hasProfileUpdate && !hasAvailabilityUpdate) {
    throw new UserProfileServiceError("No updatable fields provided.", 400);
  }

  return {
    attributes: pruneUndefined(sanitized),
    baseAvailability: hasAvailabilityUpdate
      ? payload.baseAvailability
      : undefined,
  };
};

export const UserProfileService = {
  async create(payload: CreateUserProfilePayload): Promise<UserProfileType> {
    const { profile: attributes, baseAvailability } =
      sanitizeCreatePayload(payload);

    const existing = await UserProfileModel.findOne(
      { userId: attributes.userId, organizationId: attributes.organizationId },
      null,
      { sanitizeFilter: true },
    );

    if (existing) {
      throw new UserProfileServiceError(
        "Profile already exists for this user in this organization.",
        409,
      );
    }

    const document = await UserProfileModel.create(attributes);

    let availability: UserAvailability[];

    try {
      availability = await BaseAvailabilityService.create({
        userId: attributes.userId,
        availability: baseAvailability,
      });
    } catch (error: unknown) {
      await UserProfileModel.deleteOne({ _id: document._id });

      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = await applyProfileStatus(document, availability);

    return buildDomainProfile(document, { statusOverride: status });
  },

  async update(
    userId: unknown,
    organizationId: unknown,
    payload: UpdateUserProfilePayload,
  ): Promise<UserProfileType | null> {
    const identifier = requireUserId(userId);
    const organizationIdentifier = requireOrganizationId(organizationId);
    const { attributes, baseAvailability } = sanitizeUpdatePayload(payload);

    const document =
      Object.keys(attributes).length > 0
        ? await UserProfileModel.findOneAndUpdate(
            { userId: identifier, organizationId: organizationIdentifier },
            { $set: attributes },
            { new: true, sanitizeFilter: true },
          )
        : await UserProfileModel.findOne(
            { userId: identifier, organizationId: organizationIdentifier },
            null,
            { sanitizeFilter: true },
          );

    if (!document) {
      return null;
    }

    let availability: UserAvailability[];

    try {
      if (baseAvailability !== undefined) {
        availability = await BaseAvailabilityService.update(identifier, {
          availability: baseAvailability,
        });
      } else {
        availability = await BaseAvailabilityService.getByUserId(identifier);
      }
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = await applyProfileStatus(document, availability);

    return buildDomainProfile(document, { statusOverride: status });
  },

  async getByUserId(
    userId: unknown,
    organizationId: unknown,
  ): Promise<UserProfileType | null> {
    const identifier = requireUserId(userId);
    const organizationIdentifier = requireOrganizationId(organizationId);

    const document = await UserProfileModel.findOne(
      { userId: identifier, organizationId: organizationIdentifier },
      null,
      { sanitizeFilter: true },
    );

    if (!document) {
      return null;
    }

    let availability: UserAvailability[];

    try {
      availability = await BaseAvailabilityService.getByUserId(identifier);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = await applyProfileStatus(document, availability);

    return buildDomainProfile(document, { statusOverride: status });
  },
};
