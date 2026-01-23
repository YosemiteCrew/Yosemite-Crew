import { Router } from "express";
import { ChatController } from "../controllers/app/chat.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

export const chatRouter = Router();

/* ------------------------------ MOBILE ---------------------------------- */

chatRouter.post("/mobile/token", authorizeCognitoMobile, (req, res) =>
  ChatController.generateToken(req, res),
);

chatRouter.post(
  "/mobile/appointments/:appointmentId",
  authorizeCognitoMobile,
  (req, res) => ChatController.ensureAppointmentSession(req, res),
);

chatRouter.post(
  "/mobile/sessions/:sessionId/open",
  authorizeCognitoMobile,
  (req, res) => ChatController.openChat(req, res),
);

chatRouter.get("/mobile/sessions", authorizeCognitoMobile, (req, res) =>
  ChatController.listMySessions(req, res),
);

/* ------------------------------- PMS ------------------------------------ */

chatRouter.post("/pms/token", authorizeCognito, (req, res) =>
  ChatController.generateTokenForPMS(req, res),
);

chatRouter.post(
  "/pms/appointments/:appointmentId",
  authorizeCognito,
  (req, res) => ChatController.ensureAppointmentSession(req, res),
);

chatRouter.post("/pms/org/direct", authorizeCognito, (req, res) =>
  ChatController.createOrgDirectChat(req, res),
);

chatRouter.post("/pms/org/group", authorizeCognito, (req, res) =>
  ChatController.createOrgGroupChat(req, res),
);

chatRouter.post("/pms/sessions/:sessionId/open", authorizeCognito, (req, res) =>
  ChatController.openChat(req, res),
);

chatRouter.get("/pms/sessions/:organisationId", authorizeCognito, (req, res) =>
  ChatController.listMySessions(req, res),
);

chatRouter.post(
  "/pms/sessions/:sessionId/close",
  authorizeCognito,
  (req, res) => ChatController.closeSession(req, res),
);

chatRouter.post(
  "/pms/groups/:sessionId/members/add",
  authorizeCognito,
  (req, res) => ChatController.addGroupMembers(req, res),
);

chatRouter.post(
  "/pms/groups/:sessionId/members/remove",
  authorizeCognito,
  (req, res) => ChatController.removeGroupMembers(req, res),
);

chatRouter.patch("/pms/groups/:sessionId", authorizeCognito, (req, res) =>
  ChatController.updateGroup(req, res),
);

chatRouter.delete("/pms/groups/:sessionId", authorizeCognito, (req, res) =>
  ChatController.deleteGroup(req, res),
);

export default chatRouter;
