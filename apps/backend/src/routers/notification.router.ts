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

// Archive notification (removes it from the owner's list without deleting it)
notificationRouter.post(
  "/mobile/:notificationId/archive",
  requireMobileAuth,
  NotificationController.archive,
);

export default notificationRouter;
