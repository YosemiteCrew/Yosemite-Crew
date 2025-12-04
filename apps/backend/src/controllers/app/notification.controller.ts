import {Request, Response} from "express";
import { AuthenticatedRequest } from "src/middlewares/auth";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { NotificationService } from "src/services/notification.service";


const resolveUserIdFromRequest = (req: Request): string | undefined => {
  const authReq = req as AuthenticatedRequest;
  const headerUserId = req.headers?.["x-user-id"];
  if (typeof headerUserId === "string") return headerUserId;
  if (authReq.userId) return authReq.userId;
  return authReq.userId;
};

export const NotificationController = {

  // List notifications for current user
  listNotifications : async (req: Request, res: Response) => {
    try {
      const authUserId = resolveUserIdFromRequest(req);
      if (!authUserId) {
        return res.status(401).json({ message: "Not authenticated: userId is missing." });
      }
      const authUser = await AuthUserMobileService.getByProviderUserId(authUserId);
      if (!authUser) {
        return res.status(404).json({ message: "User not found." });
      }

      const notifications = await NotificationService.listNotificationsForUser(authUser.parentId?.toString() || "");
      return res.status(200).json({ notifications });
    } catch (err) {
      console.error("Error listing notifications", err);
      return res.status(500).json({ message: "Failed to list notifications." });
    } 
  },

  // Mark notification as seen
  markAsSeen : async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;
      if (!notificationId) {
        return res.status(400).json({ message: "notificationId is required." });
      }

      await NotificationService.markNotificationAsSeen(notificationId);
      return res.status(200).json({ message: "Notification marked as seen." });
    } catch (err) {
      console.error("Error marking notification as seen", err);
      return res.status(500).json({ message: "Failed to mark notification as seen." });
    } 
  },

}