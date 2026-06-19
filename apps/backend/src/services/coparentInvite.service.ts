import { randomUUID } from "node:crypto";

import { Prisma } from "@prisma/client";

import { prisma } from "src/config/prisma";
import { ParentService } from "./parent.service";

export class CoParentInviteServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "CoParentInviteServiceError";
  }
}

const INVITE_EXPIRY_HOURS = 24;
const CO_PARENT_PERMISSIONS = {
  assignAsPrimaryParent: false,
  emergencyBasedPermissions: false,
  appointments: false,
  companionProfile: false,
  documents: false,
  expenses: false,
  tasks: false,
  chatWithVet: false,
};

type ParentSummary = {
  id: string;
  firstName: string;
  lastName: string | null;
  fullName: string;
  profileImageUrl: string | null;
};

type PatientSummary = {
  id: string;
  name: string;
  photoUrl: string | null;
};

type InviteValidationResult = {
  id: string;
  email: string;
  inviteeName: string | null;
  expiresAt: Date;
  invitedBy: ParentSummary;
  companion: PatientSummary;
  patient: PatientSummary;
};

const buildFullName = (firstName: string, lastName: string | null) =>
  [firstName, lastName].filter(Boolean).join(" ").trim();

const getParentId = (
  parent: unknown,
  errorMessage = "Parent identifier is invalid.",
) => {
  if (parent && typeof parent === "object" && "id" in parent) {
    const id = (parent as { id?: unknown }).id;
    if (typeof id === "string" && id) {
      return id;
    }
  }

  throw new CoParentInviteServiceError(errorMessage, 400);
};

