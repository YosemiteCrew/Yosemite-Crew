import { Request, Response } from "express";
import logger from "../../utils/logger";
import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../services/companion-organisation.service";
import { AuthenticatedRequest } from "../../middlewares/auth";
import { ParentService } from "src/services/parent.service";
import OrganizationModel, {
  type OrganizationMongo,
} from "src/models/organization";

type OrganisationType = OrganizationMongo["type"];

const ORGANISATION_TYPES = [
  "HOSPITAL",
  "BREEDER",
  "BOARDER",
  "GROOMER",
] as const;

const isOrganisationType = (value: unknown): value is OrganisationType =>
  typeof value === "string" &&
  (ORGANISATION_TYPES as readonly string[]).includes(value);

type LinkPayload = {
  companionId: string;
  organisationId: string;
  organisationType: OrganisationType;
};

type InvitePayload = {
  companionId: string;
  email?: string | null;
  name?: string | null;
  placesId?: string | null;
  organisationType: OrganisationType;
};

type InviteResolutionPayload = {
  token: string;
  organisationId: string;
};

const parseLinkPayload = (body: unknown): LinkPayload | null => {
  if (!body || typeof body !== "object") return null;
  const { companionId, organisationId, organisationType } = body as Record<
    string,
    unknown
  >;

  if (
    typeof companionId !== "string" ||
    typeof organisationId !== "string" ||
    !isOrganisationType(organisationType)
  ) {
    return null;
  }

  return { companionId, organisationId, organisationType };
};

const parseInvitePayload = (body: unknown): InvitePayload | null => {
  if (!body || typeof body !== "object") return null;
  const { companionId, email, name, organisationType, placesId } =
    body as Record<string, unknown>;

  if (
    typeof companionId !== "string" ||
    !isOrganisationType(organisationType)
  ) {
    return null;
  }

  const emailValid = typeof email === "string" && email.trim().length > 0;
  const nameValid = typeof name === "string" && name.trim().length > 0;
  const placesIdValid =
    typeof placesId === "string" && placesId.trim().length > 0;

  // At least one must be present
  if (!emailValid && !nameValid && !placesId) {
    return null;
  }

  return {
    companionId,
    email: emailValid ? email.trim() : undefined,
    name: nameValid ? name.trim() : undefined,
    placesId: placesIdValid ? placesId.trim() : undefined,
    organisationType,
  };
};

const parseInviteResolutionPayload = (
  body: unknown,
): InviteResolutionPayload | null => {
  if (!body || typeof body !== "object") return null;
  const { token, organisationId } = body as Record<string, unknown>;

  if (typeof token !== "string" || typeof organisationId !== "string") {
    return null;
  }

  return { token, organisationId };
};

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") return headerUserId;
  if (authReq.userId) return authReq.userId;
  return authReq.userId;
};

