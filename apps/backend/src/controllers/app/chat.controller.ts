// src/controllers/chat.controller.ts
import { Request, Response } from "express";
import { ChatService, ChatServiceError } from "src/services/chat.service";
import ChatSessionModel from "src/models/chatSession";
import { AuthenticatedRequest } from "src/middlewares/auth";
import logger from "src/utils/logger";
import { AuthUserMobileService } from "src/services/authUserMobile.service";

const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers["x-user-id"];

  if (typeof headerUserId === "string" && headerUserId.trim()) {
    return headerUserId;
  }

  return authReq.userId;
};

const getObjectBody = (req: Request): Record<string, unknown> =>
  typeof req.body === "object" && req.body ? (req.body as Record<string, unknown>) : {};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const getStringArray = (value: unknown): string[] | undefined =>
  isStringArray(value) ? value : undefined;

export const ChatController = {

  async generateToken(req: Request, res: Response) {
    try {
      const providerUserId = resolveUserIdFromRequest(req);
      if (!providerUserId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const authUser =
        await AuthUserMobileService.getByProviderUserId(providerUserId);

      if (!authUser?.parentId) {
        return res
          .status(404)
          .json({ message: "User not linked to parent account" });
      }

      return res
        .status(200)
        .json(ChatService.generateToken(authUser.parentId.toString()));
    } catch (err) {
      logger.error("Generate token failed", err);
      return res.status(500).json({ message: "Token generation failed" });
    }
  },

  generateTokenForPMS(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      return res.status(200).json(ChatService.generateToken(userId));
    } catch (err) {
      logger.error("Generate PMS token failed", err);
      return res.status(500).json({ message: "Token generation failed" });
    }
  },

  async ensureAppointmentSession(req: Request, res: Response) {
    try {
      const { appointmentId } = req.params;
      if (!appointmentId) {
        return res.status(400).json({ message: "appointmentId required" });
      }

      const session =
        await ChatService.ensureAppointmentChat(appointmentId);

      return res.status(200).json(session);
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Ensure appointment session failed", err);
      return res.status(500).json({ message: "Failed to ensure session" });
    }
  },

  async createOrgDirectChat(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const body = getObjectBody(req);
      const organisationId =
        typeof body.organisationId === "string" ? body.organisationId : undefined;
      const otherUserId =
        typeof body.otherUserId === "string" ? body.otherUserId : undefined;

      if (!userId || !organisationId || !otherUserId) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const session = await ChatService.createOrgDirectChat(
        organisationId,
        userId,
        otherUserId,
      );

      return res.status(201).json(session);
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Create org direct chat failed", err);
      return res.status(500).json({ message: "Failed to create chat" });
    }
  },

  async createOrgGroupChat(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const body = getObjectBody(req);
      const organisationId =
        typeof body.organisationId === "string" ? body.organisationId : undefined;
      const title = typeof body.title === "string" ? body.title : undefined;
      const memberIds = getStringArray(body.memberIds as string[]);
      const isPrivate =
        typeof body.isPrivate === "boolean" ? body.isPrivate : undefined;

      if (!userId || !organisationId || !title || !Array.isArray(memberIds)) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const session = await ChatService.createOrgGroupChat({
        organisationId,
        createdBy: userId,
        title,
        memberIds,
        isPrivate,
      });

      return res.status(201).json(session);
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Create org group chat failed", err);
      return res.status(500).json({ message: "Failed to create group chat" });
    }
  },

  async openChat(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const { sessionId } = req.params;

      if (!userId || !sessionId) {
        return res.status(400).json({ message: "Invalid request" });
      }

      const data = await ChatService.openChatBySessionId(
        sessionId,
        userId,
      );

      return res.status(200).json(data);
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Open chat failed", err);
      return res.status(500).json({ message: "Failed to open chat" });
    }
  },

  async listMySessions(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const organisationId = req.params.organisationId;
      if (!organisationId) {
        return res.status(400).json({ message: "organisationId required" });
      }

      const sessions = await ChatSessionModel.find({
        organisationId,
        members: userId,
        status: { $ne: "CLOSED" },
      })
        .sort({ updatedAt: -1 })
        .lean();

      return res.status(200).json(sessions);
    } catch (err) {
      logger.error("List sessions failed", err);
      return res.status(500).json({ message: "Failed to list sessions" });
    }
  },

  async closeSession(req: Request, res: Response) {
    try {
      const { sessionId } = req.params;
      if (!sessionId) {
        return res.status(400).json({ message: "sessionId required" });
      }

      await ChatService.closeSession(sessionId);
      return res.status(200).json({ message: "Chat closed successfully" });
    } catch (err) {
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error("Close chat failed", err);
      return res.status(500).json({ message: "Failed to close chat" });
    }
  },

  async addGroupMembers(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const { sessionId } = req.params;
      const body = getObjectBody(req);
      const memberIds = getStringArray(body.memberIds);

      if (!userId || !sessionId || !memberIds) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const session = await ChatService.addMembersToGroup(
        sessionId,
        userId,
        memberIds,
      );

      return res.status(200).json(session);
    } catch (err) {
      logger.error("Add group members failed", err);
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return res.status(500).json({ message: "Failed to add members" });
    }
  },

  async removeGroupMembers(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const { sessionId } = req.params;
      const body = getObjectBody(req);
      const memberIds = getStringArray(body.memberIds);

      if (!userId || !sessionId || !memberIds) {
        return res.status(400).json({ message: "Invalid payload" });
      }

      const session = await ChatService.removeMembersFromGroup(
        sessionId,
        userId,
        memberIds,
      );

      return res.status(200).json(session);
    } catch (err) {
      logger.error("Remove group members failed", err);
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return res.status(500).json({ message: "Failed to remove members" });
    }
  },

  async updateGroup(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const { sessionId } = req.params;
      if (!userId || !sessionId) {
        return res.status(400).json({ message: "Invalid request" });
      }
      const body = getObjectBody(req);
      const title = typeof body.title === "string" ? body.title : undefined;
      const isPrivate =
        typeof body.isPrivate === "boolean" ? body.isPrivate : undefined;

      const session = await ChatService.updateGroup(
        sessionId,
        userId,
        { title, isPrivate },
      );

      return res.status(200).json(session);
    } catch (err) {
      logger.error("Update group failed", err);
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return res.status(500).json({ message: "Failed to update group" });
    }
  },

  async deleteGroup(req: Request, res: Response) {
    try {
      const userId = resolveUserIdFromRequest(req);
      const { sessionId } = req.params;

      await ChatService.deleteGroup(sessionId, userId!);

      return res
        .status(200)
        .json({ message: "Group deleted successfully" });
    } catch (err) {
      logger.error("Delete group failed", err);
      if (err instanceof ChatServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      return res.status(500).json({ message: "Failed to delete group" });
    }
  },
};
