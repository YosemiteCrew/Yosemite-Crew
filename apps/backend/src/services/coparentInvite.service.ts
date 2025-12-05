import { randomUUID } from "node:crypto";
import { Types } from "mongoose";

import { CoParentInviteModel } from "../models/coparentInvite";
import { ParentModel } from "src/models/parent";
import CompanionModel from "../models/companion";
import { ParentCompanionService } from "./parent-companion.service";
import { ParentService } from "./parent.service";
import ParentCompanionModel from "src/models/parent-companion";

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

    if (!Types.ObjectId.isValid(companionId)) {
      throw new CoParentInviteServiceError("Invalid companionId.", 400);
    }

    if (!Types.ObjectId.isValid(invitedByParentId)) {
      throw new CoParentInviteServiceError("Invalid invitedByParentId.", 400);
    }

    const inviteToken = randomUUID();
    const expiresAt = new Date(
      Date.now() + INVITE_EXPIRY_HOURS * 60 * 60 * 1000,
    );

    await CoParentInviteModel.create({
      email: email.toLowerCase(),
      companionId: new Types.ObjectId(companionId),
      invitedByParentId: new Types.ObjectId(invitedByParentId),
      inviteToken,
      expiresAt,
      inviteeName,
    });

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
    const existingLink = await ParentCompanionModel.findOne({
      parentId: parentDoc._id,
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
      parentId: parentDoc._id,
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

    return {
      message: "Invite accepted successfully.",
      parentId: parentDoc._id.toString(),
      companionId: invite.companion.id,
      invitedByParentId: invite.invitedBy.id,
    };
  },

  async declineInvite(token: string) {
    if (!token || typeof token !== "string") {
      throw new CoParentInviteServiceError("Invite token is required.", 400);
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
