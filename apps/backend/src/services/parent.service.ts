import {
  fromParentRequestDTO,
  toParentResponseDTO,
  type ParentRequestDTO,
  type Parent,
} from "@yosemite-crew/types";
import { ParentCreatedFrom, Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import { AuthUserMobileService } from "./authUserMobile.service";
import { buildS3Key, moveFile } from "src/middlewares/upload";
import logger from "src/utils/logger";
import escapeStringRegexp from "escape-string-regexp";

export class ParentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ParentServiceError";
  }
}

type ParentAddressInput = {
  addressLine?: string | null;
  country?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type ParentRecord = {
  id: string;
  firstName: string;
  lastName: string | null;
  birthDate: Date | null;
  email: string;
  phoneNumber: string | null;
  currency: string | null;
  timezone: string | null;
  profileImageUrl: string | null;
  isProfileComplete: boolean;
  linkedUserId: string | null;
  createdFrom: ParentCreatedFrom;
  alerts?: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  address?: {
    addressLine: string | null;
    country: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
};

type ParentToFHIRSource = {
  toObject?: () => ParentToFHIRSource;
  id?: string;
  _id?: { toString(): string };
  firstName?: string;
  lastName?: string | null;
  birthDate?: Date | null;
  email?: string;
  phoneNumber?: string | null;
  currency?: string | null;
  timezone?: string | null;
  profileImageUrl?: string | null;
  isProfileComplete?: boolean;
  linkedUserId?: string | { toString(): string } | null;
  createdFrom?: string;
  alerts?: Prisma.JsonValue | null;
  createdAt?: Date;
  updatedAt?: Date;
  address?: {
    addressLine?: string | null;
    country?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
};

const isValidOffsetTimezone = (value: string): boolean => {
  const trimmed = value.trim();
  const withPrefix = trimmed.startsWith("UTC") ? trimmed.slice(3) : trimmed;
  if (!withPrefix) return false;

  const sign = withPrefix[0];
  if (sign !== "+" && sign !== "-") return false;

  const timePart = withPrefix.slice(1);
  const colonIndex = timePart.indexOf(":");
  if (colonIndex === -1) return false;

  const hoursText = timePart.slice(0, colonIndex);
  const minutesText = timePart.slice(colonIndex + 1);
  if (!hoursText || !minutesText) return false;
  if (hoursText.length > 2 || minutesText.length !== 2) return false;

  const hours = Number(hoursText);
  const minutes = Number(minutesText);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return false;
  if (hours < 0 || hours > 23) return false;
  if (minutes < 0 || minutes > 59) return false;

  return true;
};

const parseCombinedTimezone = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed.startsWith("UTC")) return null;

  const sepIndex = trimmed.indexOf("-");
  if (sepIndex === -1) return null;

  const offsetPart = trimmed.slice(0, sepIndex).trimEnd();
  if (!isValidOffsetTimezone(offsetPart)) return null;

  const remainder = trimmed.slice(sepIndex + 1).trim();
  return remainder || null;
};

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

  if (isValidOffsetTimezone(value)) {
    return true;
  }

  return isValidIanaTimezone(value);
};

const validateTimezone = (value: string, field: string): string => {
  const trimmed = value.trim();

  const combinedCandidate = parseCombinedTimezone(trimmed);
  let normalized = trimmed;
  if (combinedCandidate && isValidIanaTimezone(combinedCandidate)) {
    normalized = combinedCandidate;
  }

  if (!normalized) {
    throw new ParentServiceError(`${field} cannot be empty.`, 400);
  }

  if (!isValidTimezone(normalized)) {
    throw new ParentServiceError(
      `${field} must be a valid IANA timezone or UTC offset.`,
      400,
    );
  }

  return normalized;
};

const hasAddressData = (address?: ParentAddressInput | null) =>
  Boolean(
    address &&
    Object.values(address).some(
      (value) => value !== undefined && value !== null && value !== "",
    ),
  );

const normalizeAlerts = (alerts: unknown): Parent["alerts"] | undefined => {
  if (!Array.isArray(alerts)) {
    return undefined;
  }

  return alerts as Parent["alerts"];
};

