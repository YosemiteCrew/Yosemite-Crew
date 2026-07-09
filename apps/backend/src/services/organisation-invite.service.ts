import validator from "validator";

import { type CreateOrganisationInviteInput } from "../models/organisationInvite";
import { type OrganizationMongo } from "../models/organization";
import { type SpecialityDocument } from "../models/speciality";
import logger from "../utils/logger";
import type { OrganisationInvite } from "@yosemite-crew/types";
import {
  OrganisationInviteEmploymentType,
  type OrganisationInvite as PrismaOrganisationInvite,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
} from "./user-organization.service";
import { sendEmailTemplate } from "../utils/email";
import { randomBytes } from "node:crypto";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9\-.]{1,64}$/;
const DEFAULT_ACCEPT_URL = "https://app.yosemitecrew.com/invite";
const ACCEPT_INVITE_BASE_URL =
  process.env.ORG_INVITE_ACCEPT_BASE_URL ??
  process.env.INVITE_ACCEPT_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  DEFAULT_ACCEPT_URL;
const DECLINE_INVITE_BASE_URL =
  process.env.ORG_INVITE_DECLINE_BASE_URL ??
  process.env.INVITE_DECLINE_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  DEFAULT_ACCEPT_URL;
const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const INVITE_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days
const INVITE_TOKEN_BYTES = 32;

type OrganisationIdentity = Pick<OrganizationMongo, "name" | "type"> & {
  _id: string;
};

type DepartmentIdentity = Pick<SpecialityDocument, "_id">;

export class OrganisationInviteServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "OrganisationInviteServiceError";
  }
}

export type CreateInvitePayload = Omit<
  CreateOrganisationInviteInput,
  "organisationId"
> & {
  organisationId: string;
};

export interface AcceptInvitePayload {
  token: string;
  userId: string;
  userEmail: string;
}

export type OrganisationInviteResponse = Partial<OrganisationInvite> & {
  _id: string;
};

const requireString = (value: unknown, fieldName: string): string => {
  if (value == null) {
    throw new OrganisationInviteServiceError(`${fieldName} is required.`, 400);
  }

  if (typeof value !== "string") {
    throw new OrganisationInviteServiceError(
      `${fieldName} must be a string.`,
      400,
    );
  }

  const trimmed = value.trim();

  if (!trimmed) {
    throw new OrganisationInviteServiceError(
      `${fieldName} cannot be empty.`,
      400,
    );
  }

  if (trimmed.includes("$")) {
    throw new OrganisationInviteServiceError(
      `Invalid character in ${fieldName}.`,
      400,
    );
  }

  return trimmed;
};

const normalizeIdentifier = (value: unknown, fieldName: string): string => {
  const identifier = requireString(value, fieldName);

  if (!IDENTIFIER_PATTERN.test(identifier)) {
    throw new OrganisationInviteServiceError(
      `Invalid ${fieldName.toLowerCase()} format.`,
      400,
    );
  }

  return identifier;
};

const normalizeEmail = (value: unknown): string => {
  const email = requireString(value, "Invitee email").toLowerCase();

  if (!validator.isEmail(email)) {
    throw new OrganisationInviteServiceError(
      "Invalid invitee email address.",
      400,
    );
  }

  return email;
};

const validateEmploymentType = (value: unknown) => {
  if (value == null) {
    return undefined;
  }

  if (
    value === "FULL_TIME" ||
    value === "PART_TIME" ||
    value === "CONTRACTOR"
  ) {
    return value;
  }

  throw new OrganisationInviteServiceError(
    "Invalid employment type supplied.",
    400,
  );
};

const buildInviteResponseFromPrisma = (
  invite: PrismaOrganisationInvite,
): OrganisationInviteResponse => ({
  _id: invite.id,
  organisationId: invite.organisationId,
  invitedByUserId: invite.invitedByUserId,
  departmentIds: invite.departmentIds ?? [],
  inviteeEmail: invite.inviteeEmail,
  inviteeName: invite.inviteeName ?? undefined,
  role: invite.role,
  employmentType: invite.employmentType ?? undefined,
  token: invite.token,
  status: invite.status,
  expiresAt: invite.expiresAt,
  acceptedAt: invite.acceptedAt ?? undefined,
  createdAt: invite.createdAt,
  updatedAt: invite.updatedAt,
});

const generateInviteToken = () =>
  randomBytes(INVITE_TOKEN_BYTES).toString("hex");

