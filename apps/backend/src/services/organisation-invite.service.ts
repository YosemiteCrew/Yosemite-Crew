import { Types } from "mongoose";
import validator from "validator";

import OrganisationInviteModel, {
  type CreateOrganisationInviteInput,
  type OrganisationInviteDocument,
} from "../models/organisationInvite";
import OrganizationModel, {
  type OrganizationMongo,
} from "../models/organization";
import SpecialityModel, { type SpecialityDocument } from "../models/speciality";
import logger from "../utils/logger";
import type { InviteStatus, OrganisationInvite } from "@yosemite-crew/types";
import {
  OrganisationInviteEmploymentType,
  OrganisationInviteStatus,
  type OrganisationInvite as PrismaOrganisationInvite,
} from "@prisma/client";
import { prisma } from "../config/prisma";
import { handleDualWriteError, shouldDualWrite } from "../utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
} from "./user-organization.service";
import { sendEmailTemplate } from "../utils/email";
import UserModel from "src/models/user";
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

  if (
    !Types.ObjectId.isValid(identifier) &&
    !IDENTIFIER_PATTERN.test(identifier)
  ) {
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

const buildIdentifierLookup = (identifier: string) => {
  const predicates: Array<Record<string, string>> = [];

  if (Types.ObjectId.isValid(identifier)) {
    predicates.push({ _id: identifier });
  }

  if (IDENTIFIER_PATTERN.test(identifier)) {
    predicates.push({ fhirId: identifier });
  }

  if (!predicates.length) {
    throw new OrganisationInviteServiceError(
      "Unable to build identifier lookup.",
      400,
    );
  }

  return predicates.length === 1 ? predicates[0] : { $or: predicates };
};

const buildInviteResponse = (
  document: OrganisationInviteDocument,
): OrganisationInviteResponse => {
  const { _id, ...rest } = document.toObject({ virtuals: false });

  return {
    _id: _id.toString(),
    organisationId: rest.organisationId,
    invitedByUserId: rest.invitedByUserId,
    departmentIds: rest.departmentIds,
    inviteeEmail: rest.inviteeEmail,
    inviteeName: rest.inviteeName,
    role: rest.role,
    employmentType: rest.employmentType,
    token: rest.token,
    status: rest.status,
    expiresAt: rest.expiresAt,
    acceptedAt: rest.acceptedAt,
    createdAt: rest.createdAt,
    updatedAt: rest.updatedAt,
  };
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

const toPrismaOrganisationInviteData = (doc: OrganisationInviteDocument) => ({
  id: doc._id.toString(),
  organisationId: doc.organisationId,
  invitedByUserId: doc.invitedByUserId,
  departmentIds: doc.departmentIds ?? [],
  inviteeEmail: doc.inviteeEmail,
  inviteeName: doc.inviteeName ?? undefined,
  role: doc.role,
  employmentType: (doc.employmentType ?? undefined) as
    | OrganisationInviteEmploymentType
    | undefined,
  token: doc.token,
  status: doc.status as OrganisationInviteStatus,
  expiresAt: doc.expiresAt,
  acceptedAt: doc.acceptedAt ?? undefined,
  createdAt: doc.createdAt ?? undefined,
  updatedAt: doc.updatedAt ?? undefined,
});

const syncOrganisationInviteToPostgres = async (
  doc: OrganisationInviteDocument,
) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaOrganisationInviteData(doc);
    await prisma.organisationInvite.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("OrganisationInvite", err);
  }
};

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
  if (isReadFromPostgres()) {
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
  }

  const query = buildIdentifierLookup(organisationId);
  const organisation = await OrganizationModel.findOne(query).setOptions({
    sanitizeFilter: true,
  });

  if (!organisation) {
    throw new OrganisationInviteServiceError("Organisation not found.", 404);
  }

  return {
    _id: organisation._id.toString(),
    name: organisation.name,
    type: organisation.type,
  };
};

