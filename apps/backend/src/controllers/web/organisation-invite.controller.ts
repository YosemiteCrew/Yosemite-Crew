import type { Request, Response } from "express";

import logger from "../../utils/logger";
import {
  OrganisationInviteService,
  OrganisationInviteServiceError,
  type CreateInvitePayload,
} from "../../services/organisation-invite.service";
import type { AuthenticatedRequest } from "../../middlewares/auth";

type CreateInviteBody = Omit<
  CreateInvitePayload,
  "organisationId" | "invitedByUserId"
> & {
  departmentId?: string;
  inviteeEmail?: string;
  inviteeName?: string;
  role?: string;
  employmentType?: CreateInvitePayload["employmentType"];
};

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const headerUserId = req.headers["x-user-id"];

  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId;
  }

  const authRequest = req as AuthenticatedRequest;
  if (typeof authRequest.userId === "string" && authRequest.userId.trim()) {
    return authRequest.userId;
  }

  const authUserId = authRequest.userId;
  return typeof authUserId === "string" ? authUserId : undefined;
};

const resolveUserEmailFromRequest = (req: Request): string | undefined => {
  const headerEmail = req.headers["x-user-email"];

  if (typeof headerEmail === "string" && headerEmail.trim()) {
    return headerEmail;
  }

  const authRequest = req as AuthenticatedRequest;
  const authEmail = authRequest.auth?.email;

  return typeof authEmail === "string" ? authEmail : undefined;
};

export const OrganisationInviteController = {
  createInvite: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;
      const invitedByUserId = resolveUserIdFromRequest(req);

      if (!organisationId) {
        res
          .status(400)
          .json({ message: "Organisation identifier is required." });
        return;
      }

      if (!invitedByUserId) {
        res.status(401).json({ message: "Inviter identity missing." });
        return;
      }

      const body = req.body as CreateInviteBody;

      const invite = await OrganisationInviteService.createInvite({
        organisationId,
        invitedByUserId,
        departmentId: body.departmentId ?? "",
        inviteeEmail: body.inviteeEmail ?? "",
        inviteeName: body.inviteeName,
        role: body.role ?? "",
        employmentType: body.employmentType,
      });

      res.status(201).json(invite);
    } catch (error) {
      if (error instanceof OrganisationInviteServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to create organisation invite.", error);
      res
        .status(500)
        .json({ message: "Unable to create organisation invite." });
    }
  },

  listOrganisationInvites: async (req: Request, res: Response) => {
    try {
      const { organisationId } = req.params;

      if (!organisationId) {
        res
          .status(400)
          .json({ message: "Organisation identifier is required." });
        return;
      }

      const invites =
        await OrganisationInviteService.listOrganisationInvites(organisationId);
      res.status(200).json(invites);
    } catch (error) {
      if (error instanceof OrganisationInviteServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }
      logger.error("Failed to list organisation invites.", error);
      res.status(500).json({ message: "Unable to list organisation invites." });
    }
  },

  acceptInvite: async (req: Request, res: Response) => {
    try {
      const { token } = req.params;
      const userId = resolveUserIdFromRequest(req);
      const userEmail = resolveUserEmailFromRequest(req);

      if (!token) {
        res.status(400).json({ message: "Invite token is required." });
        return;
      }
      if (!userId || !userEmail) {
        res
          .status(401)
          .json({ message: "Authenticated user information is required." });
        return;
      }

      const invite = await OrganisationInviteService.acceptInvite({
        token,
        userId,
        userEmail,
      });

      res.status(200).json(invite);
    } catch (error) {
      if (error instanceof OrganisationInviteServiceError) {
        res.status(error.statusCode).json({ message: error.message });
        return;
      }

      logger.error("Failed to accept organisation invite.", error);
      res
        .status(500)
        .json({ message: "Unable to accept organisation invite." });
    }
  },
};
