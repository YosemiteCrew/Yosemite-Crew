import { Types } from "mongoose";
import CompanionOrganisationModel, {
  CompanionOrganisationDocument,
} from "../models/companion-organisation";
import { assertSafeString } from "src/utils/sanitize";
import ParentCompanionModel from "src/models/parent-companion";
import CompanionModel from "../models/companion";
import { ParentModel } from "src/models/parent";

export class CompanionOrganisationServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionOrganisationServiceError";
  }
}

const ensureObjectId = (value: string | Types.ObjectId, field: string) => {
  // Reject objects or unexpected input
  if (value instanceof Types.ObjectId) {
    return value;
  }

  if (typeof value !== "string") {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  // Prevent NoSQL injection attempts: disallow $ and .
  if (value.includes("$") || value.includes(".")) {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  // Ensure format is strictly 24 hex chars
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new CompanionOrganisationServiceError(`Invalid ${field}`, 400);
  }

  return new Types.ObjectId(value);
};

export const CompanionOrganisationService = {
  async linkByParent({
    parentId,
    companionId,
    organisationId,
    organisationType,
  }: {
    parentId: Types.ObjectId | string;
    companionId: Types.ObjectId | string;
    organisationId: Types.ObjectId | string;
    organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  }): Promise<CompanionOrganisationDocument> {
    const parent = ensureObjectId(parentId, "parentId");
    const companion = ensureObjectId(companionId, "companionId");
    const org = ensureObjectId(organisationId, "organisationId");

    // Prevent duplicate active links
    const existing = await CompanionOrganisationModel.findOne({
      companionId: companion,
      organisationId: org,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existing) return existing;

    return CompanionOrganisationModel.create({
      companionId: companion,
      organisationId: org,
      linkedByParentId: parent,
      organisationType,
      role: "ORGANISATION",
      status: "ACTIVE",
    });
  },

  async linkByPmsUser({
    pmsUserId,
    companionId,
    organisationId,
    organisationType,
  }: {
    pmsUserId: string;
    companionId: Types.ObjectId | string;
    organisationId: Types.ObjectId | string;
    organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  }): Promise<CompanionOrganisationDocument> {
    const companion = ensureObjectId(companionId, "companionId");
    const org = ensureObjectId(organisationId, "organisationId");

    const existing = await CompanionOrganisationModel.findOne({
      companionId: companion,
      organisationId: org,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existing) return existing;

    return CompanionOrganisationModel.create({
      companionId: companion,
      organisationId: org,
      linkedByPmsUserId: pmsUserId,
      organisationType,
      role: "ORGANISATION",
      status: "PENDING",
    });
  },

  async sendInvite({
    parentId,
    companionId,
    organisationType,
    email,
    name,
  }: {
    parentId: Types.ObjectId | string;
    companionId: Types.ObjectId | string;
    organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
    email?: string | null;
    name?: string | null;
  }): Promise<CompanionOrganisationDocument> {
    if (!email && !name) {
      throw new CompanionOrganisationServiceError(
        "Email required or Name",
        400,
      );
    }

    const parent = ensureObjectId(parentId, "parentId");
    const companion = ensureObjectId(companionId, "companionId");

    const token = crypto.randomUUID();

    return CompanionOrganisationModel.create({
      companionId: companion,
      linkedByParentId: parent,
      invitedViaEmail: email,
      organisationName: name,
      inviteToken: token,
      organisationId: null,
      organisationType,
      role: "ORGANISATION",
      status: "PENDING",
    });
  },

  // Validate Invite Token
  async validateInvite(token: string) {
    if (!token)
      throw new CompanionOrganisationServiceError("Invite token missing", 400);

    const invite = await CompanionOrganisationModel.findOne({
      inviteToken: token,
      status: "PENDING",
    });

    if (!invite)
      throw new CompanionOrganisationServiceError(
        "Invalid or expired invite",
        404,
      );

    return invite;
  },

  // Accept Invite
  async acceptInvite({
    token,
    organisationId,
  }: {
    token: string;
    organisationId: Types.ObjectId | string;
  }): Promise<CompanionOrganisationDocument> {
    const org = ensureObjectId(organisationId, "organisationId");
    token = assertSafeString(token, "token");
    const invite = await CompanionOrganisationModel.findOne({
      inviteToken: token,
      status: "PENDING",
    });

    if (!invite)
      throw new CompanionOrganisationServiceError("Invalid invite token", 404);

    invite.organisationId = org;
    invite.acceptedAt = new Date();
    invite.status = "ACTIVE";
    invite.inviteToken = null;

    await invite.save();

    return invite;
  },

  async rejectInvite({
    token,
    organisationId,
  }: {
    token: string;
    organisationId: Types.ObjectId | string;
  }): Promise<void> {
    const org = ensureObjectId(organisationId, "organisationId");
    token = assertSafeString(token, "token");
    const invite = await CompanionOrganisationModel.findOne({
      inviteToken: token,
      status: "PENDING",
    });

    if (!invite)
      throw new CompanionOrganisationServiceError("Invalid invite token", 404);

    invite.organisationId = org;
    invite.rejectedAt = new Date();
    invite.status = "REVOKED";
    invite.inviteToken = null;

    await invite.save();
  },

  async linkOnCompanionCreatedByPms({
    companionId,
    organisationId,
    pmsUserId,
    organisationType,
  }: {
    companionId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    pmsUserId: string;
    organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  }) {
    return this.linkByPmsUser({
      pmsUserId,
      companionId,
      organisationId,
      organisationType,
    });
  },

  async linkOnAppointmentBooked({
    companionId,
    organisationId,
    organisationType,
  }: {
    companionId: string | Types.ObjectId;
    organisationId: string | Types.ObjectId;
    organisationType: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";
  }) {
    const companion = ensureObjectId(companionId, "companionId");
    const org = ensureObjectId(organisationId, "organisationId");

    const existing = await CompanionOrganisationModel.findOne({
      companionId: companion,
      organisationId: org,
      status: { $in: ["ACTIVE", "PENDING"] },
    });

    if (existing) return existing;

    return CompanionOrganisationModel.create({
      companionId: companion,
      organisationId: org,
      organisationType,
      status: "ACTIVE",
      role: "ORGANISATION",
    });
  },

  async revokeLink(linkId: string | Types.ObjectId) {
    const id = ensureObjectId(linkId, "linkId");

    const link = await CompanionOrganisationModel.findByIdAndUpdate(
      id,
      { status: "REVOKED" },
      { new: true },
    );

    if (!link)
      throw new CompanionOrganisationServiceError("Link not found", 404);

    return link;
  },

  async parentApproveLink(parentId: Types.ObjectId, linkId: string) {
    linkId = assertSafeString(linkId, "linkId");
    const id = ensureObjectId(linkId, "linkId");
    const link = await CompanionOrganisationModel.findOne({
      _id: id,
      linkedByParentId: null, // PMS created it
      status: "PENDING",
    });

    if (!link) {
      throw new CompanionOrganisationServiceError(
        "Pending link not found.",
        404,
      );
    }

    link.status = "ACTIVE";
    link.acceptedAt = new Date();
    link.linkedByParentId = parentId;

    await link.save();

    return link;
  },

  async parentRejectLink(parentId: Types.ObjectId, linkId: string) {
    linkId = assertSafeString(linkId, "linkId");
    const id = ensureObjectId(linkId, "linkId");
    const link = await CompanionOrganisationModel.findOne({
      _id: id,
      status: "PENDING",
    });

    if (!link) {
      throw new CompanionOrganisationServiceError(
        "Pending link not found.",
        404,
      );
    }

    link.status = "REVOKED";
    link.acceptedAt = null;
    link.linkedByParentId = parentId;

    await link.save();

    return link;
  },

  async getLinksForCompanion(companionId: string | Types.ObjectId) {
    const id = ensureObjectId(companionId, "companionId");
    return CompanionOrganisationModel.find({ companionId: id });
  },

  async getLinksForCompanionByOrganisationTye(
    companionId: string | Types.ObjectId,
    type: "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER",
  ) {
    companionId = assertSafeString(companionId, "companionId");
    const id = ensureObjectId(companionId, "companionId");
    const links = await CompanionOrganisationModel.find({
      companionId: id,
      organisationType: type,
      status: { $in: ["ACTIVE", "PENDING"] },
    }).populate(
      "organisationId",
      "name imageURL phoneNo address googlePlacesId",
    );

    const parentComapnionLink = await ParentCompanionModel.findOne({
      companionId: id,
      role: "PRIMARY",
    }).exec();

    const companion = await CompanionModel.findById(id);
    const parent = await ParentModel.findById(parentComapnionLink?.parentId);

    return {
      links,
      parentName: parent?.firstName + " " + parent?.lastName,
      email: parent?.email,
      companionName: companion?.name,
      phoneNumber: parent?.phoneNumber,
    };
  },

  async getLinksForOrganisation(organisationId: string | Types.ObjectId) {
    const id = ensureObjectId(organisationId, "organisationId");
    return CompanionOrganisationModel.find({ organisationId: id });
  },
};
