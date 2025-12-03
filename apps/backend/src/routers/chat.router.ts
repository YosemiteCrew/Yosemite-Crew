import { Router } from "express";
import { ChatController } from "../controllers/app/chat.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

export const chatRouter = Router();

// Generate Stream chat token for current user
chatRouter.post("/mobile/token", authorizeCognitoMobile, ChatController.generateToken);

// Ensure chat session exists for an appointment
chatRouter.post(
  "/mobile/sessions/:appointmentId",
  authorizeCognitoMobile,
  ChatController.ensureSession,
);

chatRouter.get(
  "/mobile/sessions/:appointmentId",
  authorizeCognitoMobile,
  ChatController.getSession,
)

// PMS endpoints
chatRouter.post("/pms/token", authorizeCognito, ChatController.generateToken);

chatRouter.post(
  "/pms/sessions/:appointmentId",
  ChatController.ensureSession,
);

chatRouter.get(
  "/pms/sessions/:appointmentId",
  ChatController.getSession,
);

chatRouter.post(
  "/pms/sessions/:appointmentId/close",
  ChatController.closeSession,
);

export default chatRouter;