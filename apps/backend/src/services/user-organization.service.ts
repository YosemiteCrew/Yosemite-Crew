import { Types } from "mongoose";
import UserOrganizationModel, {
  type UserOrganizationDocument,
  type UserOrganizationMongo,
} from "../models/user-organization";
import OrganizationModel, {
  type OrganizationMongo,
} from "../models/organization";
import {
  fromUserOrganizationRequestDTO,
  toUserOrganizationResponseDTO,
  type UserOrganizationRequestDTO,
  type UserOrganizationResponseDTO,
  type UserOrganization,
} from "@yosemite-crew/types";
import { ROLE_PERMISSIONS, RoleCode } from "src/models/role-permission";
import UserProfileModel from "src/models/user-profile";
import SpecialityModel from "src/models/speciality";
import { AvailabilityService } from "./availability.service";
import UserModel from "src/models/user";
import { OccupancyModel } from "src/models/occupancy";
import { OrgBilling } from "src/models/organization.billing";
import { OrgUsageCounters } from "src/models/organisation.usage.counter";
import { StripeService } from "./stripe.service";
import { sendFreePlanLimitReachedEmail } from "src/utils/org-usage-notifications";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";
import type { UserOrganization as PrismaUserOrganization } from "@prisma/client";

export type UserOrganizationFHIRPayload = UserOrganizationRequestDTO;

export class UserOrganizationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "UserOrganizationServiceError";
  }
}

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const DEFAULT_PMS_URL =
  process.env.PMS_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  "https://app.yosemitecrew.com";

const extractReferenceId = (value: string) => value.split("/").pop()?.trim();

const buildDisplayName = (
  user?: { firstName?: string; lastName?: string } | null,
) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

const toPrismaUserOrganizationData = (doc: UserOrganizationDocument) => {
  const obj = doc.toObject() as UserOrganizationMongo & {
    _id: { toString(): string };
    createdAt?: Date;
    updatedAt?: Date;
  };

  return {
    id: obj._id.toString(),
    fhirId: obj.fhirId ?? undefined,
    practitionerReference: obj.practitionerReference,
    organizationReference: obj.organizationReference,
    roleCode: obj.roleCode,
    roleDisplay: obj.roleDisplay ?? undefined,
    active: obj.active ?? true,
    extraPermissions: obj.extraPermissions ?? [],
    revokedPermissions: obj.revokedPermissions ?? [],
    effectivePermissions: obj.effectivePermissions ?? [],
    createdAt: obj.createdAt ?? undefined,
    updatedAt: obj.updatedAt ?? undefined,
  };
};

const syncUserOrganizationToPostgres = async (
  doc: UserOrganizationDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaUserOrganizationData(doc);
    await prisma.userOrganization.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("UserOrganization", err);
  }
};

const resolveOrganisationName = async (reference: string) => {
  const orgId = extractOrganizationIdentifier(reference);
  const orgQuery = buildOrganizationLookupQuery(orgId);
  const organisation = await OrganizationModel.findOne(orgQuery)
    .select("name")
    .lean();
  return organisation?.name;
};

const sendPermissionsUpdatedEmail = async (params: {
  practitionerReference: string;
  organizationReference: string;
  roleCode: string;
  roleDisplay?: string;
}) => {
  try {
    const userId =
      extractReferenceId(params.practitionerReference) ??
      params.practitionerReference;
    const [user, organisationName] = await Promise.all([
      UserModel.findOne(
        { userId },
        { email: 1, firstName: 1, lastName: 1 },
      ).lean(),
      resolveOrganisationName(params.organizationReference),
    ]);

    if (!user?.email || !organisationName) return;

    await sendEmailTemplate({
      to: user.email,
      templateId: "permissionsUpdated",
      templateData: {
        employeeName: buildDisplayName(user),
        organisationName,
        roleName: params.roleDisplay ?? params.roleCode,
        ctaUrl: DEFAULT_PMS_URL,
        ctaLabel: "Review Access",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send permissions updated email.", error);
  }
};

const VALID_ROLE_CODES: Set<RoleCode> = new Set([
  "OWNER",
  "ADMIN",
  "SUPERVISOR",
  "VETERINARIAN",
  "TECHNICIAN",
  "ASSISTANT",
  "RECEPTIONIST",
]);

function validateRoleCode(role: string): RoleCode {
  const cleaned = role.trim().toUpperCase() as RoleCode;
  if (!VALID_ROLE_CODES.has(cleaned)) {
    throw new UserOrganizationServiceError(
      `Invalid roleCode "${role}". Allowed: ${[...VALID_ROLE_CODES].join(", ")}`,
      400,
    );
  }
  return cleaned;
}

function computeEffectivePermissions(
  role: RoleCode,
  extra?: string[],
  revoked?: string[],
): string[] {
  const base = ROLE_PERMISSIONS[role] ?? [];
  const extras = extra ?? [];
  const removed = new Set(revoked ?? []);
  const combined = new Set([...base, ...extras]);

  for (const permission of removed) {
    combined.delete(permission);
  }

  return [...combined];
}

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const arrayValue = value as unknown[];
    const cleaned: unknown[] = arrayValue
      .map((item) => pruneUndefined(item))
      .filter((item) => item !== undefined);
    return cleaned as unknown as T;
  }

  if (value && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }

    const record = value as Record<string, unknown>;
    const cleanedRecord: Record<string, unknown> = {};

    for (const [key, entryValue] of Object.entries(record)) {
      const next = pruneUndefined(entryValue);

      if (next !== undefined) {
        cleanedRecord[key] = next;
      }
    }

    return cleanedRecord as unknown as T;
  }

  return value;
};

