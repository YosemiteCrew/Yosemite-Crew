import { Router } from "express";
import { ChatController } from "../controllers/app/chat.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withAppointmentOrgPermissions,
} from "src/middlewares/rbac";
import {
  requireCompanionPermissionForResource,
  resolveAppointmentCompanion,
} from "src/middlewares/companion-access";

export const chatRouter = Router();

/* ------------------------------ MOBILE ---------------------------------- */

chatRouter.post("/mobile/token", requireMobileAuth, (req, res) =>
  ChatController.generateToken(req, res),
);

// A parent opens the chat for an appointment of a companion they may chat
// with the vet about.
chatRouter.post(
  "/mobile/appointments/:appointmentId",
  requireMobileAuth,
  requireCompanionPermissionForResource(
    "chatWithVet",
    resolveAppointmentCompanion,
  ),
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

// Staff open the chat for an appointment of their own organisation.
chatRouter.post(
  "/pms/appointments/:appointmentId",
  requireWebAuth,
  withAppointmentOrgPermissions({ hideFromNonMembers: true }),
  requirePermission(["appointments:view:any", "appointments:view:own"]),
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
