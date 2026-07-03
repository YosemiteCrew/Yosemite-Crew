import { Types } from "mongoose";

import OrganizationModel from "src/models/organization";
import UserOrganizationModel from "src/models/user-organization";
import UserModel from "src/models/user";
import { prisma } from "src/config/prisma";
import { isReadFromPostgres } from "src/config/read-switch";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const BILLING_SETTINGS_URL = process.env.APP_URL
  ? `${process.env.APP_URL}/settings/billing`
  : "https://app.yosemitecrew.com/settings/billing";

const extractReferenceId = (value: string) => value.split("/").pop()?.trim();

const buildOwnerContact = (
  email: string,
  organisationName: string,
  firstName?: string | null,
  lastName?: string | null,
): {
  email: string;
  name?: string;
  organisationName: string;
} => {
  const nameParts = [firstName, lastName].filter(Boolean);

  return {
    email,
    name: nameParts.length ? nameParts.join(" ") : undefined,
    organisationName,
  };
};

const buildOrgReferenceCandidates = (
  organisationId: string,
  fhirId?: string | null,
) =>
  [
    organisationId,
    `Organization/${organisationId}`,
    fhirId,
    fhirId ? `Organization/${fhirId}` : undefined,
  ].filter(Boolean) as string[];

const resolveOwnerUserFromPostgres = async (orgIdString: string) => {
  const organisation = await prisma.organization.findFirst({
    where: { OR: [{ id: orgIdString }, { fhirId: orgIdString }] },
    select: { id: true, name: true, fhirId: true },
  });

  if (!organisation) {
    return null;
  }

  const ownerMapping = await prisma.userOrganization.findFirst({
    where: {
      roleCode: "OWNER",
      active: true,
      organizationReference: {
        in: buildOrgReferenceCandidates(organisation.id, organisation.fhirId),
      },
    },
    select: { practitionerReference: true },
  });

  if (!ownerMapping?.practitionerReference) {
    return null;
  }

  const ownerUserId =
    extractReferenceId(ownerMapping.practitionerReference) ??
    ownerMapping.practitionerReference;

  const ownerUser = await prisma.user.findFirst({
    where: { userId: ownerUserId },
    select: { email: true, firstName: true, lastName: true },
  });

  if (!ownerUser?.email) {
    return null;
  }

  return buildOwnerContact(
    ownerUser.email,
    organisation.name,
    ownerUser.firstName,
    ownerUser.lastName,
  );
};

const resolveOwnerUserFromMongo = async (orgId: Types.ObjectId | string) => {
  const orgIdString = typeof orgId === "string" ? orgId : orgId.toString();
  const organisation = await OrganizationModel.findById(orgId)
    .select("name fhirId")
    .lean();

  if (!organisation) {
    return null;
  }

  const ownerMapping = await UserOrganizationModel.findOne({
    roleCode: "OWNER",
    active: true,
    organizationReference: {
      $in: buildOrgReferenceCandidates(orgIdString, organisation.fhirId),
    },
  })
    .select("practitionerReference")
    .lean();

  if (!ownerMapping?.practitionerReference) {
    return null;
  }

  const ownerUserId =
    extractReferenceId(ownerMapping.practitionerReference) ??
    ownerMapping.practitionerReference;

  const ownerUser = await UserModel.findOne(
    { userId: ownerUserId },
    { email: 1, firstName: 1, lastName: 1 },
  ).lean();

  if (!ownerUser?.email) {
    return null;
  }

  return buildOwnerContact(
    ownerUser.email,
    organisation.name,
    ownerUser.firstName,
    ownerUser.lastName,
  );
};

const resolveOwnerUser = async (orgId: Types.ObjectId | string) => {
  const orgIdString = typeof orgId === "string" ? orgId : orgId.toString();

  return isReadFromPostgres()
    ? resolveOwnerUserFromPostgres(orgIdString)
    : resolveOwnerUserFromMongo(orgId);
};

export const sendFreePlanLimitReachedEmail = async (params: {
  orgId: Types.ObjectId | string;
  usage: {
    appointmentsUsed?: number | null;
    toolsUsed?: number | null;
    usersActiveCount?: number | null;
    freeAppointmentsLimit?: number | null;
    freeToolsLimit?: number | null;
    freeUsersLimit?: number | null;
  };
}) => {
  const owner = await resolveOwnerUser(params.orgId);
  if (!owner) {
    return;
  }

  const appointmentLimitReached =
    (params.usage.appointmentsUsed ?? 0) >=
    (params.usage.freeAppointmentsLimit ?? 0);
  const toolsLimitReached =
    (params.usage.toolsUsed ?? 0) >= (params.usage.freeToolsLimit ?? 0);
  const usersLimitReached =
    (params.usage.usersActiveCount ?? 0) >= (params.usage.freeUsersLimit ?? 0);

  const limitItems = [
    appointmentLimitReached && {
      label: "Appointments",
      used: params.usage.appointmentsUsed ?? 0,
      limit: params.usage.freeAppointmentsLimit ?? 0,
    },
    toolsLimitReached && {
      label: "Tools",
      used: params.usage.toolsUsed ?? 0,
      limit: params.usage.freeToolsLimit ?? 0,
    },
    usersLimitReached && {
      label: "Users",
      used: params.usage.usersActiveCount ?? 0,
      limit: params.usage.freeUsersLimit ?? 0,
    },
  ].filter(Boolean) as Array<{ label: string; used: number; limit: number }>;

  if (!limitItems.length) {
    return;
  }

  try {
    await sendEmailTemplate({
      to: owner.email,
      templateId: "freePlanLimitReached",
      templateData: {
        ownerName: owner.name,
        organisationName: owner.organisationName,
        limitItems,
        ctaUrl: BILLING_SETTINGS_URL,
        ctaLabel: "Upgrade Plan",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send free plan limit reached email.", error);
  }
};
