import { Router } from "express";
import { ChatController } from "../controllers/app/chat.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";

export const chatRouter = Router();

/* ------------------------------ MOBILE ---------------------------------- */

chatRouter.post("/mobile/token", requireMobileAuth, (req, res) =>
  ChatController.generateToken(req, res),
);

chatRouter.post(
  "/mobile/appointments/:appointmentId",
  requireMobileAuth,
  (req, res) => ChatController.ensureAppointmentSession(req, res),
);

chatRouter.post(
  "/mobile/sessions/:sessionId/open",
  requireMobileAuth,
  (req, res) => ChatController.openChat(req, res),
);

chatRouter.get("/mobile/sessions", requireMobileAuth, (req, res) =>
  ChatController.listMySessions(req, res),
);

/* ------------------------------- PMS ------------------------------------ */

chatRouter.post("/pms/token", requireWebAuth, (req, res) =>
  ChatController.generateTokenForPMS(req, res),
);

chatRouter.post(
  "/pms/appointments/:appointmentId",
  requireWebAuth,
  (req, res) => ChatController.ensureAppointmentSession(req, res),
);

chatRouter.post("/pms/org/direct", requireWebAuth, (req, res) =>
  ChatController.createOrgDirectChat(req, res),
);

chatRouter.post("/pms/org/group", requireWebAuth, (req, res) =>
  ChatController.createOrgGroupChat(req, res),
);

chatRouter.get("/pms/network/colleagues", requireWebAuth, (req, res) =>
  ChatController.searchNetworkColleagues(req, res),
);

chatRouter.post("/pms/network/direct", requireWebAuth, (req, res) =>
  ChatController.createNetworkDirectChat(req, res),
);

chatRouter.post("/pms/sessions/:sessionId/open", requireWebAuth, (req, res) =>
  ChatController.openChat(req, res),
);

chatRouter.get("/pms/sessions/:organisationId", requireWebAuth, (req, res) =>
  ChatController.listMySessions(req, res),
);

chatRouter.post("/pms/sessions/:sessionId/close", requireWebAuth, (req, res) =>
  ChatController.closeSession(req, res),
);

chatRouter.post(
  "/pms/groups/:sessionId/members/add",
  requireWebAuth,
  (req, res) => ChatController.addGroupMembers(req, res),
);

chatRouter.post(
  "/pms/groups/:sessionId/members/remove",
  requireWebAuth,
  (req, res) => ChatController.removeGroupMembers(req, res),
);

chatRouter.patch("/pms/groups/:sessionId", requireWebAuth, (req, res) =>
  ChatController.updateGroup(req, res),
);

chatRouter.delete("/pms/groups/:sessionId", requireWebAuth, (req, res) =>
  ChatController.deleteGroup(req, res),
);

/* ------------------------- SHARED ENTITIES ------------------------------ */

chatRouter.post("/pms/share", requireWebAuth, (req, res) =>
  ChatController.shareEntityToChannel(req, res),
);

chatRouter.get("/pms/share/:channelId", requireWebAuth, (req, res) =>
  ChatController.listSharedEntities(req, res),
);

chatRouter.post("/pms/share/:id/revoke", requireWebAuth, (req, res) =>
  ChatController.revokeSharedEntity(req, res),
);

export default chatRouter;
