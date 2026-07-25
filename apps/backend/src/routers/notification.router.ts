import Router from "express";
import { NotificationController } from "../controllers/app/notification.controller";
import { requireMobileAuth } from "src/middlewares/auth";

export const notificationRouter = Router();

// List notifications for current user
notificationRouter.get(
  "/mobile",
  requireMobileAuth,
  NotificationController.listNotifications,
);

// Mark notification as seen
notificationRouter.post(
  "/mobile/:notificationId/seen",
  requireMobileAuth,
  NotificationController.markAsSeen,
);

export default notificationRouter;
