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

const resolveOwnerUser = async (orgId: Types.ObjectId | string) => {
  const orgIdString = typeof orgId === "string" ? orgId : orgId.toString();

  if (isReadFromPostgres()) {
    const organisation = await prisma.organization.findFirst({
      where: { OR: [{ id: orgIdString }, { fhirId: orgIdString }] },
      select: { id: true, name: true, fhirId: true },
    });

    if (!organisation) {
      return null;
    }

    const orgReferenceCandidates = [
      organisation.id,
      `Organization/${organisation.id}`,
      organisation.fhirId,
      organisation.fhirId ? `Organization/${organisation.fhirId}` : undefined,
    ].filter(Boolean) as string[];

    const ownerMapping = await prisma.userOrganization.findFirst({
      where: {
        roleCode: "OWNER",
        active: true,
        organizationReference: { in: orgReferenceCandidates },
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

    const nameParts = [ownerUser.firstName, ownerUser.lastName].filter(Boolean);

    return {
      email: ownerUser.email,
      name: nameParts.length ? nameParts.join(" ") : undefined,
      organisationName: organisation.name,
    };
  }

  const organisation = await OrganizationModel.findById(orgId)
    .select("name fhirId")
    .lean();

  if (!organisation) {
    return null;
  }

  const orgFhirId = organisation.fhirId;
  const orgReferenceCandidates = [
    orgIdString,
    `Organization/${orgIdString}`,
    orgFhirId,
    orgFhirId ? `Organization/${orgFhirId}` : undefined,
  ].filter(Boolean) as string[];

  const ownerMapping = await UserOrganizationModel.findOne({
    roleCode: "OWNER",
    active: true,
    organizationReference: { $in: orgReferenceCandidates },
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

  const nameParts = [ownerUser.firstName, ownerUser.lastName].filter(Boolean);

  return {
    email: ownerUser.email,
    name: nameParts.length ? nameParts.join(" ") : undefined,
    organisationName: organisation.name,
  };
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
    appointmentLimitReached
      ? {
          label: "Appointments",
          used: params.usage.appointmentsUsed ?? 0,
          limit: params.usage.freeAppointmentsLimit ?? 0,
        }
      : null,
    toolsLimitReached
      ? {
          label: "Tools",
          used: params.usage.toolsUsed ?? 0,
          limit: params.usage.freeToolsLimit ?? 0,
        }
      : null,
    usersLimitReached
      ? {
          label: "Users",
          used: params.usage.usersActiveCount ?? 0,
          limit: params.usage.freeUsersLimit ?? 0,
        }
      : null,
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