const requireSafeString = (value: unknown, fieldName: string): string => {
  if (value == null) {
    throw new UserOrganizationServiceError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new UserOrganizationServiceError(
      `${fieldName} must be a string.`,
      400,
    );
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new UserOrganizationServiceError(
      `${fieldName} cannot be empty.`,
      400,
    );
  }

  if (trimmed.includes("$")) {
    throw new UserOrganizationServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
  }

  return trimmed;
};

const optionalSafeString = (
  value: unknown,
  fieldName: string,
): string | undefined => {
  if (value == null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new UserOrganizationServiceError(
      `${fieldName} must be a string.`,
      400,
    );
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("$")) {
    throw new UserOrganizationServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
  }

  return trimmed;
};

const sanitizePermissionList = (
  value: unknown,
  fieldName: string,
): string[] => {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new UserOrganizationServiceError(
      `${fieldName} must be an array of strings.`,
      400,
    );
  }

  const seen = new Set<string>();

  for (const entry of value) {
    const safe = optionalSafeString(entry, fieldName);
    if (safe) {
      seen.add(safe);
    }
  }

  return [...seen];
};

const ensureSafeIdentifier = (value: unknown): string | undefined => {
  const identifier = optionalSafeString(value, "Identifier");

  if (!identifier) {
    return undefined;
  }

  if (
    !Types.ObjectId.isValid(identifier) &&
    !/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)
  ) {
    throw new UserOrganizationServiceError("Invalid identifier format.", 400);
  }

  return identifier;
};

const extractOrganizationIdentifier = (reference: string): string => {
  const trimmed = reference.trim();

  if (!trimmed) {
    throw new UserOrganizationServiceError(
      "Organization reference cannot be empty.",
      400,
    );
  }

  const segments = trimmed.split("/").filter(Boolean);

  if (!segments.length) {
    throw new UserOrganizationServiceError(
      "Invalid organization reference format.",
      400,
    );
  }

  const lastSegment = segments.at(-1);

  if (!lastSegment || lastSegment.toLowerCase() === "organization") {
    throw new UserOrganizationServiceError(
      "Invalid organization reference format.",
      400,
    );
  }

  return lastSegment;
};