const buildParentResponse = (doc: ParentRecord): Parent => ({
  id: doc.id,
  firstName: doc.firstName,
  lastName: doc.lastName ?? undefined,
  birthDate: doc.birthDate ?? undefined,
  email: doc.email,
  phoneNumber: doc.phoneNumber ?? undefined,
  currency: doc.currency ?? undefined,
  timezone: doc.timezone ?? undefined,
  profileImageUrl: doc.profileImageUrl ?? undefined,
  isProfileComplete: doc.isProfileComplete ?? false,
  linkedUserId: doc.linkedUserId ?? null,
  createdFrom: doc.createdFrom,
  address: doc.address
    ? {
        addressLine: doc.address.addressLine ?? undefined,
        country: doc.address.country ?? undefined,
        city: doc.address.city ?? undefined,
        state: doc.address.state ?? undefined,
        postalCode: doc.address.postalCode ?? undefined,
        latitude: doc.address.latitude ?? undefined,
        longitude: doc.address.longitude ?? undefined,
      }
    : {},
  alerts: normalizeAlerts(doc.alerts),
  createdAt: doc.createdAt,
  updatedAt: doc.updatedAt,
});

export const toFHIR = (doc: ParentToFHIRSource) => {
  const json = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return toParentResponseDTO(
    buildParentResponse({
      id: String(json.id ?? json._id?.toString() ?? ""),
      firstName: json.firstName ?? "",
      lastName: json.lastName ?? null,
      birthDate: json.birthDate ?? null,
      email: json.email ?? "",
      phoneNumber: json.phoneNumber ?? null,
      currency: json.currency ?? null,
      timezone: json.timezone ?? null,
      profileImageUrl: json.profileImageUrl ?? null,
      isProfileComplete: Boolean(json.isProfileComplete),
      linkedUserId:
        typeof json.linkedUserId === "string"
          ? json.linkedUserId
          : (json.linkedUserId?.toString?.() ?? null),
      createdFrom: (json.createdFrom ?? "pms") as ParentCreatedFrom,
      alerts: json.alerts ?? undefined,
      createdAt: json.createdAt ?? new Date(),
      updatedAt: json.updatedAt ?? new Date(),
      address: json.address
        ? {
            addressLine: json.address.addressLine ?? null,
            country: json.address.country ?? null,
            city: json.address.city ?? null,
            state: json.address.state ?? null,
            postalCode: json.address.postalCode ?? null,
            latitude: json.address.latitude ?? null,
            longitude: json.address.longitude ?? null,
          }
        : undefined,
    }),
  );
};

export const toFHIRFromPrisma = (doc: ParentRecord) =>
  toParentResponseDTO(buildParentResponse(doc));

const getParentIdForAuthUser = async (authUserId: string) => {
  const authUser = await prisma.authUserMobile.findFirst({
    where: { providerUserId: authUserId },
    select: { parentId: true },
  });
  return authUser?.parentId ?? null;
};

const computeProfileCompletion = (p: {
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  birthDate?: Date | null;
  address?: ParentAddressInput | null;
}) =>
  Boolean(
    p.firstName &&
    p.lastName &&
    p.email &&
    p.phoneNumber &&
    p.birthDate &&
    p.address,
  );

const buildAddressFields = (address: ParentAddressInput) => ({
  addressLine: address.addressLine ?? undefined,
  country: address.country ?? undefined,
  city: address.city ?? undefined,
  state: address.state ?? undefined,
  postalCode: address.postalCode ?? undefined,
  latitude: address.latitude ?? undefined,
  longitude: address.longitude ?? undefined,
});

const upsertParentAddress = async (
  parentId: string,
  address: ParentAddressInput,
) => {
  await prisma.parentAddress.upsert({
    where: { parentId },
    create: {
      parentId,
      ...buildAddressFields(address),
    },
    update: buildAddressFields(address),
  });
};

const deleteParentAddress = async (parentId: string) => {
  await prisma.parentAddress.deleteMany({ where: { parentId } });
};

export type ParentCreateContext = {
  source: "mobile" | "pms" | "invited";
  authUserId?: string;
  /** Acting organisation + user for audit scoping (PMS edits). Optional: when absent,
   *  the alert-mutation audit is skipped (the request still succeeds). */
  organisationId?: string;
  actorId?: string;
};

const resolveParentRecord = async (id: string) =>
  prisma.parent.findUnique({
    where: { id },
    include: { address: true },
  });

const resolveParentLinkedUserId = async (
  source: ParentCreateContext["source"],
  authUserId: string | undefined,
) => {
  if (source !== "mobile") {
    return null;
  }

  if (!authUserId) {
    throw new ParentServiceError("Authenticated user ID required.", 401);
  }

  const linkedUserId =
    await AuthUserMobileService.getAuthUserMobileIdByProviderId(authUserId);
  if (!linkedUserId) {
    throw new ParentServiceError("Authenticated user not found.", 404);
  }

  return linkedUserId;
};