const createOrReplaceInvitePostgres = async (input: {
  organisationId: string;
  departmentIds: string[];
  invitedByUserId: string;
  inviteeEmail: string;
  inviteeName?: string;
  role: string;
  employmentType?: OrganisationInviteEmploymentType;
}) => {
  const token = generateInviteToken();
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
  const normalizedEmail = input.inviteeEmail.trim().toLowerCase();

  const existing = await prisma.organisationInvite.findFirst({
    where: {
      organisationId: input.organisationId,
      inviteeEmail: normalizedEmail,
      status: "PENDING",
    },
  });

  if (existing) {
    return prisma.organisationInvite.update({
      where: { id: existing.id },
      data: {
        departmentIds: input.departmentIds,
        invitedByUserId: input.invitedByUserId,
        inviteeEmail: normalizedEmail,
        inviteeName: input.inviteeName ?? undefined,
        role: input.role,
        employmentType: input.employmentType ?? undefined,
        token,
        status: "PENDING",
        expiresAt,
        acceptedAt: null,
      },
    });
  }

  return prisma.organisationInvite.create({
    data: {
      organisationId: input.organisationId,
      departmentIds: input.departmentIds,
      invitedByUserId: input.invitedByUserId,
      inviteeEmail: normalizedEmail,
      inviteeName: input.inviteeName ?? undefined,
      role: input.role,
      employmentType: input.employmentType ?? undefined,
      token,
      status: "PENDING",
      expiresAt,
    },
  });
};

const findOrganisationOrThrow = async (
  organisationId: string,
): Promise<OrganisationIdentity> => {
  const organisation = await prisma.organization.findFirst({
    where: {
      OR: [{ id: organisationId }, { fhirId: organisationId }],
    },
    select: { id: true, name: true, type: true },
  });

  if (!organisation) {
    throw new OrganisationInviteServiceError("Organisation not found.", 404);
  }

  return {
    _id: organisation.id,
    name: organisation.name,
    type: organisation.type,
  };
};

const ensureDepartmentBelongsToOrganisation = async (
  departmentId: string,
  organisationId: string,
): Promise<DepartmentIdentity> => {
  const department = await prisma.speciality.findFirst({
    where: {
      organisationId,
      OR: [{ id: departmentId }, { fhirId: departmentId }],
    },
  });

  if (!department) {
    throw new OrganisationInviteServiceError(
      "Department not found for the organisation.",
      404,
    );
  }

  return {
    _id: department.id,
  };
};

const ensureUserOrganizationMembership = async (
  organisationId: string,
  role: string,
  userId: string,
) => {
  const practitionerReference = userId.replace(/^Practitioner\//, "");
  const organizationReference = organisationId.replace(/^Organization\//, "");

  try {
    await UserOrganizationService.createUserOrganizationMapping({
      practitionerReference,
      organizationReference,
      roleCode: role,
      roleDisplay: role,
      active: true,
    });
  } catch (error) {
    if (error instanceof UserOrganizationServiceError) {
      throw new OrganisationInviteServiceError(error.message, error.statusCode);
    }

    const duplicateKey =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: number }).code === 11000;

    if (duplicateKey) {
      logger.warn(
        "User already associated with organisation role; skipping duplicate creation.",
        {
          organisationId,
          practitionerReference,
          role,
        },
      );
      return;
    }

    throw error;
  }
};

const addUserToDepartment = async (
  department: DepartmentIdentity,
  userId: string,
) => {
  await prisma.speciality.update({
    where: { id: department._id.toString() },
    data: { memberUserIds: { push: userId } },
  });
};

const buildAcceptInviteUrl = (token: string): string => {
  const trimmedBase = ACCEPT_INVITE_BASE_URL?.trim();

  if (!trimmedBase) {
    throw new OrganisationInviteServiceError(
      "Invite acceptance URL is not configured.",
      500,
    );
  }

  try {
    const url = new URL(trimmedBase);
    return url.toString();
  } catch {
    const base = trimmedBase.endsWith("/")
      ? trimmedBase.slice(0, -1)
      : trimmedBase;
    return `${base}?token=${encodeURIComponent(token)}`;
  }
};

