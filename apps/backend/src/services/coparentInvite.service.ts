import { randomUUID } from "node:crypto";
import { Types } from "mongoose";

import {
  CoParentInviteModel,
  type CoParentInviteDocument,
} from "../models/coparentInvite";
import { ParentModel } from "src/models/parent";
import CompanionModel from "../models/companion";
import { ParentCompanionService } from "./parent-companion.service";
import { ParentService } from "./parent.service";
import ParentCompanionModel from "src/models/parent-companion";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";
import { isReadFromPostgres } from "src/config/read-switch";
import { Prisma } from "@prisma/client";

export class CoParentInviteServiceError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = "CoParentInviteServiceError";
  }
}

type CoParentInviteDocumentWithTimestamps = CoParentInviteDocument & {
  createdAt?: Date;
  updatedAt?: Date;
};

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

const resolveParentMongoId = (parent: {
  _id?: Types.ObjectId;
  id?: string;
}): Types.ObjectId => {
  if (parent._id) return parent._id;
  if (parent.id && Types.ObjectId.isValid(parent.id)) {
    return new Types.ObjectId(parent.id);
  }
  throw new CoParentInviteServiceError("Parent identifier is invalid.", 400);
};

export const CoParentInviteService = {
  async sendInvite({
    email,
    companionId,
    invitedByParentId,
    inviteeName,
  }: {
    email: string;
    companionId: string;
    invitedByParentId: string;
    inviteeName?: string;
  }) {
    if (!email) {
      throw new CoParentInviteServiceError("Email is required.", 400);
    }

    if (!isReadFromPostgres() && !Types.ObjectId.isValid(companionId)) {
      throw new CoParentInviteServiceError("Invalid companionId.", 400);
    }

    if (!isReadFromPostgres() && !Types.ObjectId.isValid(invitedByParentId)) {
      throw new CoParentInviteServiceError("Invalid invitedByParentId.", 400);
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    if (isReadFromPostgres()) {
      await prisma.coParentInvite.create({
        data: {
          email: email.toLowerCase(),
          inviteeName: inviteeName ?? undefined,
          companionId,
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
    }

    const doc = (await CoParentInviteModel.create({
      email: email.toLowerCase(),
      companionId: new Types.ObjectId(companionId),
      invitedByParentId: new Types.ObjectId(invitedByParentId),
      inviteToken,
      expiresAt,
      inviteeName,
    })) as CoParentInviteDocumentWithTimestamps;

    if (shouldDualWrite) {
      try {
        await prisma.coParentInvite.create({
          data: {
            id: doc._id.toString(),
            email: email.toLowerCase(),
            inviteeName: inviteeName ?? undefined,
            companionId,
            invitedByParentId,
            inviteToken,
            expiresAt,
            acceptedAt: undefined,
            diclinedAt: undefined,
            consumed: false,
            createdAt: doc.createdAt ?? undefined,
            updatedAt: doc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("CoParentInvite", err);
      }
    }

    return {
      inviteToken,
      expiresAt,
      email: email.toLowerCase(),
      inviteeName: inviteeName?.trim() || null,
    };
  },

  async validateInvite(token: string) {
    if (!token || typeof token !== "string") {
      throw new CoParentInviteServiceError("Invite token is required.", 400);
    }

    if (isReadFromPostgres()) {
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

      const companion = await prisma.companion.findUnique({
        where: { id: invite.companionId },
      });
      if (!companion) {
        throw new CoParentInviteServiceError("Companion not found.", 404);
      }

      const inviterFullName = [inviter.firstName, inviter.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        email: invite.email,
        inviteeName: invite.inviteeName || null,
        expiresAt: invite.expiresAt,
        id: invite.id,
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
      };
    }

    // 1. Find invite
    const invite = await CoParentInviteModel.findOne({ inviteToken: token });

    if (!invite) {
      throw new CoParentInviteServiceError("Invalid invite token.", 404);
    }

    // 2. Check if already consumed
    if (invite.consumed) {
      throw new CoParentInviteServiceError(
        "This invite has already been used.",
        410,
      );
    }

    // 3. Check expiry
    if (invite.expiresAt < new Date()) {
      throw new CoParentInviteServiceError("This invite has expired.", 410);
    }

    // 4. Fetch inviter (Parent)
    const inviter = await ParentModel.findById(invite.invitedByParentId);
    if (!inviter) {
      throw new CoParentInviteServiceError("Inviter parent not found.", 404);
    }

    // 5. Fetch companion
    const companion = await CompanionModel.findById(invite.companionId);
    if (!companion) {
      throw new CoParentInviteServiceError("Companion not found.", 404);
    }

    // 6. Build full name for inviter
    const inviterFullName = [inviter.firstName, inviter.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();

    // 7. Return popup data — EXACT shape needed by mobile app
    return {
      email: invite.email, // invited co-parent email
      inviteeName: invite.inviteeName || null, // optional "John Doe"
      expiresAt: invite.expiresAt,
      id: invite._id.toString(),
      invitedBy: {
        id: inviter._id.toString(),
        firstName: inviter.firstName,
        lastName: inviter.lastName || null,
        fullName: inviterFullName,
        profileImageUrl: inviter.profileImageUrl || null,
      },

      companion: {
        id: companion._id.toString(),
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

    if (isReadFromPostgres()) {
      const invite = await this.validateInvite(token);

      const parentDoc = await ParentService.findByLinkedUserId(authUserId);
      if (!parentDoc) {
        throw new CoParentInviteServiceError(
          "Parent profile not found for this user. Please complete parent setup before accepting invite.",
          404,
        );
      }

      const parentId =
        "id" in parentDoc && typeof parentDoc.id === "string"
          ? parentDoc.id
          : undefined;
      if (!parentId) {
        throw new CoParentInviteServiceError(
          "Parent identifier is invalid.",
          400,
        );
      }

      const existingLink = await prisma.parentCompanion.findFirst({
        where: {
          parentId,
          companionId: invite.companion.id,
          status: { in: ["ACTIVE", "PENDING"] },
        },
        select: { id: true },
      });

      if (existingLink) {
        throw new CoParentInviteServiceError(
          "You are already linked to this companion.",
          409,
        );
      }

      await prisma.parentCompanion.create({
        data: {
          parentId,
          companionId: invite.companion.id,
          role: "CO_PARENT",
          status: "ACTIVE",
          permissions:
            CO_PARENT_PERMISSIONS as unknown as Prisma.InputJsonValue,
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
        companionId: invite.companion.id,
        invitedByParentId: invite.invitedBy.id,
      };
    }

    // 1. Validate invite & fetch necessary records
    const invite = await this.validateInvite(token); // this returns inviter + companion + all info

    const inviteDoc = await CoParentInviteModel.findById(invite.id);

    if (!inviteDoc) {
      throw new CoParentInviteServiceError("Invalid invite", 404);
    }

    // 2. Get parent record of the accepting user
    const parentDoc = await ParentService.findByLinkedUserId(authUserId);

    if (!parentDoc) {
      throw new CoParentInviteServiceError(
        "Parent profile not found for this user. Please complete parent setup before accepting invite.",
        404,
      );
    }

    // 3. Ensure we do not create duplicate link
    const parentMongoId = resolveParentMongoId(parentDoc);

    const existingLink = await ParentCompanionModel.findOne({
      parentId: parentMongoId,
      companionId: invite.companion.id,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existingLink) {
      throw new CoParentInviteServiceError(
        "You are already linked to this companion.",
        409,
      );
    }

    // 4. Create CO_PARENT link (as ACTIVE)
    await ParentCompanionService.linkParent({
      parentId: parentMongoId,
      companionId: new Types.ObjectId(invite.companion.id),
      role: "CO_PARENT",
      status: "ACTIVE",
      invitedByParentId: new Types.ObjectId(invite.invitedBy.id),
      permissionsOverride: undefined,
    });

    // 5. Mark invite consumed
    inviteDoc.consumed = true;
    inviteDoc.acceptedAt = new Date();
    await inviteDoc.save();

    if (shouldDualWrite) {
      try {
        await prisma.coParentInvite.updateMany({
          where: { id: inviteDoc._id.toString() },
          data: {
            consumed: true,
            acceptedAt: inviteDoc.acceptedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("CoParentInvite accept", err);
      }
    }

    const parentId =
      "id" in parentDoc && typeof parentDoc.id === "string"
        ? parentDoc.id
        : resolveParentMongoId(parentDoc).toString();

    return {
      message: "Invite accepted successfully.",
      parentId,
      companionId: invite.companion.id,
      invitedByParentId: invite.invitedBy.id,
    };
  },

  async declineInvite(token: string) {
    if (!token || typeof token !== "string") {
      throw new CoParentInviteServiceError("Invite token is required.", 400);
    }

    if (isReadFromPostgres()) {
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
        companionId: updated.companionId,
        invitedByParentId: updated.invitedByParentId,
      };
    }

    // Load invite
    const invite = await CoParentInviteModel.findOne({ inviteToken: token });

    if (!invite) {
      throw new CoParentInviteServiceError("Invalid invite token.", 404);
    }

    // If already consumed (accepted or declined) — it's final
    if (invite.consumed) {
      throw new CoParentInviteServiceError(
        "This invite has already been used.",
        410,
      );
    }

    // Expired invites can still be declined (optional choice)
    // But typically return an error:
    if (invite.expiresAt < new Date()) {
      throw new CoParentInviteServiceError("This invite has expired.", 410);
    }

    // Mark invite as consumed — finalized
    invite.consumed = true;
    invite.diclinedAt = new Date();
    await invite.save();

    if (shouldDualWrite) {
      try {
        await prisma.coParentInvite.updateMany({
          where: { id: invite._id.toString() },
          data: {
            consumed: true,
            diclinedAt: invite.diclinedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("CoParentInvite decline", err);
      }
    }

    return {
      message: "Invite declined successfully.",
      email: invite.email,
      companionId: invite.companionId.toString(),
      invitedByParentId: invite.invitedByParentId.toString(),
    };
  },

  async getPendingInvitesForEmail(email: string) {
    if (!email || typeof email !== "string") {
      throw new CoParentInviteServiceError("Email is required.", 400);
    }

    const now = new Date();

    if (isReadFromPostgres()) {
      const inviteDocs = await prisma.coParentInvite.findMany({
        where: {
          email: email.toLowerCase(),
          consumed: false,
          expiresAt: { gt: now },
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

        const companion = await prisma.companion.findUnique({
          where: { id: invite.companionId },
        });
        if (!companion) continue;

        const inviterFullName = [inviter.firstName, inviter.lastName]
          .filter(Boolean)
          .join(" ")
          .trim();

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
    }

    // Fetch all pending + non-expired invites
    const inviteDocs = await CoParentInviteModel.find({
      email: email.toLowerCase(),
      consumed: false,
      expiresAt: { $gt: now },
    }).lean();

    if (inviteDocs.length === 0) {
      return { pendingInvites: [] };
    }

    const results = [];

    for (const invite of inviteDocs) {
      // Fetch inviter
      const inviter = await ParentModel.findById(
        invite.invitedByParentId,
      ).lean();
      if (!inviter) {
        // Skip invites with invalid inviter
        continue;
      }

      // Fetch companion
      const companion = await CompanionModel.findById(
        invite.companionId,
      ).lean();
      if (!companion) {
        // Also skip if companion does not exist anymore
        continue;
      }

      const inviterFullName = [inviter.firstName, inviter.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      results.push({
        token: invite.inviteToken,
        email: invite.email,
        inviteeName: invite.inviteeName || null,
        expiresAt: invite.expiresAt,

        invitedBy: {
          id: inviter._id.toString(),
          firstName: inviter.firstName,
          lastName: inviter.lastName || null,
          fullName: inviterFullName,
          profileImageUrl: inviter.profileImageUrl || null,
        },

        companion: {
          id: companion._id.toString(),
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
