import { randomUUID } from "node:crypto";
import {
  OrganisationType,
  PatientOrganisationRole,
  PatientOrganisationStatus,
  Prisma,
} from "@prisma/client";
import type { PatientOrganisation } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { assertSafeString } from "src/utils/sanitize";
import { AuditTrailService } from "./audit-trail.service";
import { toFHIRFromPrisma as toFHIRCompanionFromPrisma } from "./companion.service";
import { toFHIRFromPrisma as toFHIRParentFromPrisma } from "./parent.service";
import { Types } from "mongoose";

type BusinessType = "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";

type CompanionOrganisationLinkOrganization = {
  id: string;
  name: string;
  phoneNo: string;
  email?: string;
  imageURL?: string;
  googlePlacesId?: string;
  address?: {
    addressLine?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  };
};

type CompanionOrganisationLinkWithOrganization = {
  id: string;
  organization: CompanionOrganisationLinkOrganization | null;
  organisationType: BusinessType;
  status: PatientOrganisationStatus;
  patientId: string;
};

type CompanionOrganisationLinksResponse = {
  links: CompanionOrganisationLinkWithOrganization[];
};

type PatientOrganisationRecord = PatientOrganisation & {
  _id: string;
};

export class CompanionOrganisationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionOrganisationServiceError";
  }
}

