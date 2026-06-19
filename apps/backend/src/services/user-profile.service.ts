import type {
  UserProfileMongo,
  UserProfilePersonalDetailsMongo,
  UserProfileProfessionalDetailsMongo,
  UserProfileAddressMongo,
  UserProfileDocumentMongo,
} from "../models/user-profile";
import type {
  UserProfile as UserProfileType,
  UserAvailability,
} from "@yosemite-crew/types";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
} from "./base-availability.service";
import { getURLForKey } from "src/middlewares/upload";
import { prisma } from "src/config/prisma";
import { Prisma } from "@prisma/client";

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
const COMBINED_TIMEZONE_PREFIX_REGEX = /^UTC[+-](?:0?\d|1\d|2[0-3]):[0-5]\d/;

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
  const combinedMatch = COMBINED_TIMEZONE_PREFIX_REGEX.exec(trimmed);

  if (combinedMatch) {
    const remainder = trimmed.slice(combinedMatch[0].length).trimStart();
    if (remainder.startsWith("-")) {
      const iana = remainder.slice(1).trim();
      if (iana && isValidIanaTimezone(iana)) {
        return iana;
      }
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

type PrismaUserProfileWithAddress = Prisma.UserProfileGetPayload<{
  include: { address: true };
}>;

const syncUserProfileAddress = async (
  userProfileId: string,
  address: UserProfileAddressMongo | undefined,
) => {
  if (!address) {
    await prisma.userProfileAddress.deleteMany({
      where: { userProfileId },
    });
    return;
  }

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
};

const buildPersonalDetailsFromPrisma = (
  profile: PrismaUserProfileWithAddress,
): UserProfilePersonalDetailsMongo | undefined => {
  const rawPersonalDetails = profile.personalDetails as
    | UserProfilePersonalDetailsMongo
    | undefined;

  if (!rawPersonalDetails && !profile.address) {
    return undefined;
  }

  if (!rawPersonalDetails && profile.address) {
    return {
      address: pruneUndefined({
        addressLine: profile.address.addressLine ?? undefined,
        country: profile.address.country ?? undefined,
        city: profile.address.city ?? undefined,
        state: profile.address.state ?? undefined,
        postalCode: profile.address.postalCode ?? undefined,
        latitude: profile.address.latitude ?? undefined,
        longitude: profile.address.longitude ?? undefined,
      }),
    };
  }

  return {
    ...rawPersonalDetails,
    address: profile.address
      ? pruneUndefined({
          addressLine: profile.address.addressLine ?? undefined,
          country: profile.address.country ?? undefined,
          city: profile.address.city ?? undefined,
          state: profile.address.state ?? undefined,
          postalCode: profile.address.postalCode ?? undefined,
          latitude: profile.address.latitude ?? undefined,
          longitude: profile.address.longitude ?? undefined,
        })
      : rawPersonalDetails?.address
        ? pruneUndefined(rawPersonalDetails.address)
        : undefined,
  };
};

const buildDomainProfileFromPrisma = (
  profile: PrismaUserProfileWithAddress,
  options?: { statusOverride?: UserProfileMongo["status"] },
): UserProfileType => {
  const rawProfessionalDetails = profile.professionalDetails as
    | UserProfileProfessionalDetailsMongo
    | undefined;

  const personalDetails = buildPersonalDetailsFromPrisma(profile);

  const professionalDetails = rawProfessionalDetails
    ? pruneUndefined({
        ...rawProfessionalDetails,
        documents: rawProfessionalDetails.documents
          ? rawProfessionalDetails.documents.map((documentItem) =>
              pruneUndefined(documentItem),
            )
          : undefined,
      })
    : undefined;

  const profileDomain: UserProfileType = {
    _id: profile.id,
    userId: profile.userId,
    organizationId: profile.organizationId,
    personalDetails: personalDetails
      ? pruneUndefined(personalDetails)
      : undefined,
    professionalDetails,
    status: options?.statusOverride ?? profile.status ?? "DRAFT",
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };

  return pruneUndefined(profileDomain);
};

const buildDomainAvailabilityFromPrisma = (entry: {
  id: string;
  userId: string;
  dayOfWeek: string;
  slots: unknown;
  createdAt: Date;
  updatedAt: Date;
}): UserAvailability =>
  pruneUndefined({
    _id: entry.id,
    userId: entry.userId,
    dayOfWeek: entry.dayOfWeek as UserAvailability["dayOfWeek"],
    slots: entry.slots as UserAvailability["slots"],
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  });

const applyPmsPreferenceDefaults = (
  profile: UserProfileType,
  roleCode?: string,
): UserProfileType => {
  const normalizedRole = roleCode?.toUpperCase();
  const defaultOpenScreen =
    normalizedRole === "OWNER" ? "DASHBOARD" : "APPOINTMENTS";
  const defaultAppointmentView = "STATUS_BOARD";

  const existingPersonalDetails = profile.personalDetails ?? {};
  const existingPrefs = existingPersonalDetails.pmsPreferences ?? {};

  const shouldSetDefaultOpenScreen = !existingPrefs.defaultOpenScreen;
  const shouldSetAppointmentView = !existingPrefs.appointmentView;

  if (!shouldSetDefaultOpenScreen && !shouldSetAppointmentView) {
    return profile;
  }

  return {
    ...profile,
    personalDetails: {
      ...existingPersonalDetails,
      pmsPreferences: {
        ...existingPrefs,
        ...(shouldSetDefaultOpenScreen ? { defaultOpenScreen } : {}),
        ...(shouldSetAppointmentView
          ? { appointmentView: defaultAppointmentView }
          : {}),
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
    const userId = requireUserId(attributes.userId);
    const organizationId = requireOrganizationId(attributes.organizationId);

    const existing = await prisma.userProfile.findFirst({
      where: { userId, organizationId },
    });

    if (existing) {
      throw new UserProfileServiceError(
        "Profile already exists for this user in this organization.",
        409,
      );
    }

    const personalDetails = attributes.personalDetails
      ? {
          ...attributes.personalDetails,
          profilePictureUrl: attributes.personalDetails.profilePictureUrl
            ? getURLForKey(attributes.personalDetails.profilePictureUrl)
            : attributes.personalDetails.profilePictureUrl,
        }
      : undefined;

    const created = await prisma.userProfile.create({
      data: {
        userId,
        organizationId,
        personalDetails: (personalDetails ??
          undefined) as unknown as Prisma.InputJsonValue,
        professionalDetails: (attributes.professionalDetails ??
          undefined) as unknown as Prisma.InputJsonValue,
      },
      include: { address: true },
    });

    await syncUserProfileAddress(created.id, personalDetails?.address);

    let availability: UserAvailability[] = [];

    try {
      availability = await BaseAvailabilityService.getByUserId(userId);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = determineProfileStatus(
      {
        userId,
        organizationId,
        personalDetails,
        professionalDetails: attributes.professionalDetails ?? undefined,
        status: "DRAFT",
      },
      availability,
    );

    if (status !== created.status) {
      await prisma.userProfile.update({
        where: { id: created.id },
        data: { status },
      });
    }

    const storedProfile = await prisma.userProfile.findUnique({
      where: { id: created.id },
      include: { address: true },
    });

    const userOrganisation = await prisma.userOrganization.findFirst({
      where: {
        practitionerReference: {
          in: [userId, `Practitioner/${userId}`],
        },
        organizationReference: {
          in: [organizationId, `Organization/${organizationId}`],
        },
      },
    });

    const profile = buildDomainProfileFromPrisma(
      storedProfile ?? (created as PrismaUserProfileWithAddress),
      {
        statusOverride: status,
      },
    );
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

    const existing = await prisma.userProfile.findFirst({
      where: { userId: identifier, organizationId: organizationIdentifier },
      include: { address: true },
    });

    if (!existing) {
      return null;
    }

    const updated =
      Object.keys(attributes).length > 0
        ? await prisma.userProfile.update({
            where: { id: existing.id },
            data: {
              personalDetails: (attributes.personalDetails ??
                existing.personalDetails ??
                undefined) as unknown as Prisma.InputJsonValue,
              professionalDetails: (attributes.professionalDetails ??
                existing.professionalDetails ??
                undefined) as unknown as Prisma.InputJsonValue,
            },
            include: { address: true },
          })
        : existing;

    const personalDetails = buildPersonalDetailsFromPrisma(updated);
    await syncUserProfileAddress(updated.id, personalDetails?.address);

    let availability: UserAvailability[] = [];

    try {
      availability = await BaseAvailabilityService.getByUserId(identifier);
    } catch (error: unknown) {
      if (error instanceof BaseAvailabilityServiceError) {
        throw new UserProfileServiceError(error.message, error.statusCode);
      }

      throw error;
    }

    const status = determineProfileStatus(
      {
        userId: updated.userId,
        organizationId: updated.organizationId,
        personalDetails,
        professionalDetails: updated.professionalDetails as
          | UserProfileProfessionalDetailsMongo
          | undefined,
        status: updated.status ?? "DRAFT",
      },
      availability,
    );

    if (updated.status !== status) {
      await prisma.userProfile.update({
        where: { id: updated.id },
        data: { status },
      });
    }

    const [storedProfile, userOrganisation] = await Promise.all([
      prisma.userProfile.findUnique({
        where: { id: updated.id },
        include: { address: true },
      }),
      prisma.userOrganization.findFirst({
        where: {
          practitionerReference: {
            in: [identifier, `Practitioner/${identifier}`],
          },
          organizationReference: {
            in: [
              organizationIdentifier,
              `Organization/${organizationIdentifier}`,
            ],
          },
        },
      }),
    ]);

    if (!storedProfile) {
      return null;
    }

    const profile = applyPmsPreferenceDefaults(
      buildDomainProfileFromPrisma(storedProfile, { statusOverride: status }),
      userOrganisation?.roleCode,
    );
    return profile;
  },

  async getByUserId(userId: unknown, organizationId: unknown) {
    const identifier = requireUserId(userId);
    const organizationIdentifier = requireOrganizationId(organizationId);

    const [profile, availabilityRows, mapping] = await Promise.all([
      prisma.userProfile.findFirst({
        where: { userId: identifier, organizationId: organizationIdentifier },
        include: { address: true },
      }),
      prisma.baseAvailability.findMany({
        where: { userId: identifier },
        orderBy: { dayOfWeek: "asc" },
      }),
      prisma.userOrganization.findFirst({
        where: {
          practitionerReference: {
            in: [identifier, `Practitioner/${identifier}`],
          },
          organizationReference: {
            in: [
              organizationIdentifier,
              `Organization/${organizationIdentifier}`,
            ],
          },
        },
      }),
    ]);

    if (!profile) {
      return null;
    }

    const availability = availabilityRows.map((entry) =>
      buildDomainAvailabilityFromPrisma(entry),
    );
    const personalDetailsForStatus = buildPersonalDetailsFromPrisma(profile);
    const profileForStatus: UserProfileMongo = {
      userId: profile.userId,
      organizationId: profile.organizationId,
      personalDetails: personalDetailsForStatus,
      professionalDetails: (profile.professionalDetails ?? undefined) as
        | UserProfileProfessionalDetailsMongo
        | undefined,
      status: profile.status ?? "DRAFT",
    };
    const status = determineProfileStatus(profileForStatus, availability);

    return {
      profile: applyPmsPreferenceDefaults(
        buildDomainProfileFromPrisma(profile, { statusOverride: status }),
        mapping?.roleCode,
      ),
      mapping: mapping ? { ...mapping, _id: mapping.id } : null,
      baseAvailability: availability,
    };
  },
};