const resolveParentExistingByLinkedUser = async (
  linkedUserId: string | null,
) => {
  if (!linkedUserId) {
    return null;
  }

  return prisma.parent.findFirst({
    where: { linkedUserId },
    select: { id: true },
  });
};

const maybeSyncParentProfileImage = async (
  parentId: string,
  profileImageUrl: string | undefined,
) => {
  if (!profileImageUrl) {
    return;
  }

  try {
    const finalKey = buildS3Key("parent", parentId, "image/jpg");
    const uploadedUrl = await moveFile(profileImageUrl, finalKey);
    await prisma.parent.update({
      where: { id: parentId },
      data: { profileImageUrl: uploadedUrl },
    });
  } catch (error) {
    logger.warn("Invalid key has been sent", error);
  }
};

export const ParentService = {
  toFHIR,
  toFHIRFromPrisma,

  async create(dto: ParentRequestDTO, ctx: ParentCreateContext) {
    const parent = fromParentRequestDTO(dto);
    parent.createdFrom = ctx.source;

    if (parent.timezone) {
      parent.timezone = validateTimezone(parent.timezone, "Timezone");
    }

    parent.linkedUserId = await resolveParentLinkedUserId(
      ctx.source,
      ctx.authUserId,
    );

    const existing = await resolveParentExistingByLinkedUser(
      parent.linkedUserId,
    );
    if (existing) {
      throw new ParentServiceError("Parent already exists for this user.", 409);
    }

    const created = await prisma.parent.create({
      data: {
        firstName: parent.firstName,
        lastName: parent.lastName ?? undefined,
        birthDate: parent.birthDate ?? undefined,
        email: parent.email.toLowerCase(),
        phoneNumber: parent.phoneNumber ?? undefined,
        currency: parent.currency ?? undefined,
        timezone: parent.timezone ?? undefined,
        profileImageUrl: parent.profileImageUrl ?? undefined,
        isProfileComplete: false,
        linkedUserId: parent.linkedUserId ?? undefined,
        createdFrom: parent.createdFrom as ParentCreatedFrom,
        alerts: (parent as Parent & { alerts?: Parent["alerts"] }).alerts as
          | Prisma.InputJsonValue
          | undefined,
      },
    });

    if (hasAddressData(parent.address)) {
      await upsertParentAddress(created.id, parent.address);
    }

    const refreshed = await resolveParentRecord(created.id);
    if (!refreshed) {
      throw new ParentServiceError("Parent creation failed.", 500);
    }

    const profileComplete = computeProfileCompletion({
      firstName: refreshed.firstName,
      lastName: refreshed.lastName,
      email: refreshed.email,
      phoneNumber: refreshed.phoneNumber,
      birthDate: refreshed.birthDate,
      address: refreshed.address,
    });

    if (refreshed.isProfileComplete !== profileComplete) {
      await prisma.parent.update({
        where: { id: created.id },
        data: { isProfileComplete: profileComplete },
        include: { address: true },
      });
    }

    await maybeSyncParentProfileImage(created.id, parent.profileImageUrl);

    if (ctx.source === "mobile" && ctx.authUserId) {
      await AuthUserMobileService.linkParent(ctx.authUserId, created.id);
    }

    const latest = await resolveParentRecord(created.id);
    if (!latest) {
      throw new ParentServiceError("Parent creation failed.", 500);
    }

    return {
      response: toParentResponseDTO(
        buildParentResponse({
          ...latest,
          alerts: latest.alerts ?? undefined,
        }),
      ),
      isProfileComplete: latest.isProfileComplete ?? false,
    };
  },

  async get(id: string, ctx?: ParentCreateContext) {
    if (ctx?.source === "mobile" && ctx?.authUserId) {
      const parentId = await getParentIdForAuthUser(ctx.authUserId);
      if (!parentId || parentId !== id) {
        return null;
      }
    }

    const doc = await resolveParentRecord(id);
    if (!doc) return null;

    return {
      response: toParentResponseDTO(buildParentResponse(doc)),
      isProfileComplete: doc.isProfileComplete ?? false,
    };
  },

  async update(id: string, dto: ParentRequestDTO, ctx?: ParentCreateContext) {
    if (ctx?.source === "mobile" && ctx.authUserId) {
      const parentId = await getParentIdForAuthUser(ctx.authUserId);
      if (!parentId || parentId !== id) {
        return null;
      }
    }

    const parent = fromParentRequestDTO(dto);
    if (parent.timezone) {
      parent.timezone = validateTimezone(parent.timezone, "Timezone");
    }

    // Capture the prior alert set so an alert change can be audited (created/updated/deleted).
    const beforeUpdate = await prisma.parent.findUnique({
      where: { id },
      select: { alerts: true },
    });

    await prisma.parent.update({
      where: { id },
      data: {
        firstName: parent.firstName,
        lastName: parent.lastName ?? undefined,
        birthDate: parent.birthDate ?? undefined,
        email: parent.email.toLowerCase(),
        phoneNumber: parent.phoneNumber ?? undefined,
        currency: parent.currency ?? undefined,
        timezone: parent.timezone ?? undefined,
        profileImageUrl: parent.profileImageUrl ?? undefined,
        isProfileComplete: false,
        createdFrom: parent.createdFrom as ParentCreatedFrom | undefined,
        // Only the PMS path manages client alerts: it sends the full alert set, so an
        // absent/empty set there means "cleared" (JsonNull, since Prisma treats undefined
        // as "leave unchanged"). Mobile self-service updates never carry alerts, so the
        // column is left untouched for them to avoid wiping vet/PMS-set client alerts.
        ...(ctx?.source === "pms"
          ? {
              alerts:
                ((parent as Parent & { alerts?: Parent["alerts"] }).alerts as
                  | Prisma.InputJsonValue
                  | undefined) ?? Prisma.JsonNull,
            }
          : {}),
      },
    });

    if (hasAddressData(parent.address)) {
      await upsertParentAddress(id, parent.address);
    }

    // Audit client (parent) alert mutations. No-ops when alerts are unchanged or no org
    // context is available, so a plain profile update is never spuriously audited.
    await AuditTrailService.recordAlertMutation({
      entity: "PARENT",
      organisationId: ctx?.organisationId,
      patientId: id,
      actorId: ctx?.actorId,
      previousAlerts: beforeUpdate?.alerts,
      nextAlerts: (parent as Parent & { alerts?: unknown }).alerts,
    });

    const refreshed = await resolveParentRecord(id);
    if (!refreshed) {
      return null;
    }

    const profileComplete = computeProfileCompletion({
      firstName: refreshed.firstName,
      lastName: refreshed.lastName,
      email: refreshed.email,
      phoneNumber: refreshed.phoneNumber,
      birthDate: refreshed.birthDate,
      address: refreshed.address,
    });

    if (refreshed.isProfileComplete !== profileComplete) {
      await prisma.parent.update({
        where: { id },
        data: { isProfileComplete: profileComplete },
      });
    }

    const latest = (await resolveParentRecord(id)) ?? refreshed;

    return {
      response: toParentResponseDTO(
        buildParentResponse({
          ...latest,
          isProfileComplete: profileComplete,
          alerts: latest.alerts ?? undefined,
        }),
      ),
      isProfileComplete: profileComplete,
    };
  },

  async delete(id: string, ctx: ParentCreateContext) {
    if (ctx.source === "mobile") {
      if (!ctx.authUserId) {
        throw new ParentServiceError("Authenticated user ID required.", 401);
      }
      const parentId = await getParentIdForAuthUser(ctx.authUserId);
      if (!parentId || parentId !== id) {
        return null;
      }
    }

    const existing = await resolveParentRecord(id);
    if (!existing) return null;

    await prisma.parentPatient.deleteMany({ where: { parentId: id } });
    await prisma.authUserMobile.updateMany({
      where: { parentId: id },
      data: { parentId: null },
    });
    await deleteParentAddress(id);
    await prisma.parent.deleteMany({ where: { id } });

    return toParentResponseDTO(buildParentResponse(existing));
  },

  async findByLinkedUserId(authUserId: string) {
    if (!authUserId) {
      throw new ParentServiceError("Invalid AuthUser ID.", 400);
    }

    const parentId = await getParentIdForAuthUser(authUserId);
    if (!parentId) return null;

    return resolveParentRecord(parentId);
  },

  async findByMongoId(id: string) {
    return resolveParentRecord(id);
  },

  async getByName(name: string) {
    if (!name || typeof name !== "string") {
      throw new ParentServiceError("Name is required for searching.", 400);
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new ParentServiceError("Name is required for searching.", 400);
    }

    const safe = escapeStringRegexp(trimmed);

    const docs = await prisma.parent.findMany({
      where: {
        OR: [
          { firstName: { contains: safe, mode: "insensitive" } },
          { lastName: { contains: safe, mode: "insensitive" } },
          { email: { contains: safe, mode: "insensitive" } },
        ],
      },
      include: { address: true },
    });

    return {
      responses: docs.map((doc) =>
        toParentResponseDTO(buildParentResponse(doc as ParentRecord)),
      ),
    };
  },
};
