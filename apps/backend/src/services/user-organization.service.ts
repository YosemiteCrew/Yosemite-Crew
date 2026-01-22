import { Types } from "mongoose";
import UserOrganizationModel, {
  type UserOrganizationDocument,
  type UserOrganizationMongo,
} from "../models/user-organization";
import OrganizationModel from "../models/organization";
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
): string[] {
  const base = ROLE_PERMISSIONS[role] ?? [];
  const extras = extra ?? [];
  return [...new Set([...base, ...extras])];
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

const ensureOrgUsageCounters = async (orgId: Types.ObjectId) =>
  OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $setOnInsert: { orgId } },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

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
    return true;
  }

  await OrgUsageCounters.findOneAndUpdate(
    { orgId },
    { $inc: { usersActiveCount: 1 } },
    { new: true },
  );
  return true;
};

const releaseMemberSlot = async (orgId: Types.ObjectId) => {
  await OrgUsageCounters.updateOne(
    { orgId },
    { $inc: { usersActiveCount: -1 } },
  );
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

  const effectivePermissions = computeEffectivePermissions(
    roleCode as RoleCode,
    extraPermissions,
  );

  return {
    fhirId: ensureSafeIdentifier(dto.id),
    practitionerReference,
    organizationReference,
    roleCode,
    roleDisplay,
    active: typeof dto.active === "boolean" ? dto.active : true,
    extraPermissions,
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
    effectivePermissions: computeEffectivePermissions(
      rest.roleCode as RoleCode,
      rest.extraPermissions,
    ),
  };
};

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

export const UserOrganizationService = {
  async upsert(payload: UserOrganizationFHIRPayload) {
    const { persistable } = createPersistableFromFHIR(payload);
    validateRoleCode(persistable.roleCode);

    const id = ensureSafeIdentifier(payload.id ?? persistable.fhirId);
    let document: UserOrganizationDocument | null = null;
    let created = false;

    let orgObjectId: Types.ObjectId | null = null;
    let seatDelta: -1 | 0 | 1 = 0;

    if (id) {
      document = await UserOrganizationModel.findOne(
        resolveStrictIdQuery(id, "identifier"),
      );
    }

    const wasActive = document?.active ?? false;
    const willBeActive = persistable.active !== false;

    if (!document) {
      if (willBeActive) {
        orgObjectId = await resolveOrganisationObjectId(
          persistable.organizationReference,
        );
        await reserveMemberSlot(orgObjectId);
        seatDelta = 1;
      }

      try {
        document = await UserOrganizationModel.create(persistable);
        created = true;
      } catch (err) {
        if (seatDelta === 1 && orgObjectId) {
          await releaseMemberSlot(orgObjectId);
        }
        throw err;
      }
    } else {
      // Existing document — detect state transitions
      orgObjectId = await resolveOrganisationObjectId(
        document.organizationReference,
      );

      if (!wasActive && willBeActive) {
        await reserveMemberSlot(orgObjectId);
        seatDelta = 1;
      }

      if (wasActive && !willBeActive) {
        await releaseMemberSlot(orgObjectId);
        seatDelta = -1;
      }

      document = await UserOrganizationModel.findOneAndUpdate(
        { _id: document._id },
        { $set: persistable },
        { new: true, sanitizeFilter: true },
      );
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

    return toUserOrganizationResponseDTO(buildUserOrganizationDomain(document));
  },

  async getById(
    id: string,
  ): Promise<
    UserOrganizationResponseDTO | UserOrganizationResponseDTO[] | null
  > {
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
    const priorPermissions = [...(existing.effectivePermissions ?? [])].sort();

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

    const nextPermissions = [...(document.effectivePermissions ?? [])].sort();
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
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireSafeString(organisationId, "Organization Identifier");

    await UserOrganizationModel.deleteMany({
      organizationReference: orgId,
    }).exec();
  },

  async listByUserId(id: string) {
    const userId = requireSafeString(id, "User Id");
    const mappings = await UserOrganizationModel.find({
      practitionerReference: userId,
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
        memberUserIds: userRef, // matches any element in the array
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
};