export const CompanionOrganisationController = {
  linkByParent: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId)
        return res.status(401).json({ message: "User not authenticated" });

      const parent = await ParentService.findByLinkedUserId(authUserId);
      if (!parent) return res.status(401).json({ message: "Parent not found" });

      const linkPayload = parseLinkPayload(req.body);
      if (!linkPayload) {
        return res.status(400).json({
          message:
            "companionId, organisationId and organisationType are required.",
        });
      }

      const link = await CompanionOrganisationService.linkByParent({
        parentId: parent._id,
        ...linkPayload,
      });

      return res.status(201).json(link);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed linking organisation by parent", error);
      return res.status(500).json({ message: "Unable to link organisation" });
    }
  },

  linkByPmsUser: async (req: Request, res: Response) => {
    try {
      const pmsUser = resolveUserIdFromRequest(req);
      if (!pmsUser)
        return res.status(401).json({ message: "User not authenticated" });

      const { companionId, organisationId } = req.params;

      if (!companionId || !organisationId) {
        return res
          .status(400)
          .json({ message: "CompanionId and OrganisationId is required." });
      }

      const organisation = await OrganizationModel.findById(organisationId);
      if (!organisation || !isOrganisationType(organisation.type)) {
        return res
          .status(404)
          .json({ message: "Organisation not found or invalid." });
      }

      const link = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: pmsUser,
        companionId,
        organisationId,
        organisationType: organisation.type,
      });

      return res.status(201).json(link);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed linking by PMS user", error);
      return res.status(500).json({ message: "Unable to link organisation" });
    }
  },

  approvePendingLink: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);

      if (!authUserId) {
        return res
          .status(401)
          .json({ message: "Not authenticated as parent." });
      }

      const requestingParent =
        await ParentService.findByLinkedUserId(authUserId);
      if (!requestingParent) {
        return res.status(401).json({ message: "Parent not found." });
      }

      const { linkId } = req.params;

      const updatedLink = await CompanionOrganisationService.parentApproveLink(
        requestingParent._id,
        linkId,
      );

      return res.status(200).json(updatedLink);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to approve link", error);
      return res
        .status(500)
        .json({ message: "Unable to approve organisation link." });
    }
  },

  sendInvite: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId)
        return res.status(401).json({ message: "User not authenticated" });

      const parent = await ParentService.findByLinkedUserId(authUserId);
      if (!parent) return res.status(401).json({ message: "Parent not found" });

      const invitePayload = parseInvitePayload(req.body);
      if (!invitePayload) {
        return res.status(400).json({
          message:
            "companionId, email and organisationType are required to send an invite.",
        });
      }

      await CompanionOrganisationService.sendInvite({
        parentId: parent._id,
        ...invitePayload,
      });

      // You can trigger email sending here
      // await EmailService.sendOrganisationInvite(...)

      return res.status(201).json({
        message: "Invite sent successfully",
      });
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed sending invite", error);
      return res.status(500).json({ message: "Unable to send invite" });
    }
  },

  denyPendingLink: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "Not authenticated." });
      }

      const requestingParent =
        await ParentService.findByLinkedUserId(authUserId);
      if (!requestingParent) {
        return res.status(401).json({ message: "Parent not found." });
      }

      const { linkId } = req.params;

      const updatedLink = await CompanionOrganisationService.parentRejectLink(
        requestingParent._id,
        linkId,
      );

      return res.status(200).json(updatedLink);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to deny link", error);
      return res
        .status(500)
        .json({ message: "Unable to deny organisation link." });
    }
  },

  acceptInvite: async (req: Request, res: Response) => {
    try {
      const payload = parseInviteResolutionPayload(req.body);
      if (!payload) {
        return res.status(400).json({
          message: "token and organisationId are required to accept invite.",
        });
      }

      const updated = await CompanionOrganisationService.acceptInvite({
        token: payload.token,
        organisationId: payload.organisationId,
      });

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed accepting invite", error);
      return res.status(500).json({ message: "Unable to accept invite" });
    }
  },

  rejectInvite: async (req: Request, res: Response) => {
    try {
      const payload = parseInviteResolutionPayload(req.body);
      if (!payload) {
        return res.status(400).json({
          message: "token and organisationId are required to reject invite.",
        });
      }

      await CompanionOrganisationService.rejectInvite({
        token: payload.token,
        organisationId: payload.organisationId,
      });

      return res.status(200).json({ message: "Invite rejected successfully." });
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed rejecting invite", error);
      return res.status(500).json({ message: "Unable to reject invite" });
    }
  },

  revokeLink: async (req: Request, res: Response) => {
    try {
      const { linkId } = req.params;

      const updated = await CompanionOrganisationService.revokeLink(linkId);

      return res.status(200).json(updated);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to revoke organisation link", error);
      return res.status(500).json({ message: "Unable to revoke link" });
    }
  },

  getLinksForCompanion: async (req: Request, res: Response) => {
    try {
      const { companionId } = req.params;

      const links =
        await CompanionOrganisationService.getLinksForCompanion(companionId);

      return res.status(200).json(links);
    } catch (error) {
      logger.error("Failed fetching companion links", error);
      return res.status(500).json({ message: "Unable to fetch links" });
    }
  },

  getLinksForOrganisation: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      const links =
        await CompanionOrganisationService.getLinksForOrganisation(
          organisationId,
        );

      return res.status(200).json(links);
    } catch (error) {
      logger.error("Failed fetching organisation links", error);
      return res.status(500).json({ message: "Unable to fetch links" });
    }
  },

  getLinksForCompanionByOrganisationType: async (
    req: Request,
    res: Response,
  ) => {
    try {
      const { companionId } = req.params;
      const { type } = req.query;

      if (!companionId) {
        return res.status(400).json({ message: "Companion ID is required." });
      }

      if (!type || !isOrganisationType(type)) {
        return res
          .status(400)
          .json({ message: "Valid organisationType is required." });
      }

      const links =
        await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          companionId,
          type,
        );

      return res.status(200).json(links);
    } catch (error) {
      if (error instanceof CompanionOrganisationServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error(
        "Failed fetching companion links by organisation type",
        error,
      );
      return res
        .status(500)
        .json({ message: "Unable to fetch companion links." });
    }
  },
};