const ensureDepartmentBelongsToOrganisation = async (
  departmentId: string,
  organisationId: string,
): Promise<DepartmentIdentity> => {
  if (isReadFromPostgres()) {
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
      _id: department.id as unknown as SpecialityDocument["_id"],
    };
  }

  const query = buildIdentifierLookup(departmentId);
  const department = await SpecialityModel.findOne({
    ...query,
    organisationId,
  }).setOptions({
    sanitizeFilter: true,
  });

  if (!department) {
    throw new OrganisationInviteServiceError(
      "Department not found for the organisation.",
      404,
    );
  }

  return department;
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
  if (isReadFromPostgres()) {
    await prisma.speciality.update({
      where: { id: department._id.toString() },
      data: { memberUserIds: { push: userId } },
    });
    return;
  }

  await SpecialityModel.updateOne(
    { _id: department._id },
    { $addToSet: { memberUserIds: userId } },
    { sanitizeFilter: true },
  );
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

  const inviter = isReadFromPostgres()
    ? await prisma.user.findFirst({
        where: { userId: params.invite.invitedByUserId },
        select: { firstName: true, lastName: true, email: true },
      })
    : await UserModel.findOne({
        userId: params.invite.invitedByUserId,
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

    if (isReadFromPostgres()) {
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
    }

    const invite = await OrganisationInviteModel.createOrReplaceInvite({
      organisationId,
      departmentIds,
      invitedByUserId,
      inviteeEmail,
      inviteeName,
      role,
      employmentType,
    });

    await syncOrganisationInviteToPostgres(invite);

    logger.info("Organisation invite created/replaced.", {
      inviteId: invite._id?.toString(),
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

    return buildInviteResponse(invite);
  },

  async listOrganisationInvites(
    organisationIdInput: string,
  ): Promise<OrganisationInviteResponse[]> {
    const organisationId = normalizeIdentifier(
      organisationIdInput,
      "Organisation identifier",
    );
    await findOrganisationOrThrow(organisationId);

    if (isReadFromPostgres()) {
      const invites = await prisma.organisationInvite.findMany({
        where: { organisationId },
        orderBy: { createdAt: "desc" },
      });

      return invites.map((invite) => buildInviteResponseFromPrisma(invite));
    }

    const invites = await OrganisationInviteModel.find({ organisationId })
      .sort({ createdAt: -1 })
      .setOptions({ sanitizeFilter: true });

    return invites.map((invite) => buildInviteResponse(invite));
  },

  async listPendingInvitesForEmail(email: string) {
    const safeEmail = requireString(email, "Invitee email").toLowerCase();

    if (isReadFromPostgres()) {
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
    }

    const invites = await OrganisationInviteModel.find({
      inviteeEmail: safeEmail,
      status: "PENDING",
      expiresAt: { $gt: new Date(Date.now()) },
    }).sort({ createdAt: -1 });

    if (!invites.length) return [];
    const results = [];
    for (const invite of invites) {
      const organisation = await OrganizationModel.findOne({
        _id: new Types.ObjectId(invite.organisationId),
      });

      results.push({
        invite: buildInviteResponse(invite),
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

    if (isReadFromPostgres()) {
      const invite = await prisma.organisationInvite.findFirst({
        where: { token: safeToken },
      });

      if (!invite) {
        throw new OrganisationInviteServiceError("Invitation not found.", 404);
      }

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
          await prisma.organisationInvite.update({
            where: { id: invite.id },
            data: { status: "EXPIRED" },
          });
        }
        throw new OrganisationInviteServiceError(
          "Invitation has expired.",
          410,
        );
      }

      if (invite.inviteeEmail !== safeEmail) {
        throw new OrganisationInviteServiceError(
          "Invite email does not match authenticated user.",
          403,
        );
      }

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
    }

    const invite = await OrganisationInviteModel.findOne({
      token: safeToken,
    }).setOptions({
      sanitizeFilter: true,
    });

    if (!invite) {
      throw new OrganisationInviteServiceError("Invitation not found.", 404);
    }

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
        invite.status = "EXPIRED";
        await invite.save();
        await syncOrganisationInviteToPostgres(invite);
      }
      throw new OrganisationInviteServiceError("Invitation has expired.", 410);
    }

    if (invite.inviteeEmail !== safeEmail) {
      throw new OrganisationInviteServiceError(
        "Invite email does not match authenticated user.",
        403,
      );
    }

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

    invite.status = "ACCEPTED";
    invite.acceptedAt = new Date();
    await invite.save();
    await syncOrganisationInviteToPostgres(invite);

    await Promise.all(
      departments.map((department) =>
        addUserToDepartment(department, safeUserId),
      ),
    );

    logger.info("Organisation invite accepted.", {
      inviteId: invite._id?.toString(),
      organisationId: invite.organisationId,
      userId: safeUserId,
    });

    return buildInviteResponse(invite);
  },

  async rejectInvite({
    token,
    userId,
    userEmail,
  }: AcceptInvitePayload): Promise<OrganisationInviteResponse> {
    const safeToken = requireString(token, "Invite token");
    const safeUserId = requireString(userId, "User identifier");
    const safeEmail = normalizeEmail(userEmail);

    if (isReadFromPostgres()) {
      const invite = await prisma.organisationInvite.findFirst({
        where: { token: safeToken },
      });

      if (!invite) {
        throw new OrganisationInviteServiceError("Invitation not found.", 404);
      }

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
          await prisma.organisationInvite.update({
            where: { id: invite.id },
            data: { status: "EXPIRED" },
          });
        }
        throw new OrganisationInviteServiceError(
          "Invitation has expired.",
          410,
        );
      }

      if (invite.inviteeEmail !== safeEmail) {
        throw new OrganisationInviteServiceError(
          "Invite email does not match authenticated user.",
          403,
        );
      }

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
    }

    const invite = await OrganisationInviteModel.findOne({
      token: safeToken,
    }).setOptions({
      sanitizeFilter: true,
    });

    if (!invite) {
      throw new OrganisationInviteServiceError("Invitation not found.", 404);
    }

    // Check that the invite is still rejectable
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
        invite.status = "EXPIRED";
        await invite.save();
        await syncOrganisationInviteToPostgres(invite);
      }
      throw new OrganisationInviteServiceError("Invitation has expired.", 410);
    }

    // Email must match
    if (invite.inviteeEmail !== safeEmail) {
      throw new OrganisationInviteServiceError(
        "Invite email does not match authenticated user.",
        403,
      );
    }

    // Mark as rejected
    invite.status = "REJECTED" as InviteStatus;
    invite.acceptedAt = undefined;
    await invite.save();
    await syncOrganisationInviteToPostgres(invite);

    logger.info("Organisation invite rejected.", {
      inviteId: invite._id?.toString(),
      organisationId: invite.organisationId,
      userId: safeUserId,
    });

    return buildInviteResponse(invite);
  },
};