const ensureOrgUsageCounters = async (orgId: Types.ObjectId) => {
  const doc = await OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $setOnInsert: { orgId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  if (doc && shouldDualWrite) {
    try {
      await prisma.organizationUsageCounter.upsert({
        where: { orgId: orgId.toString() },
        create: {
          id: doc._id.toString(),
          orgId: orgId.toString(),
          appointmentsUsed: doc.appointmentsUsed ?? 0,
          toolsUsed: doc.toolsUsed ?? 0,
          usersActiveCount: doc.usersActiveCount ?? 0,
          usersBillableCount: doc.usersBillableCount ?? 0,
          freeAppointmentsLimit: doc.freeAppointmentsLimit ?? 120,
          freeToolsLimit: doc.freeToolsLimit ?? 200,
          freeUsersLimit: doc.freeUsersLimit ?? 10,
          freeLimitReachedAt: doc.freeLimitReachedAt ?? undefined,
          createdAt: doc.createdAt ?? undefined,
          updatedAt: doc.updatedAt ?? undefined,
        },
        update: {
          appointmentsUsed: doc.appointmentsUsed ?? 0,
          toolsUsed: doc.toolsUsed ?? 0,
          usersActiveCount: doc.usersActiveCount ?? 0,
          usersBillableCount: doc.usersBillableCount ?? 0,
          freeAppointmentsLimit: doc.freeAppointmentsLimit ?? 120,
          freeToolsLimit: doc.freeToolsLimit ?? 200,
          freeUsersLimit: doc.freeUsersLimit ?? 10,
          freeLimitReachedAt: doc.freeLimitReachedAt ?? undefined,
          updatedAt: doc.updatedAt ?? undefined,
        },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter ensure", err);
    }
  }

  return doc;
};

const isFreePlan = async (orgId: Types.ObjectId) => {
  const billing = await OrgBilling.findOne({ orgId }).select("plan").lean();
  return !billing || billing.plan === "free";
};

const markFreeLimitReachedAt = async (
  usage: Awaited<ReturnType<typeof ensureOrgUsageCounters>>,
) => {
  if (
    !usage ||
    usage.freeLimitReachedAt ||
    ((usage.usersActiveCount ?? 0) < (usage.freeUsersLimit ?? 0) &&
      (usage.appointmentsUsed ?? 0) < (usage.freeAppointmentsLimit ?? 0) &&
      (usage.toolsUsed ?? 0) < (usage.freeToolsLimit ?? 0))
  ) {
    return false;
  }

  const updated = await OrgUsageCounters.updateOne(
    { _id: usage._id, freeLimitReachedAt: null },
    { $set: { freeLimitReachedAt: new Date() } },
  );

  if (shouldDualWrite && updated.modifiedCount > 0) {
    try {
      await prisma.organizationUsageCounter.updateMany({
        where: { orgId: usage.orgId.toString() },
        data: { freeLimitReachedAt: new Date() },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter freeLimitReachedAt", err);
    }
  }

  return updated.modifiedCount > 0;
};

const resolveOrganisationObjectId = async (
  reference: string,
): Promise<Types.ObjectId> => {
  const orgQuery = buildOrganizationLookupQuery(reference);
  const organisation = await OrganizationModel.findOne(orgQuery)
    .select("_id")
    .setOptions({ sanitizeFilter: true });

  if (!organisation) {
    throw new UserOrganizationServiceError("Organization not found.", 404);
  }

  return organisation._id;
};

const reserveMemberSlot = async (orgId: Types.ObjectId) => {
  await ensureOrgUsageCounters(orgId);

  if (await isFreePlan(orgId)) {
    const updated = await OrgUsageCounters.findOneAndUpdate(
      {
        orgId,
        $expr: { $lt: ["$usersActiveCount", "$freeUsersLimit"] },
      },
      { $inc: { usersActiveCount: 1 } },
      { new: true },
    );

    if (!updated) {
      throw new UserOrganizationServiceError(
        "Free plan member limit reached.",
        403,
      );
    }

    const didReachLimit = await markFreeLimitReachedAt(updated);
    if (didReachLimit) {
      void sendFreePlanLimitReachedEmail({ orgId, usage: updated });
    }

    if (shouldDualWrite) {
      try {
        await prisma.organizationUsageCounter.updateMany({
          where: { orgId: orgId.toString() },
          data: { usersActiveCount: updated.usersActiveCount ?? 0 },
        });
      } catch (err) {
        handleDualWriteError("OrganizationUsageCounter reserve", err);
      }
    }
    return true;
  }

  await OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $inc: { usersActiveCount: 1 } },
    { new: true },
  );

  if (shouldDualWrite) {
    try {
      await prisma.organizationUsageCounter.updateMany({
        where: { orgId: orgId.toString() },
        data: { usersActiveCount: { increment: 1 } },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter reserve", err);
    }
  }
  return true;
};

const releaseMemberSlot = async (orgId: Types.ObjectId) => {
  await OrgUsageCounters.updateOne(
    { orgId },
    { $inc: { usersActiveCount: -1 } },
  );

  if (shouldDualWrite) {
    try {
      await prisma.organizationUsageCounter.updateMany({
        where: { orgId: orgId.toString() },
        data: { usersActiveCount: { decrement: 1 } },
      });
    } catch (err) {
      handleDualWriteError("OrganizationUsageCounter release", err);
    }
  }
};

const buildOrganizationLookupQuery = (reference: string) => {
  const identifier = extractOrganizationIdentifier(reference);
  const queries: Array<Record<string, string>> = [];

  if (Types.ObjectId.isValid(identifier)) {
    queries.push({ _id: identifier });
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
    queries.push({ fhirId: identifier });
  }

  if (!queries.length) {
    throw new UserOrganizationServiceError(
      "Invalid organization reference format.",
      400,
    );
  }

  return queries.length === 1 ? queries[0] : { $or: queries };
};

const sanitizeUserOrganizationAttributes = (
  dto: UserOrganization,
): UserOrganizationMongo => {
  const practitionerReference = requireSafeString(
    dto.practitionerReference,
    "Practitioner reference",
  );
  const organizationReference = requireSafeString(
    dto.organizationReference,
    "Organization reference",
  );
  const roleCode = requireSafeString(dto.roleCode, "Role code");
  const roleDisplay = optionalSafeString(dto.roleDisplay, "Role display");
  const extraPermissions = sanitizePermissionList(
    dto.extraPermissions,
    "Extra permissions",
  );
  const revokedPermissions = sanitizePermissionList(
    dto.revokedPermissions,
    "Revoked permissions",
  );

  const effectivePermissions = computeEffectivePermissions(
    roleCode as RoleCode,
    extraPermissions,
    revokedPermissions,
  );

  return {
    fhirId: ensureSafeIdentifier(dto.id),
    practitionerReference,
    organizationReference,
    roleCode,
    roleDisplay,
    active: typeof dto.active === "boolean" ? dto.active : true,
    extraPermissions,
    revokedPermissions,
    effectivePermissions,
  };
};

const buildUserOrganizationDomain = (
  document: UserOrganizationDocument,
): UserOrganization => {
  const { _id, ...rest } = document.toObject({
    virtuals: false,
  }) as UserOrganizationMongo & {
    _id: Types.ObjectId;
  };

  return {
    _id,
    fhirId: rest.fhirId,
    practitionerReference: rest.practitionerReference,
    organizationReference: rest.organizationReference,
    roleCode: rest.roleCode,
    roleDisplay: rest.roleDisplay,
    active: rest.active,
    extraPermissions: rest.extraPermissions ?? [],
    revokedPermissions: rest.revokedPermissions ?? [],
    effectivePermissions: computeEffectivePermissions(
      rest.roleCode as RoleCode,
      rest.extraPermissions,
      rest.revokedPermissions,
    ),
  };
};

type PrismaUserOrganizationLite = Pick<
  PrismaUserOrganization,
  | "id"
  | "fhirId"
  | "practitionerReference"
  | "organizationReference"
  | "roleCode"
  | "roleDisplay"
  | "active"
  | "extraPermissions"
  | "revokedPermissions"
  | "effectivePermissions"
>;

const buildUserOrganizationDomainFromPrisma = (
  mapping: PrismaUserOrganizationLite,
): UserOrganization => ({
  _id: mapping.id,
  fhirId: mapping.fhirId ?? undefined,
  practitionerReference: mapping.practitionerReference,
  organizationReference: mapping.organizationReference,
  roleCode: mapping.roleCode,
  roleDisplay: mapping.roleDisplay ?? undefined,
  active: mapping.active ?? true,
  extraPermissions: mapping.extraPermissions ?? [],
  revokedPermissions: mapping.revokedPermissions ?? [],
  effectivePermissions: computeEffectivePermissions(
    mapping.roleCode as RoleCode,
    mapping.extraPermissions ?? [],
    mapping.revokedPermissions ?? [],
  ),
});

const mapOrganizationFromPrisma = (org: {
  id: string;
  fhirId: string | null;
  name: string;
  imageUrl: string | null;
  phoneNo: string;
  type: string;
  googlePlacesId: string | null;
  address: {
    addressLine: string | null;
    country: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
    location: unknown;
  } | null;
  taxId: string;
  dunsNumber: string | null;
  petNamePreference: string | null;
  website: string | null;
  documensoTeamId: string | null;
  documensoApiKey: string | null;
  isVerified: boolean;
  isActive: boolean;
  typeCoding: unknown;
  healthAndSafetyCertNo: string | null;
  animalWelfareComplianceCertNo: string | null;
  fireAndEmergencyCertNo: string | null;
  stripeAccountId: string | null;
  averageRating: number | null;
  ratingCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  _id: org.id,
  fhirId: org.fhirId ?? undefined,
  name: org.name,
  taxId: org.taxId ?? undefined,
  DUNSNumber: org.dunsNumber ?? undefined,
  imageURL: org.imageUrl ?? undefined,
  phoneNo: org.phoneNo ?? undefined,
  type: org.type,
  petNamePreference: org.petNamePreference ?? undefined,
  website: org.website ?? undefined,
  documensoTeamId: org.documensoTeamId ?? undefined,
  documensoApiKey: org.documensoApiKey ?? undefined,
  googlePlacesId: org.googlePlacesId ?? undefined,
  stripeAccountId: org.stripeAccountId ?? undefined,
  isVerified: org.isVerified ?? undefined,
  isActive: org.isActive ?? undefined,
  typeCoding: org.typeCoding ?? undefined,
  healthAndSafetyCertNo: org.healthAndSafetyCertNo ?? undefined,
  animalWelfareComplianceCertNo: org.animalWelfareComplianceCertNo ?? undefined,
  fireAndEmergencyCertNo: org.fireAndEmergencyCertNo ?? undefined,
  averageRating: org.averageRating ?? undefined,
  ratingCount: org.ratingCount ?? undefined,
  createdAt: org.createdAt ?? undefined,
  updatedAt: org.updatedAt ?? undefined,
  address: org.address
    ? {
        addressLine: org.address.addressLine ?? undefined,
        country: org.address.country ?? undefined,
        city: org.address.city ?? undefined,
        state: org.address.state ?? undefined,
        postalCode: org.address.postalCode ?? undefined,
        latitude: org.address.latitude ?? undefined,
        longitude: org.address.longitude ?? undefined,
        location: (org.address.location ??
          undefined) as OrganizationMongo["address"] extends {
          location?: infer L;
        }
          ? L
          : undefined,
      }
    : undefined,
});

const createPersistableFromFHIR = (payload: UserOrganizationFHIRPayload) => {
  if (payload?.resourceType !== "PractitionerRole") {
    throw new UserOrganizationServiceError(
      "Invalid payload. Expected FHIR PractitionerRole resource.",
      400,
    );
  }

  const attributes = fromUserOrganizationRequestDTO(payload);
  const persistable = pruneUndefined(
    sanitizeUserOrganizationAttributes(attributes),
  );

  return { persistable };
};

const normalizeLookupIdentifier = (
  value: unknown,
  fieldName: string,
): string => {
  const identifier = optionalSafeString(value, fieldName);

  if (!identifier) {
    throw new UserOrganizationServiceError(`${fieldName} is required.`, 400);
  }

  return identifier;
};

const resolveIdQuery = (
  id: unknown,
): { _id?: string; fhirId?: string } | null => {
  const identifier = normalizeLookupIdentifier(id, "Identifier");

  if (Types.ObjectId.isValid(identifier)) {
    return { _id: identifier };
  }

  if (/^[A-Za-z0-9\-.]{1,64}$/.test(identifier)) {
    return { fhirId: identifier };
  }

  return null;
};

const resolveStrictIdQuery = (
  id: unknown,
  context: string,
): { _id?: string; fhirId?: string } => {
  const query = resolveIdQuery(id);

  if (!query) {
    throw new UserOrganizationServiceError(`Invalid ${context} format.`, 400);
  }

  return query;
};

type ReferenceLookup = Partial<
  Record<"practitionerReference" | "organizationReference", string>
>;

const buildReferenceLookups = (id: unknown): ReferenceLookup[] => {
  const trimmed = normalizeLookupIdentifier(id, "Identifier");

  if (!trimmed) {
    return [];
  }

  const lookups: ReferenceLookup[] = [];
  const seen = new Set<string>();
  const pushLookup = (
    field: "practitionerReference" | "organizationReference",
    reference: string,
  ) => {
    const key = `${field}:${reference}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    lookups.push({ [field]: reference });
  };

  if (trimmed.includes("/")) {
    if (trimmed.startsWith("Practitioner/")) {
      pushLookup("practitionerReference", trimmed);
    } else if (trimmed.startsWith("Organization/")) {
      pushLookup("organizationReference", trimmed);
    } else {
      pushLookup("practitionerReference", trimmed);
      pushLookup("organizationReference", trimmed);
    }
  } else {
    pushLookup("practitionerReference", trimmed);
    pushLookup("organizationReference", trimmed);
    pushLookup("practitionerReference", `Practitioner/${trimmed}`);
    pushLookup("organizationReference", `Organization/${trimmed}`);
  }

  return lookups;
};

const syncSeatsIfBusiness = async (orgId: Types.ObjectId) => {
  const billing = await OrgBilling.findOne({ orgId }).select("plan").lean();

  if (billing?.plan === "business") {
    await StripeService.syncSubscriptionSeats(orgId.toString());
  }
};

const findExistingUserOrganization = async (id?: string | null) => {
  if (!id) return null;
  return UserOrganizationModel.findOne(resolveStrictIdQuery(id, "identifier"));
};

const handleExistingSeatTransition = async (
  document: UserOrganizationDocument,
  willBeActive: boolean,
) => {
  const wasActive = document.active ?? false;
  const orgObjectId = await resolveOrganisationObjectId(
    document.organizationReference,
  );
  let seatDelta: -1 | 0 | 1 = 0;

  if (!wasActive && willBeActive) {
    await reserveMemberSlot(orgObjectId);
    seatDelta = 1;
  } else if (wasActive && !willBeActive) {
    await releaseMemberSlot(orgObjectId);
    seatDelta = -1;
  }

  return { orgObjectId, seatDelta };
};

const reserveSeatForNewMapping = async (
  persistable: UserOrganizationMongo,
  willBeActive: boolean,
) => {
  if (!willBeActive) {
    return { orgObjectId: null, seatDelta: 0 as const };
  }

  const orgObjectId = await resolveOrganisationObjectId(
    persistable.organizationReference,
  );
  await reserveMemberSlot(orgObjectId);
  return { orgObjectId, seatDelta: 1 as const };
};

const createUserOrganizationWithRollback = async (
  persistable: UserOrganizationMongo,
  seatDelta: -1 | 0 | 1,
  orgObjectId: Types.ObjectId | null,
) => {
  try {
    const document = await UserOrganizationModel.create(persistable);
    return { document, created: true };
  } catch (err) {
    if (seatDelta === 1 && orgObjectId) {
      await releaseMemberSlot(orgObjectId);
    }
    throw err;
  }
};

export const UserOrganizationService = {
  async upsert(payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    const id = ensureSafeIdentifier(payload.id ?? persistable.fhirId);
    let document = await findExistingUserOrganization(id);
    let created = false;

    let orgObjectId: Types.ObjectId | null = null;
    let seatDelta: -1 | 0 | 1 = 0;
    const willBeActive = persistable.active !== false;

    if (document) {
      // Existing document — detect state transitions
      ({ orgObjectId, seatDelta } = await handleExistingSeatTransition(
        document,
        willBeActive,
      ));

      document = await UserOrganizationModel.findOneAndUpdate(
        { _id: document._id },
        { $set: persistable },
        { new: true, sanitizeFilter: true },
      );
    } else {
      ({ orgObjectId, seatDelta } = await reserveSeatForNewMapping(
        persistable,
        willBeActive,
      ));
      ({ document, created } = await createUserOrganizationWithRollback(
        persistable,
        seatDelta,
        orgObjectId,
      ));
    }

    if (!document) {
      throw new UserOrganizationServiceError(
        "Unable to persist user-organization mapping.",
        500,
      );
    }

    if (seatDelta !== 0 && orgObjectId) {
      await syncSeatsIfBusiness(orgObjectId);
    }

    await syncUserOrganizationToPostgres(document);

    return {
      response: toUserOrganizationResponseDTO(
        buildUserOrganizationDomain(document),
      ),
      created,
    };
  },

  async create(payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    let orgObjectId: Types.ObjectId | null = null;

    if (persistable.active !== false) {
      orgObjectId = await resolveOrganisationObjectId(
        persistable.organizationReference,
      );
      await reserveMemberSlot(orgObjectId);
    }

    let document: UserOrganizationDocument;
    try {
      document = await UserOrganizationModel.create(persistable);
    } catch (err) {
      if (orgObjectId) await releaseMemberSlot(orgObjectId);
      throw err;
    }

    if (orgObjectId) {
      await syncSeatsIfBusiness(orgObjectId);
    }

    await syncUserOrganizationToPostgres(document);

    return toUserOrganizationResponseDTO(buildUserOrganizationDomain(document));
  },

  async getById(
    id: string,
  ): Promise<
    UserOrganizationResponseDTO | UserOrganizationResponseDTO[] | null
  > {
    if (isReadFromPostgres()) {
      const idQuery = resolveIdQuery(id);
      if (idQuery) {
        const mapping = await prisma.userOrganization.findFirst({
          where: idQuery._id ? { id: idQuery._id } : { fhirId: idQuery.fhirId },
        });

        if (mapping) {
          return toUserOrganizationResponseDTO(
            buildUserOrganizationDomainFromPrisma(mapping),
          );
        }
      }

      const referenceQueries = buildReferenceLookups(id);
      if (referenceQueries.length) {
        const mappings = await prisma.userOrganization.findMany({
          where: { OR: referenceQueries },
        });

        if (!mappings.length) {
          return null;
        }

        if (mappings.length === 1) {
          return toUserOrganizationResponseDTO(
            buildUserOrganizationDomainFromPrisma(mappings[0]),
          );
        }

        return mappings.map((mapping) =>
          toUserOrganizationResponseDTO(
            buildUserOrganizationDomainFromPrisma(mapping),
          ),
        );
      }

      return null;
    }

    let document: UserOrganizationDocument | null = null;
    const idQuery = resolveIdQuery(id);

    if (idQuery) {
      document = await UserOrganizationModel.findOne(idQuery, null, {
        sanitizeFilter: true,
      });
    }

    if (!document) {
      const referenceQueries = buildReferenceLookups(id);

      if (referenceQueries.length) {
        const documents = await UserOrganizationModel.find({
          $or: referenceQueries,
        }).setOptions({
          sanitizeFilter: true,
        });

        if (!documents.length) {
          return null;
        }

        if (documents.length === 1) {
          const mapping = buildUserOrganizationDomain(documents[0]);
          return toUserOrganizationResponseDTO(mapping);
        }

        const mappings = documents.map((doc) =>
          buildUserOrganizationDomain(doc),
        );
        return mappings.map((mapping) =>
          toUserOrganizationResponseDTO(mapping),
        );
      }
    }

    if (!document) {
      return null;
    }

    const mapping = buildUserOrganizationDomain(document);
    return toUserOrganizationResponseDTO(mapping);
  },

  async listAll() {
    if (isReadFromPostgres()) {
      const mappings = await prisma.userOrganization.findMany();
      return mappings.map((mapping) =>
        toUserOrganizationResponseDTO(
          buildUserOrganizationDomainFromPrisma(mapping),
        ),
      );
    }

    const documents = await UserOrganizationModel.find();
    const mappings = documents.map((document) =>
      buildUserOrganizationDomain(document),
    );

    return mappings.map((mapping) => toUserOrganizationResponseDTO(mapping));
  },

  async deleteById(id: string) {
    const doc = await UserOrganizationModel.findOneAndDelete(
      resolveStrictIdQuery(id, "identifier"),
      { sanitizeFilter: true },
    );

    if (doc?.active !== false) {
      const orgObjectId = await resolveOrganisationObjectId(
        doc!.organizationReference,
      );
      await releaseMemberSlot(orgObjectId);
      await syncSeatsIfBusiness(orgObjectId);
    }

    if (doc && shouldDualWrite) {
      try {
        await prisma.userOrganization.deleteMany({
          where: { id: doc._id.toString() },
        });
      } catch (err) {
        handleDualWriteError("UserOrganization delete", err);
      }
    }

    return Boolean(doc);
  },

  async update(id: string, payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    const existing = await UserOrganizationModel.findOne(
      resolveStrictIdQuery(id, "identifier"),
    );

    if (!existing) return null;

    const priorRoleCode = existing.roleCode;
    const priorRoleDisplay = existing.roleDisplay;
    const priorPermissions = [...(existing.effectivePermissions ?? [])].sort(
      (a, b) => a.localeCompare(b),
    );

    const wasActive = existing.active;
    const willBeActive = persistable.active !== false;

    const orgObjectId = await resolveOrganisationObjectId(
      existing.organizationReference,
    );

    if (!wasActive && willBeActive) {
      await reserveMemberSlot(orgObjectId);
    }

    if (wasActive && !willBeActive) {
      await releaseMemberSlot(orgObjectId);
    }

    const document = await UserOrganizationModel.findOneAndUpdate(
      { _id: existing._id },
      { $set: persistable },
      { new: true, sanitizeFilter: true },
    );

    if (!document) return null;

    if (wasActive !== willBeActive) {
      await syncSeatsIfBusiness(orgObjectId);
    }

    const nextPermissions = [...(document.effectivePermissions ?? [])].sort(
      (a, b) => a.localeCompare(b),
    );
    const permissionsChanged =
      priorRoleCode !== document.roleCode ||
      priorRoleDisplay !== document.roleDisplay ||
      priorPermissions.join("|") !== nextPermissions.join("|");

    if (permissionsChanged) {
      void sendPermissionsUpdatedEmail({
        practitionerReference: document.practitionerReference,
        organizationReference: document.organizationReference,
        roleCode: document.roleCode,
        roleDisplay: document.roleDisplay,
      });
    }

    await syncUserOrganizationToPostgres(document);

    return toUserOrganizationResponseDTO(buildUserOrganizationDomain(document));
  },

  async createUserOrganizationMapping(userOrganisation: UserOrganization) {
    const persistable = pruneUndefined(
      sanitizeUserOrganizationAttributes(userOrganisation),
    );
    let orgObjectId: Types.ObjectId | null = null;
    let reservedMemberSlot = false;

    if (persistable.active !== false) {
      orgObjectId = await resolveOrganisationObjectId(
        persistable.organizationReference,
      );
      await reserveMemberSlot(orgObjectId);
      await syncSeatsIfBusiness(orgObjectId);
      reservedMemberSlot = true;
    }

    let document: UserOrganizationDocument;
    try {
      document = await UserOrganizationModel.create(persistable);
    } catch (error) {
      if (reservedMemberSlot && orgObjectId) {
        await releaseMemberSlot(orgObjectId);
      }
      throw error;
    }
    if (!document) {
      throw new UserOrganizationServiceError(
        "Unable to create user-organization mapping.",
        500,
      );
    }

    await syncUserOrganizationToPostgres(document);
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireSafeString(organisationId, "Organization Identifier");

    await UserOrganizationModel.deleteMany({
      organizationReference: orgId,
    }).exec();

    if (shouldDualWrite) {
      try {
        await prisma.userOrganization.deleteMany({
          where: { organizationReference: orgId },
        });
      } catch (err) {
        handleDualWriteError("UserOrganization deleteAllByOrganizationId", err);
      }
    }
  },

  async listByUserId(id: string) {
    const userId = requireSafeString(id, "User Id");
    const practitionerReferences = [userId, `Practitioner/${userId}`];

    if (isReadFromPostgres()) {
      const mappings = await prisma.userOrganization.findMany({
        where: {
          practitionerReference: {
            in: practitionerReferences,
          },
        },
      });

      if (!mappings.length) {
        return [];
      }

      const results = [];

      for (const mapping of mappings) {
        const organizationId = extractOrganizationIdentifier(
          mapping.organizationReference,
        );

        const organization = await prisma.organization.findFirst({
          where: {
            OR: [{ id: organizationId }, { fhirId: organizationId }],
          },
          include: { address: true },
        });

        const mappingDomain = buildUserOrganizationDomainFromPrisma(mapping);
        const effectivePermissions = mappingDomain.effectivePermissions ?? [];
        const canViewBilling =
          effectivePermissions.includes("billing:view:any") ||
          effectivePermissions.includes("billing:edit:any") ||
          effectivePermissions.includes("billing:edit:limited");

        const orgIdForBilling = organization?.id ?? organizationId;
        const [orgBilling, orgUsage] = canViewBilling
          ? await Promise.all([
              prisma.organizationBilling.findFirst({
                where: { orgId: orgIdForBilling },
              }),
              prisma.organizationUsageCounter.findFirst({
                where: { orgId: orgIdForBilling },
              }),
            ])
          : [null, null];

        results.push({
          mapping: toUserOrganizationResponseDTO(mappingDomain),
          organization: organization
            ? mapOrganizationFromPrisma(organization)
            : null,
          orgBilling: orgBilling ? { ...orgBilling, _id: orgBilling.id } : null,
          orgUsage: orgUsage ? { ...orgUsage, _id: orgUsage.id } : null,
        });
      }

      return results;
    }

    const mappings = await UserOrganizationModel.find({
      practitionerReference: { $in: practitionerReferences },
    });

    if (!mappings.length) {
      return [];
    }

    const results = [];

    for (const mapping of mappings) {
      const orgRef = mapping.organizationReference;

      // Extract the ID portion from FHIR reference
      const organizationId = extractOrganizationIdentifier(orgRef);

      // Build query using your existing helper
      const orgQuery = buildOrganizationLookupQuery(organizationId);

      // Lookup organization
      const organizationDoc = await OrganizationModel.findOne(orgQuery);

      const organization = organizationDoc?.toObject?.() ?? null; // convert mongoose doc to object

      const mappingDomain = buildUserOrganizationDomain(mapping);
      const effectivePermissions = mappingDomain.effectivePermissions ?? [];
      const canViewBilling =
        effectivePermissions.includes("billing:view:any") ||
        effectivePermissions.includes("billing:edit:any") ||
        effectivePermissions.includes("billing:edit:limited");

      const orgBilling = canViewBilling
        ? await OrgBilling.findOne({
            orgId: organization?._id,
          })
        : null;

      const orgUsage = canViewBilling
        ? await OrgUsageCounters.findOne({
            orgId: organization?._id,
          })
        : null;
      results.push({
        mapping: toUserOrganizationResponseDTO(mappingDomain),
        organization: organization,
        orgBilling: orgBilling,
        orgUsage: orgUsage,
      });
    }
    return results;
  },

  async listByOrganisationId(id: string) {
    const organisationId = requireSafeString(id, "User Id");

    if (isReadFromPostgres()) {
      const mappings = await prisma.userOrganization.findMany({
        where: {
          organizationReference: {
            in: [organisationId, `Organization/${organisationId}`],
          },
        },
        select: {
          id: true,
          fhirId: true,
          practitionerReference: true,
          organizationReference: true,
          roleCode: true,
          roleDisplay: true,
          active: true,
          extraPermissions: true,
          revokedPermissions: true,
          effectivePermissions: true,
        },
      });

      if (!mappings.length) {
        return [];
      }

      const results = [];
      for (const mapping of mappings) {
        const userRef = mapping.practitionerReference;
        const userId =
          extractReferenceId(userRef) ?? mapping.practitionerReference;

        const [user, userProfile, speciality, currentStatus, weeklyHours] =
          await Promise.all([
            prisma.user.findFirst({ where: { userId } }),
            prisma.userProfile.findFirst({ where: { userId } }),
            prisma.speciality.findMany({
              where: {
                organisationId,
                OR: [
                  { memberUserIds: { has: userRef } },
                  { headUserId: userRef },
                ],
              },
            }),
            AvailabilityService.getCurrentStatus(organisationId, userId),
            AvailabilityService.getWeeklyWorkingHours(
              organisationId,
              userId,
              new Date(),
            ),
          ]);

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const count = await prisma.occupancy.count({
          where: {
            organisationId,
            sourceType: "APPOINTMENT",
            startTime: { gte: startOfDay, lte: endOfDay },
          },
        });

        let name = "";
        if (user?.firstName) name += user.firstName;
        if (user?.lastName) name += ` ${user.lastName}`;

        const personalDetails = userProfile?.personalDetails as
          | { profilePictureUrl?: string }
          | undefined;

        const result = {
          userOrganisation: toUserOrganizationResponseDTO(
            buildUserOrganizationDomainFromPrisma(mapping),
          ),
          name,
          profileUrl: personalDetails?.profilePictureUrl,
          speciality,
          currentStatus,
          weeklyHours,
          count,
        };

        results.push(result);
      }

      return results;
    }

    const mappings = await UserOrganizationModel.find(
      {
        organizationReference: organisationId,
      },
      {
        practitionerReference: 1,
        organizationReference: 1,
        roleCode: 1,
        effectivePermissions: 1,
      },
    );

    if (!mappings.length) {
      return [];
    }

    const results = [];
    for (const mapping of mappings) {
      const userRef = mapping.practitionerReference;
      const user = await UserModel.findOne({ userId: userRef });
      const userProfile = await UserProfileModel.findOne({
        userId: userRef,
      });

      const speciality = await SpecialityModel.find({
        organisationId,
        $or: [
          { memberUserIds: userRef }, // matches any element in the array
          { headUserId: userRef },
        ],
      });

      const currentStatus = await AvailabilityService.getCurrentStatus(
        organisationId,
        userRef,
      );
      const weeklyHours = await AvailabilityService.getWeeklyWorkingHours(
        organisationId,
        userRef,
        new Date(),
      );

      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date();
      endOfDay.setHours(23, 59, 59, 999);

      const count = await OccupancyModel.countDocuments({
        organisationId, // required
        sourceType: "APPOINTMENT", // filter appointment only
        startTime: { $gte: startOfDay, $lte: endOfDay },
      });

      let name: string = "";
      if (user?.firstName) name += user.firstName;
      if (user?.lastName) name += " " + user.lastName;
      const result = {
        userOrganisation: toUserOrganizationResponseDTO(mapping),
        name,
        profileUrl: userProfile?.personalDetails?.profilePictureUrl,
        speciality: speciality,
        currentStatus,
        weeklyHours,
        count,
      };

      results.push(result);
    }

    return results;
  },

  async recomputeAllEffectivePermissions() {
    const cursor = UserOrganizationModel.find({})
      .select({
        roleCode: 1,
        extraPermissions: 1,
        revokedPermissions: 1,
        effectivePermissions: 1,
      })
      .cursor();

    let scannedCount = 0;
    let updatedCount = 0;

    for await (const doc of cursor) {
      scannedCount += 1;
      const computed = computeEffectivePermissions(
        doc.roleCode as RoleCode,
        doc.extraPermissions,
        doc.revokedPermissions,
      );
      const current = doc.effectivePermissions ?? [];
      const same =
        current.length === computed.length &&
        computed.every((perm) => current.includes(perm));
      if (!same) {
        await UserOrganizationModel.updateOne(
          { _id: doc._id },
          { $set: { effectivePermissions: computed } },
        );
        updatedCount += 1;
      }
    }

    return { scannedCount, updatedCount };
  },
};