export const CoParentInviteService = {
  async sendInvite({
    email,
    patientId,
    invitedByParentId,
    inviteeName,
  }: {
    email: string;
    patientId: string;
    invitedByParentId: string;
    inviteeName?: string;
  }) {
    if (!email) {
      throw new CoParentInviteServiceError("Email is required.", 400);
    }

    if (!patientId || typeof patientId !== "string") {
      throw new CoParentInviteServiceError("Invalid patientId.", 400);
    }

    if (!invitedByParentId || typeof invitedByParentId !== "string") {
      throw new CoParentInviteServiceError("Invalid invitedByParentId.", 400);
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    const inviterOwnershipLink = await prisma.parentPatient.findFirst({
      where: {
        parentId: invitedByParentId,
        patientId,
        role: "PRIMARY",
        status: "ACTIVE",
      },
      select: { id: true },
    });

    if (!inviterOwnershipLink) {
      throw new CoParentInviteServiceError(
        "You are not authorized to invite a co-parent for this companion.",
        403,
      );
    }

    await prisma.coParentInvite.create({
      data: {
        email: email.toLowerCase(),
        inviteeName: inviteeName ?? undefined,
        patientId,
        invitedByParentId,
        inviteToken,
        expiresAt,
        acceptedAt: undefined,
        diclinedAt: undefined,
        consumed: false,
      },
    });

    return {
      inviteToken,
      expiresAt,
      email: email.toLowerCase(),
      inviteeName: inviteeName?.trim() || null,
    };
  },

  async validateInvite(token: string): Promise<InviteValidationResult> {
    if (!token || typeof token !== "string") {
      throw new CoParentInviteServiceError("Invite token is required.", 400);
    }

    const invite = await prisma.coParentInvite.findUnique({
      where: { inviteToken: token },
    });

    if (!invite) {
      throw new CoParentInviteServiceError("Invalid invite token.", 404);
    }

    if (invite.consumed) {
      throw new CoParentInviteServiceError(
        "This invite has already been used.",
        410,
      );
    }

    if (invite.expiresAt < new Date()) {
      throw new CoParentInviteServiceError("This invite has expired.", 410);
    }

    const inviter = await prisma.parent.findUnique({
      where: { id: invite.invitedByParentId },
    });
    if (!inviter) {
      throw new CoParentInviteServiceError("Inviter parent not found.", 404);
    }

    const companion = await prisma.patient.findUnique({
      where: { id: invite.patientId },
    });
    if (!companion) {
      throw new CoParentInviteServiceError("Companion not found.", 404);
    }

    return {
      id: invite.id,
      email: invite.email,
      inviteeName: invite.inviteeName || null,
      expiresAt: invite.expiresAt,
      invitedBy: {
        id: inviter.id,
        firstName: inviter.firstName,
        lastName: inviter.lastName || null,
        fullName: buildFullName(inviter.firstName, inviter.lastName),
        profileImageUrl: inviter.profileImageUrl || null,
      },
      companion: {
        id: companion.id,
        name: companion.name,
        photoUrl: companion.photoUrl || null,
      },
      patient: {
        id: companion.id,
        name: companion.name,
        photoUrl: companion.photoUrl || null,
      },
    };
  },

  async acceptInvite(token: string, authUserId: string) {
    if (!token || typeof token !== "string") {
      throw new CoParentInviteServiceError("Invite token is required.", 400);
    }

    if (!authUserId || typeof authUserId !== "string") {
      throw new CoParentInviteServiceError("Authenticated user required.", 401);
    }

    const invite = await this.validateInvite(token);

    const parentDoc = await ParentService.findByLinkedUserId(authUserId);
    if (!parentDoc) {
      throw new CoParentInviteServiceError(
        "Parent profile not found for this user. Please complete parent setup before accepting invite.",
        404,
      );
    }

    const parentId = getParentId(parentDoc);

    const existingLink = await prisma.parentPatient.findFirst({
      where: {
        parentId,
        patientId: invite.patient.id,
        status: { in: ["ACTIVE"] },
      },
      select: { id: true },
    });

    if (existingLink) {
      throw new CoParentInviteServiceError(
        "You are already linked to this companion.",
        409,
      );
    }

    await prisma.parentPatient.create({
      data: {
        parentId,
        patientId: invite.patient.id,
        role: "CO_PARENT",
        status: "ACTIVE",
        permissions: CO_PARENT_PERMISSIONS as unknown as Prisma.InputJsonValue,
        invitedByParentId: invite.invitedBy.id,
        acceptedAt: new Date(),
      },
    });

    await prisma.coParentInvite.update({
      where: { id: invite.id },
      data: {
        consumed: true,
        acceptedAt: new Date(),
      },
    });

    return {
      message: "Invite accepted successfully.",
      parentId,
      patientId: invite.patient.id,
      invitedByParentId: invite.invitedBy.id,
    };
  },

  async declineInvite(token: string) {
    if (!token || typeof token !== "string") {
      throw new CoParentInviteServiceError("Invite token is required.", 400);
    }

    const invite = await prisma.coParentInvite.findUnique({
      where: { inviteToken: token },
    });

    if (!invite) {
      throw new CoParentInviteServiceError("Invalid invite token.", 404);
    }

    if (invite.consumed) {
      throw new CoParentInviteServiceError(
        "This invite has already been used.",
        410,
      );
    }

    if (invite.expiresAt < new Date()) {
      throw new CoParentInviteServiceError("This invite has expired.", 410);
    }

    const updated = await prisma.coParentInvite.update({
      where: { id: invite.id },
      data: {
        consumed: true,
        diclinedAt: new Date(),
      },
    });

    return {
      message: "Invite declined successfully.",
      email: updated.email,
      patientId: updated.patientId,
      invitedByParentId: updated.invitedByParentId,
    };
  },

  async getPendingInvitesForEmail(email: string) {
    if (!email || typeof email !== "string") {
      throw new CoParentInviteServiceError("Email is required.", 400);
    }

    const inviteDocs = await prisma.coParentInvite.findMany({
      where: {
        email: email.toLowerCase(),
        consumed: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { expiresAt: "asc" },
    });

    if (!inviteDocs.length) {
      return { pendingInvites: [] };
    }

    const results = [];

    for (const invite of inviteDocs) {
      const inviter = await prisma.parent.findUnique({
        where: { id: invite.invitedByParentId },
      });
      if (!inviter) continue;

      const companion = await prisma.patient.findUnique({
        where: { id: invite.patientId },
      });
      if (!companion) continue;

      const inviterFullName = buildFullName(
        inviter.firstName,
        inviter.lastName,
      );

      results.push({
        token: invite.inviteToken,
        email: invite.email,
        inviteeName: invite.inviteeName || null,
        expiresAt: invite.expiresAt,
        invitedBy: {
          id: inviter.id,
          firstName: inviter.firstName,
          lastName: inviter.lastName || null,
          fullName: inviterFullName,
          profileImageUrl: inviter.profileImageUrl || null,
        },
        companion: {
          id: companion.id,
          name: companion.name,
          photoUrl: companion.photoUrl || null,
        },
      });
    }

    return {
      pendingInvites: results,
    };
  },
};
