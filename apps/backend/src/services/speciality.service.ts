import { type SpecialityMongo } from "../models/speciality";
import {
  fromSpecialityRequestDTO,
  toSpecialityResponseDTO,
  type SpecialityDTOAttributes,
  type SpecialityRequestDTO,
  type SpecialityResponseDTO,
} from "@yosemite-crew/types";
import { ServiceService } from "./service.service";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import { prisma } from "src/config/prisma";

export type SpecialityFHIRPayload = SpecialityRequestDTO;

export class SpecialityServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "SpecialityServiceError";
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

const buildDisplayName = (
  user?: { firstName?: string; lastName?: string } | null,
) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

const getOrganisationName = async (organisationId?: string) => {
  if (!organisationId) return undefined;
  const organisation = await prisma.organization.findFirst({
    where: { OR: [{ id: organisationId }, { fhirId: organisationId }] },
    select: { name: true },
  });
  return organisation?.name;
};

const sendSpecialityHeadAssignmentEmail = async (params: {
  headUserId?: string;
  specialityName: string;
  organisationId?: string;
}) => {
  if (!params.headUserId) return;

  try {
    const user = await prisma.user.findFirst({
      where: { userId: params.headUserId },
      select: { email: true, firstName: true, lastName: true },
    });
    const organisationName = await getOrganisationName(params.organisationId);

    if (!user?.email) return;

    await sendEmailTemplate({
      to: user.email,
      templateId: "specialityHeadAssigned",
      templateData: {
        employeeName: buildDisplayName({
          firstName: user.firstName ?? undefined,
          lastName: user.lastName ?? undefined,
        }),
        specialityName: params.specialityName,
        organisationName,
        ctaUrl: DEFAULT_PMS_URL,
        ctaLabel: "Open PMS",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send speciality head assignment email.", error);
  }
};

const pruneUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) {
    const cleaned = (value as unknown[])
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
    throw new SpecialityServiceError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new SpecialityServiceError(`${fieldName} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new SpecialityServiceError(`${fieldName} cannot be empty.`, 400);
  }

  if (trimmed.includes("$")) {
    throw new SpecialityServiceError(`Invalid character in ${fieldName}.`, 400);
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
    throw new SpecialityServiceError(`${fieldName} must be a string.`, 400);
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return undefined;
  }

  if (trimmed.includes("$")) {
    throw new SpecialityServiceError(`Invalid character in ${fieldName}.`, 400);
  }

  return trimmed;
};

const ensureSafeIdentifier = (value: unknown): string | undefined => {
  return optionalSafeString(value, "Identifier");
};

const requireOrganizationId = (value: unknown): string => {
  return requireSafeString(value, "Organisation identifier");
};

const sanitizeServices = (services: unknown): string[] | undefined => {
  if (!Array.isArray(services)) {
    return undefined;
  }

  const cleaned = services
    .map((service, index) => {
      const value = optionalSafeString(service, `Service at index ${index}`);
      return value ?? undefined;
    })
    .filter((service): service is string => service !== undefined);

  return cleaned.length ? cleaned : undefined;
};

const sanitizeTeamMembers = (teamMemberIds: unknown): string[] | undefined => {
  if (!Array.isArray(teamMemberIds)) {
    return undefined;
  }

  const cleaned = teamMemberIds
    .map((memberUserId, index) => {
      const value = optionalSafeString(
        memberUserId,
        `Team member identifier at index ${index}`,
      );
      return value ?? undefined;
    })
    .filter(
      (memberUserId): memberUserId is string => memberUserId !== undefined,
    );

  return cleaned.length ? Array.from(new Set(cleaned)) : undefined;
};

const sanitizeSpecialityAttributes = (
  dto: SpecialityDTOAttributes,
): SpecialityMongo => {
  const organisationId = requireOrganizationId(dto.organisationId);
  const name = requireSafeString(dto.name, "Speciality name");

  return {
    fhirId: ensureSafeIdentifier(dto.id),
    organisationId,
    departmentMasterId: optionalSafeString(
      dto.departmentMasterId,
      "Department master identifier",
    ),
    name,

    headUserId: optionalSafeString(dto.headUserId, "Head user identifier"),
    headName: optionalSafeString(dto.headName, "Head name"),
    headProfilePicUrl: optionalSafeString(
      dto.headProfilePicUrl,
      "Head profile picture URL",
    ),
    memberUserIds: sanitizeTeamMembers(dto.teamMemberIds),
    services: sanitizeServices(dto.services),
    createdAt: dto.createdAt instanceof Date ? dto.createdAt : undefined,
    updatedAt: dto.updatedAt instanceof Date ? dto.updatedAt : undefined,
  };
};

const buildFHIRResponseFromPrisma = (speciality: {
  id: string;
  fhirId: string | null;
  organisationId: string;
  departmentMasterId: string | null;
  name: string;
  description: string | null;
  headUserId: string | null;
  headName: string | null;
  headProfilePicUrl: string | null;
  services: string[];
  memberUserIds: string[];
  createdAt: Date;
  updatedAt: Date;
}): SpecialityResponseDTO => {
  const teamMemberIds = Array.from(
    new Set([
      ...(speciality.memberUserIds ?? []),
      ...(speciality.headUserId ? [speciality.headUserId] : []),
    ]),
  );

  return toSpecialityResponseDTO({
    _id: speciality.fhirId ?? speciality.id,
    organisationId: speciality.organisationId,
    departmentMasterId: speciality.departmentMasterId ?? undefined,
    name: speciality.name,
    headUserId: speciality.headUserId ?? undefined,
    headName: speciality.headName ?? undefined,
    headProfilePicUrl: speciality.headProfilePicUrl ?? undefined,
    services: speciality.services ?? [],
    teamMemberIds,
    createdAt: speciality.createdAt,
    updatedAt: speciality.updatedAt,
  });
};

const createPersistableFromFHIR = (payload: SpecialityFHIRPayload) => {
  if (payload?.resourceType !== "Organization") {
    throw new SpecialityServiceError(
      "Invalid payload. Expected FHIR Organization resource.",
      400,
    );
  }

  const attributes = fromSpecialityRequestDTO(payload);
  const persistable = pruneUndefined(sanitizeSpecialityAttributes(attributes));

  return { attributes, persistable };
};

const resolveSpecialityIdentifier = (id: unknown): string => {
  const identifier = optionalSafeString(id, "Speciality identifier");

  if (!identifier) {
    throw new SpecialityServiceError("Speciality identifier is required.", 400);
  }

  return identifier;
};

const toPrismaSpecialityData = (persistable: SpecialityMongo) => ({
  fhirId: persistable.fhirId ?? undefined,
  organisationId: persistable.organisationId,
  departmentMasterId: persistable.departmentMasterId ?? undefined,
  name: persistable.name,
  description: persistable.description ?? undefined,
  headUserId: persistable.headUserId ?? undefined,
  headName: persistable.headName ?? undefined,
  headProfilePicUrl: persistable.headProfilePicUrl ?? undefined,
  services: persistable.services ?? undefined,
  memberUserIds: persistable.memberUserIds ?? undefined,
  createdAt: persistable.createdAt ?? undefined,
  updatedAt: persistable.updatedAt ?? undefined,
});

export const SpecialityService = {
  async createOne(payload: SpecialityFHIRPayload) {
    const { persistable, attributes } = createPersistableFromFHIR(payload);

    const identifier =
      ensureSafeIdentifier(attributes.id) ?? ensureSafeIdentifier(payload.id);

    const data = toPrismaSpecialityData(persistable);

    let existing: { id: string; headUserId: string | null } | null = null;

    if (identifier) {
      existing = await prisma.speciality.findFirst({
        where: { fhirId: identifier },
        select: { id: true, headUserId: true },
      });
    }

    const created = !existing;

    const speciality = existing
      ? await prisma.speciality.update({ where: { id: existing.id }, data })
      : await prisma.speciality.create({ data });

    const previousHeadUserId = existing?.headUserId ?? undefined;

    if (speciality.headUserId && speciality.headUserId !== previousHeadUserId) {
      void sendSpecialityHeadAssignmentEmail({
        headUserId: speciality.headUserId,
        specialityName: speciality.name,
        organisationId: speciality.organisationId,
      });
    }

    const response = buildFHIRResponseFromPrisma(speciality);
    return { response, created };
  },

  async createMany(payloads: SpecialityFHIRPayload[]) {
    if (!Array.isArray(payloads) || !payloads.length) {
      throw new SpecialityServiceError("Payload list cannot be empty.", 400);
    }

    const results: SpecialityResponseDTO[] = [];

    for (const payload of payloads) {
      const { response } = await SpecialityService.createOne(payload);
      results.push(response);
    }

    return results;
  },

  async update(id: string, payload: SpecialityFHIRPayload) {
    const identifier = resolveSpecialityIdentifier(id);
    const { persistable } = createPersistableFromFHIR(payload);

    const existing = await prisma.speciality.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
      select: { id: true, headUserId: true },
    });

    if (!existing) {
      return null;
    }

    const speciality = await prisma.speciality.update({
      where: { id: existing.id },
      data: toPrismaSpecialityData(persistable),
    });

    if (
      speciality.headUserId &&
      speciality.headUserId !== existing.headUserId
    ) {
      void sendSpecialityHeadAssignmentEmail({
        headUserId: speciality.headUserId,
        specialityName: speciality.name,
        organisationId: speciality.organisationId,
      });
    }

    return buildFHIRResponseFromPrisma(speciality);
  },

  async getById(id: string) {
    const identifier = resolveSpecialityIdentifier(id);

    const speciality = await prisma.speciality.findFirst({
      where: { OR: [{ id: identifier }, { fhirId: identifier }] },
    });

    if (!speciality) {
      return null;
    }

    return buildFHIRResponseFromPrisma(speciality);
  },

  async getAllByOrganizationId(organisationId: string) {
    const orgId = requireOrganizationId(organisationId);

    const specialities = await prisma.speciality.findMany({
      where: { organisationId: orgId },
    });

    const result = [];

    for (const speciality of specialities) {
      const specialityFHIR = buildFHIRResponseFromPrisma(speciality);
      const services = await ServiceService.listBySpeciality(
        speciality.fhirId ?? speciality.id,
      );
      result.push({
        speciality: specialityFHIR,
        services,
      });
    }

    return result;
  },

  async deleteAllByOrganizationId(organisationId: string) {
    const orgId = requireOrganizationId(organisationId);

    await prisma.speciality.deleteMany({
      where: { organisationId: orgId },
    });
  },

  async deleteSpeciality(specialityId: string, organisationId: string) {
    const identifier = resolveSpecialityIdentifier(specialityId);
    const orgId = requireOrganizationId(organisationId);

    const speciality = await prisma.speciality.findFirst({
      where: {
        OR: [{ id: identifier }, { fhirId: identifier }],
        organisationId: orgId,
      },
      select: { id: true, fhirId: true },
    });

    if (!speciality) {
      throw new SpecialityServiceError(
        "Speciality not found for the organisation.",
        404,
      );
    }

    await ServiceService.deleteAllBySpecialityId(
      speciality.fhirId ?? speciality.id,
    );

    await prisma.speciality.deleteMany({
      where: { id: speciality.id },
    });

    await prisma.organisationRoomSpeciality.deleteMany({
      where: {
        organisationId: orgId,
        specialityId,
      },
    });
  },
};
