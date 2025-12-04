// src/controllers/chat.controller.ts
import { Request, Response } from "express";
import { ChatService, ChatServiceError } from "src/services/chat.service";
import ChatSessionModel from "src/models/chatSession";
import { AuthenticatedRequest } from "src/middlewares/auth"; // adjust path as needed
import logger from "src/utils/logger";

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];

  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId;
  }

  return authReq.userId;
};

export const ChatController = {
  /**
   * Generate Stream chat token for current user
   * POST /chat/token
   */
  generateToken(this: void, req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);

      if (!userId) {
        return res
          .status(401)
          .json({ message: "Not authenticated: userId is missing." });
      }

      const tokenInfo = ChatService.generateToken(userId);
      return res.status(200).json(tokenInfo);
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Error generating chat token", err);
      return res
        .status(500)
        .json({ message: "Failed to generate chat token." });
    }
  },

  /**
   * Ensure chat session exists for an appointment.
   * Creates Stream channel + ChatSession document if needed.
   *
   * POST /chat/sessions/:appointmentId
   */
  async ensureSession(this: void, req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;

      if (!appointmentId) {
        return res.status(400).json({ message: "appointmentId is required." });
      }

      const session = await ChatService.ensureSession(appointmentId);

      return res.status(200).json({
        appointmentId: session.appointmentId,
        channelId: session.channelId,
        organisationId: session.organisationId,
        companionId: session.companionId,
        parentId: session.parentId,
        vetId: session.vetId,
        members: session.members,
        status: session.status,
        allowedFrom: session.allowedFrom,
        allowedUntil: session.allowedUntil,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      });
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Error ensuring chat session", err);
      return res.status(500).json({ message: "Failed to ensure chat session." });
    }
  },

  /**
   * Get chat session details for an appointment (no Stream call, just DB).
   *
   * GET /chat/sessions/:appointmentId
   */
  async getSession(this: void, req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;

      if (!appointmentId) {
        return res.status(400).json({ message: "appointmentId is required." });
      }

      const session = await ChatSessionModel.findOne({ appointmentId }).lean();

      if (!session) {
        return res.status(404).json({ message: "Chat session not found." });
      }

      return res.status(200).json(session);
    } catch (err) {
      logger.error("Error fetching chat session", err);
      return res.status(500).json({ message: "Failed to fetch chat session." });
    }
  },

  /**
   * Close an appointment chat session (freeze channel + mark CLOSED).
   *
   * POST /chat/sessions/:appointmentId/close
   */
  async closeSession(this: void, req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;

      if (!appointmentId) {
        return res.status(400).json({ message: "appointmentId is required." });
      }

      await ChatService.closeSession(appointmentId);

      return res
        .status(200)
        .json({ message: "Chat session closed successfully." });
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Error closing chat session", err);
      return res.status(500).json({ message: "Failed to close chat session." });
    }
  },
};