const buildDeclineInviteUrl = (token: string): string | undefined => {
  const trimmedBase = DECLINE_INVITE_BASE_URL?.trim();

  if (!trimmedBase) {
    return undefined;
  }

  try {
    const url = new URL(trimmedBase);
    url.searchParams.set("token", token);
    url.searchParams.set("action", "decline");
    return url.toString();
  } catch {
    const base = trimmedBase.endsWith("/")
      ? trimmedBase.slice(0, -1)
      : trimmedBase;
    const separator = base.includes("?") ? "&" : "?";
    return `${base}${separator}token=${encodeURIComponent(token)}&action=decline`;
  }
};

const sendInviteEmail = async (params: {
  invite: {
    token: string;
    inviteeEmail: string;
    inviteeName?: string;
    invitedByUserId: string;
    expiresAt: Date;
  };
  organisation: { name?: string | null };
}) => {
  const acceptUrl = buildAcceptInviteUrl(params.invite.token);
  const declineUrl = buildDeclineInviteUrl(params.invite.token);

  const inviter = await prisma.user.findFirst({
    where: { userId: params.invite.invitedByUserId },
    select: { firstName: true, lastName: true, email: true },
  });
  await sendEmailTemplate({
    to: params.invite.inviteeEmail,
    templateId: "organisationInvite",
    templateData: {
      organisationName: params.organisation.name ?? "your organisation",
      inviteeName: params.invite.inviteeName,
      inviterName: inviter?.firstName + " " + inviter?.lastName,
      acceptUrl,
      declineUrl,
      expiresAt: params.invite.expiresAt,
      supportEmail: SUPPORT_EMAIL_ADDRESS,
    },
  });
};

const assertInviteIsActionable = async (
  invite: { status: string; expiresAt: Date; inviteeEmail: string },
  safeEmail: string,
  onExpire: () => Promise<unknown> | void,
) => {
  if (invite.status === "ACCEPTED") {
    throw new OrganisationInviteServiceError(
      "Invitation already accepted.",
      409,
    );
  }

  if (invite.status === "CANCELLED") {
    throw new OrganisationInviteServiceError(
      "Invitation has been cancelled.",
      410,
    );
  }

  if (invite.status === "EXPIRED" || invite.expiresAt <= new Date()) {
    if (invite.status !== "EXPIRED") {
      await Promise.resolve(onExpire());
    }
    throw new OrganisationInviteServiceError("Invitation has expired.", 410);
  }

  if (invite.inviteeEmail !== safeEmail) {
    throw new OrganisationInviteServiceError(
      "Invite email does not match authenticated user.",
      403,
    );
  }
};

