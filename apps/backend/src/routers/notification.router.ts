import Router from "express";
import { NotificationController } from "../controllers/app/notification.controller";
import { authorizeCognitoMobile } from "src/middlewares/auth";

export const notificationRouter = Router();

// List notifications for current user
notificationRouter.get(
  "/mobile",
  authorizeCognitoMobile,
  NotificationController.listNotifications,
);

// Mark notification as seen
notificationRouter.post(
  "/mobile/:notificationId/seen",
  authorizeCognitoMobile,
  NotificationController.markAsSeen,
);


export default notificationRouter;