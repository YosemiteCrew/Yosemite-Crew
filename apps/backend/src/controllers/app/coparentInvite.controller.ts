import { Request, Response } from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { ParentService } from "src/services/parent.service";
import {
  CoParentInviteService,
  CoParentInviteServiceError,
} from "src/services/coparentInvite.service";
import logger from "src/utils/logger";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

type SendInviteBody = {
  email?: string;
  companionId?: string;
  inviteeName?: string;
};

type TokenBody = {
  token?: string;
};

// Resolve UserID
const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authRequest = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];
  if (typeof headerUserId === "string") {
    return headerUserId;
  }
  return Array.isArray(headerUserId) ? headerUserId[0] : authRequest.userId;
};

export const CoParentInviteController = {
  sendInvite: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);

      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const { email, companionId, inviteeName } = req.body as SendInviteBody;

      if (!email || !companionId || !inviteeName) {
        return res.status(400).json({
          message: "Email and companionId and InviteeName are required.",
        });
      }

      const inviterParent = await ParentService.findByLinkedUserId(authUserId);
      if (!inviterParent) {
        return res
          .status(400)
          .json({ message: "Inviter must complete parent profile first." });
      }

      await CoParentInviteService.sendInvite({
        email,
        companionId,
        invitedByParentId: inviterParent._id.toString(),
        inviteeName,
      });

      return res.status(201).json({
        message: "Invite created successfully.",
      });
    } catch (error) {
      if (error instanceof CoParentInviteServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to send co-parent invite", error);
      return res.status(500).json({ message: "Unable to send invite." });
    }
  },

  validateInvite: async (req: Request, res: Response) => {
    try {
      const token = req.query.token as string;

      if (!token) {
        return res.status(400).json({ message: "Invite token is required." });
      }

      const data = await CoParentInviteService.validateInvite(token);
      return res.status(200).json(data);
    } catch (error) {
      if (error instanceof CoParentInviteServiceError)
        return res.status(error.statusCode).json({ message: error.message });

      logger.error("Failed to validate invite", error);
      return res.status(500).json({ message: "Unable to validate invite." });
    }
  },

  acceptInvite: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);

      if (!authUserId) {
        return res.status(401).json({ message: "Authentication required." });
      }

      const { token } = req.body as TokenBody;
      if (!token) {
        return res.status(400).json({ message: "Invite token is required." });
      }

      const result = await CoParentInviteService.acceptInvite(
        token,
        authUserId,
      );
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof CoParentInviteServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to accept invite", error);
      return res.status(500).json({ message: "Unable to accept invite." });
    }
  },

  declineInvite: async (req: Request, res: Response) => {
    try {
      const { token } = req.body as TokenBody;

      if (!token) {
        return res.status(400).json({ message: "Invite token is required." });
      }

      const result = await CoParentInviteService.declineInvite(token);
      return res.status(200).json(result);
    } catch (error) {
      if (error instanceof CoParentInviteServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to decline invite", error);
      return res.status(500).json({ message: "Unable to decline invite." });
    }
  },

  getPendingInvites: async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(400).json({ message: "Authentication required." });
      }

      const authUserMobile =
        await AuthUserMobileService.getByProviderUserId(authUserId);

      if (!authUserMobile?.email) {
        return res.status(404).json({ message: "User email not found." });
      }

      const data = await CoParentInviteService.getPendingInvitesForEmail(
        authUserMobile.email,
      );
      return res.status(200).json(data);
    } catch (error) {
      if (error instanceof CoParentInviteServiceError) {
        return res.status(error.statusCode).json({ message: error.message });
      }

      logger.error("Failed to get pending invites", error);
      return res
        .status(500)
        .json({ message: "Unable to fetch pending invites." });
    }
  },
};