const requireId = (value: string | Types.ObjectId, field: string) => {
  const trimmed = assertSafeString(String(value), field);

  if (!trimmed || trimmed.includes("$") || trimmed.includes(".")) {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  return trimmed;
};

const toRecord = (link: PatientOrganisation): PatientOrganisationRecord => ({
  ...link,
  _id: link.id,
});

const mapOrganizationFromPrisma = (organization: {
  id: string;
  name: string;
  phoneNo: string;
  email: string | null;
  imageUrl: string | null;
  googlePlacesId: string | null;
  address: {
    addressLine: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
}): CompanionOrganisationLinkOrganization => ({
  id: organization.id,
  name: organization.name,
  phoneNo: organization.phoneNo,
  email: organization.email ?? undefined,
  imageURL: organization.imageUrl ?? undefined,
  googlePlacesId: organization.googlePlacesId ?? undefined,
  address: organization.address
    ? {
        addressLine: organization.address.addressLine ?? undefined,
        city: organization.address.city ?? undefined,
        state: organization.address.state ?? undefined,
        postalCode: organization.address.postalCode ?? undefined,
        country: organization.address.country ?? undefined,
      }
    : undefined,
});

const findActiveOrPendingLink = async (params: {
  patientId: string;
  organisationId: string;
}) =>
  prisma.patientOrganisation.findFirst({
    where: {
      patientId: params.patientId,
      organisationId: params.organisationId,
      status: {
        in: [
          PatientOrganisationStatus.ACTIVE,
          PatientOrganisationStatus.PENDING,
        ],
      },
    },
  });

const createLink = async (input: {
  patientId: string;
  organisationId?: string | null;
  linkedByParentId?: string | null;
  linkedByPmsUserId?: string | null;
  organisationType: BusinessType;
  status: PatientOrganisationStatus;
  invitedViaEmail?: string | null;
  organisationName?: string | null;
  organisationPlacesId?: string | null;
  inviteToken?: string | null;
  acceptedAt?: Date | null;
  rejectedAt?: Date | null;
}) =>
  prisma.patientOrganisation.create({
    data: {
      patientId: input.patientId,
      organisationId: input.organisationId ?? null,
      linkedByParentId: input.linkedByParentId ?? null,
      linkedByPmsUserId: input.linkedByPmsUserId ?? null,
      organisationType: input.organisationType as OrganisationType,
      role: PatientOrganisationRole.ORGANISATION,
      status: input.status,
      invitedViaEmail: input.invitedViaEmail ?? null,
      organisationName: input.organisationName ?? null,
      organisationPlacesId: input.organisationPlacesId ?? null,
      inviteToken: input.inviteToken ?? null,
      acceptedAt: input.acceptedAt ?? null,
      rejectedAt: input.rejectedAt ?? null,
    },
  });

const updateLink = async (
  id: string,
  data: Prisma.PatientOrganisationUpdateInput,
) =>
  prisma.patientOrganisation.update({
    where: { id },
    data,
  });

export const CompanionOrganisationService = {
  async linkByParent({
    parentId,
    patientId,
    organisationId,
    organisationType,
  }: {
    parentId: string | Types.ObjectId;
    patientId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    organisationType: BusinessType;
  }): Promise<PatientOrganisationRecord> {
    const parent = requireId(parentId, "parentId");
    const companion = requireId(patientId, "patientId");
    const org = requireId(organisationId, "organisationId");

    const existing = await findActiveOrPendingLink({
      patientId: companion,
      organisationId: org,
    });
    if (existing) {
      return toRecord(existing);
    }

    const link = await createLink({
      patientId: companion,
      organisationId: org,
      linkedByParentId: parent,
      organisationType,
      status: PatientOrganisationStatus.ACTIVE,
    });

    await AuditTrailService.recordSafely({
      organisationId: org,
      patientId: companion,
      eventType: "PATIENT_ORG_LINK_CREATED",
      actorType: "PARENT",
      actorId: parent,
      entityType: "PATIENT_ORGANISATION",
      entityId: link.id,
      metadata: {
        organisationType,
        status: link.status,
      },
    });

    return toRecord(link);
  },

  async linkByPmsUser({
    pmsUserId,
    patientId,
    organisationId,
    organisationType,
  }: {
    pmsUserId: string;
    patientId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    organisationType: BusinessType;
  }): Promise<PatientOrganisationRecord> {
    const companion = requireId(patientId, "patientId");
    const org = requireId(organisationId, "organisationId");

    const existing = await findActiveOrPendingLink({
      patientId: companion,
      organisationId: org,
    });
    if (existing) {
      return toRecord(existing);
    }

    const link = await createLink({
      patientId: companion,
      organisationId: org,
      linkedByPmsUserId: pmsUserId,
      organisationType,
      status: PatientOrganisationStatus.PENDING,
    });

    await AuditTrailService.recordSafely({
      organisationId: org,
      patientId: companion,
      eventType: "PATIENT_ORG_LINK_REQUESTED",
      actorType: "PMS_USER",
      actorId: pmsUserId,
      entityType: "PATIENT_ORGANISATION",
      entityId: link.id,
      metadata: {
        organisationType,
        status: link.status,
      },
    });

    return toRecord(link);
  },

  async sendInvite({
    parentId,
    patientId,
    organisationType,
    email,
    name,
    placesId,
  }: {
    parentId: string | Types.ObjectId;
    patientId: string | Types.ObjectId;
    organisationType: BusinessType;
    email?: string | null;
    name?: string | null;
    placesId?: string | null;
  }): Promise<PatientOrganisationRecord> {
    if (!email && !name) {
      throw new CompanionOrganisationServiceError(
        "Email required or Name",
        400,
      );
    }

    const parent = requireId(parentId, "parentId");
    const companion = requireId(patientId, "patientId");

    const link = await createLink({
      patientId: companion,
      linkedByParentId: parent,
      organisationType,
      status: PatientOrganisationStatus.PENDING,
      invitedViaEmail: email ?? null,
      organisationName: name ?? null,
      organisationPlacesId: placesId ?? null,
      inviteToken: randomUUID(),
    });

    return toRecord(link);
  },

  async validateInvite(token: string) {
    const inviteToken = assertSafeString(token, "token");

    const invite = await prisma.patientOrganisation.findFirst({
      where: {
        inviteToken: inviteToken,
        status: PatientOrganisationStatus.PENDING,
      },
    });

    if (!invite) {
      throw new CompanionOrganisationServiceError(
        "Invalid or expired invite",
        404,
      );
    }

    return toRecord(invite);
  },

  async acceptInvite({
    token,
    organisationId,
  }: {
    token: string;
    organisationId: string | Types.ObjectId;
  }): Promise<PatientOrganisationRecord> {
    const org = requireId(organisationId, "organisationId");
    const inviteToken = assertSafeString(token, "token");

    const invite = await prisma.patientOrganisation.findFirst({
      where: {
        inviteToken: inviteToken,
        status: PatientOrganisationStatus.PENDING,
      },
    });

    if (!invite) {
      throw new CompanionOrganisationServiceError("Invalid invite token", 404);
    }

    const updated = await updateLink(invite.id, {
      organisationId: org,
      acceptedAt: new Date(),
      status: PatientOrganisationStatus.ACTIVE,
      inviteToken: null,
    });

    await AuditTrailService.recordSafely({
      organisationId: org,
      patientId: invite.patientId,
      eventType: "PATIENT_ORG_INVITE_ACCEPTED",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: updated.id,
      metadata: {
        organisationType: updated.organisationType,
        status: updated.status,
      },
    });

    return toRecord(updated);
  },

  async rejectInvite({
    token,
    organisationId,
  }: {
    token: string;
    organisationId: string | Types.ObjectId;
  }): Promise<void> {
    const org = requireId(organisationId, "organisationId");
    const inviteToken = assertSafeString(token, "token");

    const invite = await prisma.patientOrganisation.findFirst({
      where: {
        inviteToken: inviteToken,
        status: PatientOrganisationStatus.PENDING,
      },
    });

    if (!invite) {
      throw new CompanionOrganisationServiceError("Invalid invite token", 404);
    }

    const updated = await updateLink(invite.id, {
      organisationId: org,
      rejectedAt: new Date(),
      status: PatientOrganisationStatus.REVOKED,
      inviteToken: null,
    });

    await AuditTrailService.recordSafely({
      organisationId: org,
      patientId: invite.patientId,
      eventType: "PATIENT_ORG_INVITE_REJECTED",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: updated.id,
      metadata: {
        organisationType: updated.organisationType,
        status: updated.status,
      },
    });
  },

  async linkOnCompanionCreatedByPms({
    patientId,
    organisationId,
    pmsUserId,
    organisationType,
  }: {
    patientId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    pmsUserId: string;
    organisationType: BusinessType;
  }) {
    return this.linkByPmsUser({
      pmsUserId,
      patientId,
      organisationId,
      organisationType,
    });
  },

  async linkOnAppointmentBooked({
    patientId,
    organisationId,
    organisationType,
  }: {
    patientId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    organisationType: BusinessType;
  }) {
    const companion = requireId(patientId, "patientId");
    const org = requireId(organisationId, "organisationId");

    const existing = await findActiveOrPendingLink({
      patientId: companion,
      organisationId: org,
    });
    if (existing) {
      return toRecord(existing);
    }

    const link = await createLink({
      patientId: companion,
      organisationId: org,
      organisationType,
      status: PatientOrganisationStatus.ACTIVE,
    });

    await AuditTrailService.recordSafely({
      organisationId: org,
      patientId: companion,
      eventType: "PATIENT_ORG_LINK_AUTO",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: link.id,
      metadata: {
        organisationType,
        status: link.status,
      },
    });

    return toRecord(link);
  },

  async revokeLink(linkId: string | Types.ObjectId) {
    const id = requireId(linkId, "linkId");

    const link = await prisma.patientOrganisation.findUnique({
      where: { id },
    });

    if (!link) {
      throw new CompanionOrganisationServiceError("Link not found", 404);
    }

    await prisma.patientOrganisation.delete({
      where: { id },
    });

    await AuditTrailService.recordSafely({
      organisationId: link.organisationId ?? "",
      patientId: link.patientId,
      eventType: "PATIENT_ORG_LINK_REVOKED",
      actorType: "SYSTEM",
      entityType: "PATIENT_ORGANISATION",
      entityId: link.id,
      metadata: {
        organisationType: link.organisationType,
        status: link.status,
      },
    });

    return toRecord(link);
  },

  async parentApproveLink(parentId: string | Types.ObjectId, linkId: string) {
    const parent = requireId(parentId, "parentId");
    const id = requireId(linkId, "linkId");

    const link = await prisma.patientOrganisation.findFirst({
      where: {
        id,
        linkedByParentId: null,
        status: PatientOrganisationStatus.PENDING,
      },
    });

    if (!link) {
      throw new CompanionOrganisationServiceError(
        "Pending link not found.",
        404,
      );
    }

    const updated = await updateLink(link.id, {
      status: PatientOrganisationStatus.ACTIVE,
      acceptedAt: new Date(),
      linkedByParentId: parent,
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId ?? "",
      patientId: updated.patientId,
      eventType: "PATIENT_ORG_LINK_APPROVED",
      actorType: "PARENT",
      actorId: parent,
      entityType: "PATIENT_ORGANISATION",
      entityId: updated.id,
      metadata: {
        organisationType: updated.organisationType,
        status: updated.status,
      },
    });

    return toRecord(updated);
  },

  async parentRejectLink(parentId: string | Types.ObjectId, linkId: string) {
    const parent = requireId(parentId, "parentId");
    const id = requireId(linkId, "linkId");

    const link = await prisma.patientOrganisation.findFirst({
      where: {
        id,
        status: PatientOrganisationStatus.PENDING,
      },
    });

    if (!link) {
      throw new CompanionOrganisationServiceError(
        "Pending link not found.",
        404,
      );
    }

    const updated = await updateLink(link.id, {
      status: PatientOrganisationStatus.REVOKED,
      acceptedAt: null,
      linkedByParentId: parent,
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId ?? "",
      patientId: updated.patientId,
      eventType: "PATIENT_ORG_LINK_REJECTED",
      actorType: "PARENT",
      actorId: parent,
      entityType: "PATIENT_ORGANISATION",
      entityId: updated.id,
      metadata: {
        organisationType: updated.organisationType,
        status: updated.status,
      },
    });

    return toRecord(updated);
  },

  async getLinksForCompanion(patientId: string | Types.ObjectId) {
    const id = requireId(patientId, "patientId");
    const links = await prisma.patientOrganisation.findMany({
      where: { patientId: id },
    });
    return links.map(toRecord);
  },

  async getLinksForCompanionByOrganisationTye(
    patientId: string | Types.ObjectId,
    type: BusinessType,
  ): Promise<CompanionOrganisationLinksResponse> {
    const id = requireId(patientId, "patientId");

    const links = await prisma.patientOrganisation.findMany({
      where: {
        patientId: id,
        organisationType: type as OrganisationType,
        OR: [
          { status: PatientOrganisationStatus.ACTIVE },
          {
            status: PatientOrganisationStatus.PENDING,
            organisationId: { not: null },
          },
        ],
      },
    });

    const organisationIds = links
      .map((link) => link.organisationId)
      .filter((organisationId): organisationId is string =>
        Boolean(organisationId),
      );

    const organizations = organisationIds.length
      ? await prisma.organization.findMany({
          where: {
            id: {
              in: organisationIds,
            },
          },
          include: {
            address: true,
          },
        })
      : [];

    const organizationMap = new Map(
      organizations.map((organization) => [
        organization.id,
        mapOrganizationFromPrisma(organization),
      ]),
    );

    return {
      links: links.map((link) => ({
        id: link.id,
        organization: link.organisationId
          ? (organizationMap.get(link.organisationId) ?? null)
          : null,
        organisationType: link.organisationType as BusinessType,
        status: link.status,
        patientId: link.patientId,
      })),
    };
  },

  async getLinksForOrganisation(organisationId: string | Types.ObjectId) {
    const id = requireId(organisationId, "organisationId");

    const links = await prisma.patientOrganisation.findMany({
      where: {
        organisationId: id,
        status: {
          in: [
            PatientOrganisationStatus.ACTIVE,
            PatientOrganisationStatus.PENDING,
          ],
        },
      },
    });

    const companionIds = Array.from(
      new Set(links.map((link) => link.patientId)),
    );
    const companions = await prisma.patient.findMany({
      where: { id: { in: companionIds } },
    });
    const companionMap = new Map(
      companions.map((companion) => [companion.id, companion]),
    );

    const parentLinks = await prisma.parentPatient.findMany({
      where: {
        patientId: { in: companionIds },
        role: "PRIMARY",
        status: "ACTIVE",
      },
    });
    const parentIds = Array.from(
      new Set(parentLinks.map((link) => link.parentId)),
    );
    const parents = await prisma.parent.findMany({
      where: { id: { in: parentIds } },
      include: { address: true },
    });
    const parentMap = new Map(parents.map((parent) => [parent.id, parent]));
    const parentByCompanion = new Map(
      parentLinks.map((link) => [link.patientId, link.parentId]),
    );

    return links.map((link) => {
      const companion = companionMap.get(link.patientId);
      const parentId = parentByCompanion.get(link.patientId);
      const parent = parentId ? parentMap.get(parentId) : null;

      return {
        linkId: link.id,
        organisationId: link.organisationId ?? undefined,
        organisationType: link.organisationType,
        status: link.status,
        companion: companion ? toFHIRCompanionFromPrisma(companion) : null,
        parent: parent ? toFHIRParentFromPrisma(parent) : null,
      };
    });
  },
};