export const OrganisationInviteService = {
  async createInvite(
    payload: CreateInvitePayload,
  ): Promise<OrganisationInviteResponse> {
    const organisationId = normalizeIdentifier(
      payload.organisationId,
      "Organisation identifier",
    );
    if (
      !Array.isArray(payload.departmentIds) ||
      payload.departmentIds.length === 0
    ) {
      throw new OrganisationInviteServiceError(
        "At least one department must be specified.",
        400,
      );
    }

    const departmentIds = payload.departmentIds.map((id, index) =>
      normalizeIdentifier(id, `Department identifier at index ${index}`),
    );
    const invitedByUserId = requireString(
      payload.invitedByUserId,
      "Inviter identifier",
    );
    const inviteeEmail = normalizeEmail(payload.inviteeEmail);
    const inviteeName = payload.inviteeName
      ? requireString(payload.inviteeName, "Invitee name")
      : undefined;
    const role = requireString(payload.role, "Role");
    const employmentType = validateEmploymentType(payload.employmentType);

    const organisation = await findOrganisationOrThrow(organisationId);
    await Promise.all(
      departmentIds.map((departmentId) =>
        ensureDepartmentBelongsToOrganisation(departmentId, organisationId),
      ),
    );

    const invite = await createOrReplaceInvitePostgres({
      organisationId,
      departmentIds,
      invitedByUserId,
      inviteeEmail,
      inviteeName,
      role,
      employmentType,
    });

    logger.info("Organisation invite created/replaced.", {
      inviteId: invite.id,
      organisationId,
      inviteeEmail,
    });

    try {
      await sendInviteEmail({
        invite: {
          token: invite.token,
          inviteeEmail: invite.inviteeEmail,
          inviteeName: invite.inviteeName ?? undefined,
          invitedByUserId: invite.invitedByUserId,
          expiresAt: invite.expiresAt,
        },
        organisation,
      });
    } catch (error) {
      logger.error("Failed to send organisation invite email.", error);
      throw new OrganisationInviteServiceError(
        "Unable to send organisation invite email.",
        502,
      );
    }

    return buildInviteResponseFromPrisma(invite);
  },

  async listOrganisationInvites(
    organisationIdInput: string,
  ): Promise<OrganisationInviteResponse[]> {
    const organisationId = normalizeIdentifier(
      organisationIdInput,
      "Organisation identifier",
    );
    await findOrganisationOrThrow(organisationId);

    const invites = await prisma.organisationInvite.findMany({
      where: { organisationId },
      orderBy: { createdAt: "desc" },
    });

    return invites.map((invite) => buildInviteResponseFromPrisma(invite));
  },

  async listPendingInvitesForEmail(email: string) {
    const safeEmail = requireString(email, "Invitee email").toLowerCase();

    const invites = await prisma.organisationInvite.findMany({
      where: {
        inviteeEmail: safeEmail,
        status: "PENDING",
        expiresAt: { gt: new Date(Date.now()) },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!invites.length) return [];

    const results = [];
    for (const invite of invites) {
      const organisation = await prisma.organization.findFirst({
        where: {
          OR: [
            { id: invite.organisationId },
            { fhirId: invite.organisationId },
          ],
        },
        select: { name: true, type: true },
      });

      results.push({
        invite: buildInviteResponseFromPrisma(invite),
        organisationName: organisation?.name,
        organisationType: organisation?.type,
      });
    }

    return results;
  },

  async acceptInvite({
    token,
    userId,
    userEmail,
  }: AcceptInvitePayload): Promise<OrganisationInviteResponse> {
    const safeToken = requireString(token, "Invite token");
    const safeUserId = requireString(userId, "User identifier");
    const safeEmail = normalizeEmail(userEmail);

    const invite = await prisma.organisationInvite.findFirst({
      where: { token: safeToken },
    });

    if (!invite) {
      throw new OrganisationInviteServiceError("Invitation not found.", 404);
    }
    await assertInviteIsActionable(invite, safeEmail, () =>
      prisma.organisationInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      }),
    );

    await findOrganisationOrThrow(invite.organisationId);
    const departments = await Promise.all(
      invite.departmentIds.map((departmentId) =>
        ensureDepartmentBelongsToOrganisation(
          departmentId,
          invite.organisationId,
        ),
      ),
    );

    try {
      await ensureUserOrganizationMembership(
        invite.organisationId,
        invite.role,
        safeUserId,
      );
    } catch (error) {
      if (error instanceof OrganisationInviteServiceError) {
        throw error;
      }
      logger.error(
        "Failed to ensure user-organisation membership during invite acceptance.",
        error,
      );
      throw new OrganisationInviteServiceError(
        "Unable to associate user with organisation.",
        500,
      );
    }

    const updatedInvite = await prisma.organisationInvite.update({
      where: { id: invite.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });

    await Promise.all(
      departments.map((department) =>
        addUserToDepartment(department, safeUserId),
      ),
    );

    logger.info("Organisation invite accepted.", {
      inviteId: updatedInvite.id,
      organisationId: updatedInvite.organisationId,
      userId: safeUserId,
    });

    return buildInviteResponseFromPrisma(updatedInvite);
  },

  async rejectInvite({
    token,
    userId,
    userEmail,
  }: AcceptInvitePayload): Promise<OrganisationInviteResponse> {
    const safeToken = requireString(token, "Invite token");
    const safeUserId = requireString(userId, "User identifier");
    const safeEmail = normalizeEmail(userEmail);

    const invite = await prisma.organisationInvite.findFirst({
      where: { token: safeToken },
    });

    if (!invite) {
      throw new OrganisationInviteServiceError("Invitation not found.", 404);
    }
    await assertInviteIsActionable(invite, safeEmail, () =>
      prisma.organisationInvite.update({
        where: { id: invite.id },
        data: { status: "EXPIRED" },
      }),
    );

    const updatedInvite = await prisma.organisationInvite.update({
      where: { id: invite.id },
      data: {
        status: "CANCELLED",
        acceptedAt: null,
      },
    });

    logger.info("Organisation invite rejected.", {
      inviteId: updatedInvite.id,
      organisationId: updatedInvite.organisationId,
      userId: safeUserId,
    });

    return buildInviteResponseFromPrisma(updatedInvite);
  },
};
