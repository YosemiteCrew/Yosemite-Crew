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
import { UserOrganizationService } from "./user-organization.service";
import { renderOrganisationInviteTemplate } from "../utils/email-templates";
import { sendEmail } from "../utils/email";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9\-.]{1,64}$/;
const DEFAULT_ACCEPT_URL = "https://app.yosemitecrew.com/invite";
const ACCEPT_INVITE_BASE_URL =
  process.env.ORG_INVITE_ACCEPT_BASE_URL ??
  process.env.INVITE_ACCEPT_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  DEFAULT_ACCEPT_URL;
const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";

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
    departmentId: rest.departmentId,
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

const findOrganisationOrThrow = async (
  organisationId: string,
): Promise<OrganizationMongo> => {
  const query = buildIdentifierLookup(organisationId);
  const organisation = await OrganizationModel.findOne(query).setOptions({
    sanitizeFilter: true,
  });

  if (!organisation) {
    throw new OrganisationInviteServiceError("Organisation not found.", 404);
  }

  return organisation;
};

const ensureDepartmentBelongsToOrganisation = async (
  departmentId: string,
  organisationId: string,
): Promise<SpecialityDocument> => {
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
  const practitionerReference = userId.startsWith("Practitioner/")
    ? userId
    : `Practitioner/${userId}`;
  const organizationReference = organisationId.startsWith("Organization/")
    ? organisationId
    : `Organization/${organisationId}`;

  try {
    await UserOrganizationService.createUserOrganizationMapping({
      practitionerReference,
      organizationReference,
      roleCode: role,
      roleDisplay: role,
      active: true,
    });
  } catch (error) {
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
  department: SpecialityDocument,
  userId: string,
) => {
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
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    const base = trimmedBase.endsWith("/")
      ? trimmedBase.slice(0, -1)
      : trimmedBase;
    return `${base}?token=${encodeURIComponent(token)}`;
  }
};

const sendInviteEmail = async (
  invite: OrganisationInviteDocument,
  organisation: OrganizationMongo,
) => {
  const acceptUrl = buildAcceptInviteUrl(invite.token);
  const template = renderOrganisationInviteTemplate({
    organisationName: organisation.name ?? "your organisation",
    inviteeName: invite.inviteeName,
    inviterName: undefined,
    acceptUrl,
    expiresAt: invite.expiresAt,
    supportEmail: SUPPORT_EMAIL_ADDRESS,
  });

  await sendEmail({
    to: invite.inviteeEmail,
    subject: template.subject,
    htmlBody: template.htmlBody,
    textBody: template.textBody,
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
    const departmentId = normalizeIdentifier(
      payload.departmentId,
      "Department identifier",
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
    await ensureDepartmentBelongsToOrganisation(departmentId, organisationId);

    const invite = await OrganisationInviteModel.createOrReplaceInvite({
      organisationId,
      departmentId,
      invitedByUserId,
      inviteeEmail,
      inviteeName,
      role,
      employmentType,
    });

    logger.info("Organisation invite created/replaced.", {
      inviteId: invite._id?.toString(),
      organisationId,
      inviteeEmail,
    });

    try {
      await sendInviteEmail(invite, organisation);
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

    const invites = await OrganisationInviteModel.find({ organisationId })
      .sort({ createdAt: -1 })
      .setOptions({ sanitizeFilter: true });

    return invites.map((invite) => buildInviteResponse(invite));
  },

  async listPendingInvitesForEmail(email: string) {
    const safeEmail = requireString(email, "Invitee email").toLowerCase();

    const invites = await OrganisationInviteModel.find({
      inviteeEmail: safeEmail,
      status: "PENDING",
      expiresAt: { $gt: new Date(Date.now()) },
    }).sort({ createdAt: -1 });

    if(!invites.length)
      return [];
    const results = [];
    for(const invite of invites) {

      const organisation = await OrganizationModel.findOne({
        id : invite.organisationId
      })

      results.push({
        invite: buildInviteResponse(invite),
        organisationName: organisation?.name,
        organisationType: organisation?.type
      })
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
    const department = await ensureDepartmentBelongsToOrganisation(
      invite.departmentId,
      invite.organisationId,
    );

    invite.status = "ACCEPTED";
    invite.acceptedAt = new Date();
    await invite.save();

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

    await addUserToDepartment(department, safeUserId);

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

    logger.info("Organisation invite rejected.", {
      inviteId: invite._id?.toString(),
      organisationId: invite.organisationId,
      userId: safeUserId,
    });

    return buildInviteResponse(invite);
  },
};
