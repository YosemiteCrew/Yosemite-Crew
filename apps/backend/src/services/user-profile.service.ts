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
import UserOrganizationModel from "src/models/user-organization";
import { getURLForKey } from "src/middlewares/upload";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { Prisma, UserProfileStatus } from "@prisma/client";

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

const OFFSET_TIMEZONE_REGEX = /^(?:UTC)?[+-](?:0?\d|1\d|2[0-3]):[0-5]\d$/;
const COMBINED_TIMEZONE_REGEX =
  /^UTC[+-](?:0?\d|1\d|2[0-3]):[0-5]\d\s*-\s*(.+)$/;

const isValidIanaTimezone = (value: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};

const isValidTimezone = (value: string): boolean => {
  if (value === "UTC") {
    return true;
  }

  if (OFFSET_TIMEZONE_REGEX.test(value)) {
    return true;
  }

  return isValidIanaTimezone(value);
};

const normalizeTimezoneInput = (value: string): string => {
  const trimmed = value.trim();
  const combinedMatch = COMBINED_TIMEZONE_REGEX.exec(trimmed);

  if (combinedMatch) {
    const iana = combinedMatch[1].trim();
    if (isValidIanaTimezone(iana)) {
      return iana;
    }
  }

  return trimmed;
};

const optionalTimezone = (
  value: unknown,
  field: string,
): string | undefined => {
  const trimmed = optionalString(value, field);

  if (!trimmed) {
    return undefined;
  }

  const normalized = normalizeTimezoneInput(trimmed);

  if (!isValidTimezone(normalized)) {
    throw new UserProfileServiceError(
      `${field} must be a valid IANA timezone or UTC offset.`,
      400,
    );
  }

  return normalized;
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

const sanitizePmsPreferences = (
  value: unknown,
): UserProfilePersonalDetailsMongo["pmsPreferences"] | undefined => {
  if (value == null) {
    return undefined;
  }

  const record = assertPlainObject(value, "PMS preferences");

  return pruneUndefined({
    defaultOpenScreen: optionalEnum(
      record.defaultOpenScreen,
      ["APPOINTMENTS", "DASHBOARD"] as const,
      "Default open screen",
    ),
    appointmentView: optionalEnum(
      record.appointmentView,
      ["CALENDAR", "STATUS_BOARD", "TABLE"] as const,
      "Appointment view",
    ),
    animalTerminology: optionalEnum(
      record.animalTerminology,
      ["ANIMAL", "COMPANION", "PET", "PATIENT"] as const,
      "Animal terminology",
    ),
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

    const fileUrl = getURLForKey(
      requireString(record.fileUrl, `Professional document[${index}].fileUrl`),
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
    timezone: optionalTimezone(record.timezone, "Timezone"),
    pmsPreferences: sanitizePmsPreferences(record.pmsPreferences),
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

const pruneArray = (value: unknown[]): void => {
  for (let index = value.length - 1; index >= 0; index -= 1) {
    const next = pruneUndefined(value[index]);

    if (next === undefined) {
      value.splice(index, 1);
    } else {
      value[index] = next;
    }
  }
};

const pruneRecord = (value: UnknownRecord): void => {
  for (const key of Object.keys(value)) {
    const next = pruneUndefined(value[key]);

    if (next === undefined) {
      delete value[key];
    } else {
      value[key] = next;
    }
  }
};

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    pruneArray(value as unknown[]);
    return value;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  pruneRecord(value as UnknownRecord);
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

const toPrismaUserProfileData = (doc: UserProfileDocument) => {
  const obj = doc.toObject({ virtuals: false }) as UserProfileMongo & {
    _id: { toString(): string };
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    userId: obj.userId,
    organizationId: obj.organizationId,
    personalDetails: (obj.personalDetails ??
      undefined) as unknown as Prisma.InputJsonValue,
    professionalDetails: (obj.professionalDetails ??
      undefined) as unknown as Prisma.InputJsonValue,
    status: (obj.status ?? "DRAFT") as UserProfileStatus,
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncUserProfileAddressToPostgres = async (
  userProfileId: string,
  address: UserProfileAddressMongo | undefined,
) => {
  if (!shouldDualWrite) return;
  if (!address) {
    try {
      await prisma.userProfileAddress.deleteMany({
        where: { userProfileId },
      });
    } catch (err) {
      handleDualWriteError("UserProfileAddress delete", err);
    }
    return;
  }

  try {
    await prisma.userProfileAddress.upsert({
      where: { userProfileId },
      create: {
        userProfileId,
        addressLine: address.addressLine ?? undefined,
        country: address.country ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postalCode: address.postalCode ?? undefined,
        latitude: address.latitude ?? undefined,
        longitude: address.longitude ?? undefined,
      },
      update: {
        addressLine: address.addressLine ?? undefined,
        country: address.country ?? undefined,
        city: address.city ?? undefined,
        state: address.state ?? undefined,
        postalCode: address.postalCode ?? undefined,
        latitude: address.latitude ?? undefined,
        longitude: address.longitude ?? undefined,
      },
    });
  } catch (err) {
    handleDualWriteError("UserProfileAddress", err);
  }
};

const syncUserProfileToPostgres = async (doc: UserProfileDocument) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaUserProfileData(doc);
    await prisma.userProfile.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });

    const obj = doc.toObject({ virtuals: false }) as UserProfileMongo & {
      _id: { toString(): string };
    };
    await syncUserProfileAddressToPostgres(
      data.id,
      obj.personalDetails?.address,
    );
  } catch (err) {
    handleDualWriteError("UserProfile", err);
  }
};

const applyProfileStatus = async (
  document: UserProfileDocument,
  availability: UserAvailability[],
): Promise<UserProfileMongo["status"]> => {
  const status = determineProfileStatus(document, availability);

  if (document.status !== status) {
    document.status = status;
    await document.save();
    await syncUserProfileToPostgres(document);
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

  let id: string | undefined;

  if (typeof idSource === "string") {
    id = idSource;
  } else if (
    typeof idSource === "object" &&
    idSource !== null &&
    "toString" in idSource
  ) {
    id = String((idSource as { toString: () => string }).toString());
  }

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

const applyPmsPreferenceDefaults = (
  profile: UserProfileType,
  roleCode?: string,
): UserProfileType => {
  const normalizedRole = roleCode?.toUpperCase();
  const defaultOpenScreen =
    normalizedRole === "OWNER" ? "DASHBOARD" : "APPOINTMENTS";

  const existingPersonalDetails = profile.personalDetails ?? {};
  const existingPrefs = existingPersonalDetails.pmsPreferences ?? {};

  if (existingPrefs.defaultOpenScreen) {
    return profile;
  }

  return {
    ...profile,
    personalDetails: {
      ...existingPersonalDetails,
      pmsPreferences: {
        ...existingPrefs,
        defaultOpenScreen,
      },
    },
  };
};

export type CreateUserProfilePayload = {
  userId: unknown;
  organizationId: unknown;
  personalDetails?: unknown;
  professionalDetails?: unknown;
};

export type UpdateUserProfilePayload = {
  personalDetails?: unknown;
  professionalDetails?: unknown;
};

const sanitizeCreatePayload = (
  payload: CreateUserProfilePayload,
): { profile: UserProfileMongo } => {
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

  return { profile };
};

const sanitizeUpdatePayload = (
  payload: UpdateUserProfilePayload,
): { attributes: Partial<UserProfileMongo> } => {
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

  if (!hasProfileUpdate) {
    throw new UserProfileServiceError("No updatable fields provided.", 400);
  }

  return {
    attributes: pruneUndefined(sanitized),
  };
};

export const UserProfileService = {
  async create(payload: CreateUserProfilePayload): Promise<UserProfileType> {
    const { profile: attributes } = sanitizeCreatePayload(payload);

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

    attributes.personalDetails!.profilePictureUrl = getURLForKey(
      attributes.personalDetails!.profilePictureUrl!,
    );

    const document = await UserProfileModel.create(attributes);
    await syncUserProfileToPostgres(document);

    let availability: UserAvailability[] = [];

    try {
      availability = await BaseAvailabilityService.getByUserId(
        attributes.userId,
      );
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = await applyProfileStatus(document, availability);

    const userOrganisation = await UserOrganizationModel.findOne({
      practitionerReference: attributes.userId,
      organizationReference: attributes.organizationId,
    });

    const profile = buildDomainProfile(document, { statusOverride: status });
    return applyPmsPreferenceDefaults(profile, userOrganisation?.roleCode);
  },

  async update(
    userId: unknown,
    organizationId: unknown,
    payload: UpdateUserProfilePayload,
  ): Promise<UserProfileType | null> {
    const identifier = requireUserId(userId);
    const organizationIdentifier = requireOrganizationId(organizationId);
    const { attributes } = sanitizeUpdatePayload(payload);

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

    let availability: UserAvailability[] = [];

    try {
      availability = await BaseAvailabilityService.getByUserId(identifier);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = await applyProfileStatus(document, availability);

    await syncUserProfileToPostgres(document);

    const userOrganisation = await UserOrganizationModel.findOne({
      practitionerReference: identifier,
      organizationReference: organizationIdentifier,
    });

    const profile = buildDomainProfile(document, { statusOverride: status });
    return applyPmsPreferenceDefaults(profile, userOrganisation?.roleCode);
  },

  async getByUserId(userId: unknown, organizationId: unknown) {
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

    const userOrganisation = await UserOrganizationModel.findOne({
      practitionerReference: userId,
      organizationReference: organizationId,
    });

    const profile = applyPmsPreferenceDefaults(
      buildDomainProfile(document, { statusOverride: status }),
      userOrganisation?.roleCode,
    );

    return {
      profile,
      mapping: userOrganisation,
      baseAvailability: availability,
    };
  },
};
