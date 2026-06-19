import { Types } from "mongoose";
import type { UserOrganizationMongo } from "../models/user-organization";
import type { OrganizationMongo } from "../models/organization";
import {
  fromUserOrganizationRequestDTO,
  toUserOrganizationResponseDTO,
  type UserOrganizationRequestDTO,
  type UserOrganizationResponseDTO,
  type UserOrganization,
} from "@yosemite-crew/types";
import { ROLE_PERMISSIONS, RoleCode } from "src/models/role-permission";
import { AvailabilityService } from "./availability.service";
import { StripeService } from "./stripe.service";
import { sendFreePlanLimitReachedEmail } from "src/utils/org-usage-notifications";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";
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
  user?: { firstName?: string | null; lastName?: string | null } | null,
) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

const resolveOrganisationName = async (reference: string) => {
  const orgId = extractOrganizationIdentifier(reference);
  const organisation = await prisma.organization.findFirst({
    where: {
      OR: [{ id: orgId }, { fhirId: orgId }],
    },
    select: { name: true },
  });
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
    const user = await prisma.user.findFirst({
      where: { userId },
      select: { email: true, firstName: true, lastName: true },
    });
    const organisationName = await resolveOrganisationName(
      params.organizationReference,
    );

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

const ensureOrgUsageCounters = async (orgId: string) => {
  return prisma.organizationUsageCounter.upsert({
    where: { orgId },
    create: {
      orgId,
    },
    update: {},
  });
};

const isFreePlan = async (orgId: string) => {
  const billing = await prisma.organizationBilling.findFirst({
    where: { orgId },
    select: { plan: true },
  });
  return !billing || billing.plan === "free";
};

type OrgUsageCountersDoc = {
  id: string;
  orgId: string;
  freeLimitReachedAt?: Date | null;
  usersActiveCount?: number | null;
  usersBillableCount?: number | null;
  appointmentsUsed?: number | null;
  toolsUsed?: number | null;
  freeAppointmentsLimit?: number | null;
  freeToolsLimit?: number | null;
  freeUsersLimit?: number | null;
};

const markFreeLimitReachedAt = async (usage: OrgUsageCountersDoc | null) => {
  if (
    !usage ||
    usage.freeLimitReachedAt ||
    ((usage.usersActiveCount ?? 0) < (usage.freeUsersLimit ?? 0) &&
      (usage.appointmentsUsed ?? 0) < (usage.freeAppointmentsLimit ?? 0) &&
      (usage.toolsUsed ?? 0) < (usage.freeToolsLimit ?? 0))
  ) {
    return false;
  }

  const updated = await prisma.organizationUsageCounter.updateMany({
    where: { id: usage.id, freeLimitReachedAt: null },
    data: { freeLimitReachedAt: new Date() },
  });

  return updated.count > 0;
};

const resolveOrganisationObjectId = async (
  reference: string,
): Promise<string> => {
  const identifier = extractOrganizationIdentifier(reference);
  const organisation = await prisma.organization.findFirst({
    where: {
      OR: [{ id: identifier }, { fhirId: identifier }],
    },
    select: { id: true },
  });

  if (!organisation) {
    throw new UserOrganizationServiceError("Organization not found.", 404);
  }

  return organisation.id;
};

const reserveMemberSlot = async (orgId: string) => {
  await ensureOrgUsageCounters(orgId);

  if (await isFreePlan(orgId)) {
    const current = await prisma.organizationUsageCounter.findUnique({
      where: { orgId },
    });

    if (
      !current ||
      (current.usersActiveCount ?? 0) >= (current.freeUsersLimit ?? 0)
    ) {
      throw new UserOrganizationServiceError(
        "Free plan member limit reached.",
        403,
      );
    }

    const updated = await prisma.organizationUsageCounter.update({
      where: { orgId },
      data: { usersActiveCount: { increment: 1 } },
    });

    const updatedUsage = updated as unknown as OrgUsageCountersDoc;
    const didReachLimit = await markFreeLimitReachedAt(updatedUsage);
    if (didReachLimit) {
      void sendFreePlanLimitReachedEmail({ orgId, usage: updatedUsage });
    }
    return true;
  }

  await prisma.organizationUsageCounter.update({
    where: { orgId },
    data: { usersActiveCount: { increment: 1 } },
  });
  return true;
};

const releaseMemberSlot = async (orgId: string) => {
  await prisma.organizationUsageCounter.update({
    where: { orgId },
    data: { usersActiveCount: { decrement: 1 } },
  });
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
  appointmentCheckInBufferMinutes: number | null;
  appointmentCheckInRadiusMeters: number | null;
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
  appointmentCheckInBufferMinutes: org.appointmentCheckInBufferMinutes ?? 5,
  appointmentCheckInRadiusMeters: org.appointmentCheckInRadiusMeters ?? 200,
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

const syncSeatsIfBusiness = async (orgId: string) => {
  const billing = await prisma.organizationBilling.findFirst({
    where: { orgId },
    select: { plan: true },
  });

  if (billing?.plan === "business") {
    await StripeService.syncSubscriptionSeats(orgId);
  }
};

const findExistingUserOrganization = async (id?: string | null) => {
  if (!id) return null;
  return prisma.userOrganization.findFirst({
    where: { OR: [{ id }, { fhirId: id }] },
  });
};

const handleExistingSeatTransition = async (
  document: PrismaUserOrganizationLite,
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
  orgObjectId: string | null,
) => {
  try {
    const document = await prisma.userOrganization.create({
      data: persistable,
    });
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

    let orgObjectId: string | null = null;
    let seatDelta: -1 | 0 | 1 = 0;
    const willBeActive = persistable.active !== false;

    if (document) {
      // Existing document — detect state transitions
      ({ orgObjectId, seatDelta } = await handleExistingSeatTransition(
        document,
        willBeActive,
      ));

      document = await prisma.userOrganization.update({
        where: { id: document.id },
        data: persistable,
      });
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

    return {
      response: toUserOrganizationResponseDTO(
        buildUserOrganizationDomainFromPrisma(document),
      ),
      created,
    };
  },

  async create(payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    let orgObjectId: string | null = null;

    if (persistable.active !== false) {
      orgObjectId = await resolveOrganisationObjectId(
        persistable.organizationReference,
      );
      await reserveMemberSlot(orgObjectId);
    }

    const document = await prisma.userOrganization.create({
      data: persistable,
    });

    if (orgObjectId) {
      await syncSeatsIfBusiness(orgObjectId);
    }

    return toUserOrganizationResponseDTO(
      buildUserOrganizationDomainFromPrisma(document),
    );
  },

  async getById(
    id: string,
  ): Promise<
    UserOrganizationResponseDTO | UserOrganizationResponseDTO[] | null
  > {
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
  },

  async listAll() {
    const mappings = await prisma.userOrganization.findMany();
    return mappings.map((mapping) =>
      toUserOrganizationResponseDTO(
        buildUserOrganizationDomainFromPrisma(mapping),
      ),
    );
  },

  async deleteById(id: string) {
    const identifier = ensureSafeIdentifier(id);
    if (!identifier) {
      return false;
    }

    const existing = await prisma.userOrganization.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
    });
    if (!existing) {
      return false;
    }

    if (existing.active !== false) {
      const orgId = await resolveOrganisationObjectId(
        existing.organizationReference,
      );
      await releaseMemberSlot(orgId);
      await syncSeatsIfBusiness(orgId);
    }

    await prisma.userOrganization.delete({ where: { id: existing.id } });
    return true;
  },

  async update(id: string, payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    const existing = await prisma.userOrganization.findFirst({
      where: {
        OR: [{ id }, { fhirId: id }],
      },
    });

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

    const document = await prisma.userOrganization.update({
      where: { id: existing.id },
      data: persistable,
    });

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
        roleDisplay: document.roleDisplay ?? undefined,
      });
    }

    return toUserOrganizationResponseDTO(
      buildUserOrganizationDomainFromPrisma(document),
    );
  },

  async createUserOrganizationMapping(userOrganisation: UserOrganization) {
    const persistable = pruneUndefined(
      sanitizeUserOrganizationAttributes(userOrganisation),
    );
    let orgObjectId: string | null = null;
    if (persistable.active !== false) {
      orgObjectId = await resolveOrganisationObjectId(
        persistable.organizationReference,
      );
      await reserveMemberSlot(orgObjectId);
      await syncSeatsIfBusiness(orgObjectId);
    }

    const document = await prisma.userOrganization.create({
      data: persistable,
    });

    if (!document) {
      throw new UserOrganizationServiceError(
        "Unable to create user-organization mapping.",
        500,
      );
    }
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireSafeString(organisationId, "Organization Identifier");

    await prisma.userOrganization.deleteMany({
      where: { organizationReference: orgId },
    });
  },

  async listByUserId(id: string) {
    const userId = requireSafeString(id, "User Id");
    const practitionerReferences = [userId, `Practitioner/${userId}`];

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

      const orgBilling = canViewBilling
        ? await prisma.organizationBilling.findFirst({
            where: { orgId: organization?.id ?? organizationId },
          })
        : null;

      const orgUsage = canViewBilling
        ? await prisma.organizationUsageCounter.findFirst({
            where: { orgId: organization?.id ?? organizationId },
          })
        : null;
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
  },

  async listByOrganisationId(id: string) {
    const organisationId = requireSafeString(id, "User Id");
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

      let name: string = "";
      if (user?.firstName) name += user.firstName;
      if (user?.lastName) name += " " + user.lastName;
      const result = {
        userOrganisation: toUserOrganizationResponseDTO(
          buildUserOrganizationDomainFromPrisma(mapping),
        ),
        name,
        profileUrl: (
          userProfile?.personalDetails as { profilePictureUrl?: string } | null
        )?.profilePictureUrl,
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
    const documents = await prisma.userOrganization.findMany({
      select: {
        id: true,
        roleCode: true,
        extraPermissions: true,
        revokedPermissions: true,
        effectivePermissions: true,
      },
    });

    let scannedCount = 0;
    let updatedCount = 0;

    for (const doc of documents) {
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
        await prisma.userOrganization.update({
          where: { id: doc.id },
          data: { effectivePermissions: computed },
        });
        updatedCount += 1;
      }
    }

    return { scannedCount, updatedCount };
  },
};
