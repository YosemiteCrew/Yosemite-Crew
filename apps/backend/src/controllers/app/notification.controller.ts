import { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { NotificationService } from "src/services/notification.service";
import { resolveVerifiedUserId } from "src/utils/request";

/**
 * The id notification rows are keyed by, for the caller of this request.
 *
 * Notifications are written against the mobile user's `parentId`, which is what
 * listNotifications already reads, so every per-notification route has to
 * resolve the same id before it can scope a write to its owner. Writes the 401
 * or 404 itself and returns undefined, so callers bail on a falsy result.
 */
const resolveNotificationOwnerId = async (
  req: Request,
  res: Response,
): Promise<string | undefined> => {
  const authUserId = resolveVerifiedUserId(req);
  if (!authUserId) {
    res.status(401).json({ message: "Not authenticated: userId is missing." });
    return undefined;
  }

  const authUser = await AuthUserMobileService.getByProviderUserId(authUserId);
  const ownerId = authUser?.parentId?.toString();
  if (!ownerId) {
    res.status(404).json({ message: "User not found." });
    return undefined;
  }

  return ownerId;
};

export const NotificationController = {
  // List notifications for current user
  listNotifications: async (req: Request, res: Response) => {
    try {
      const ownerId = await resolveNotificationOwnerId(req, res);
      if (!ownerId) {
        return res;
      }

      const notifications =
        await NotificationService.listNotificationsForUser(ownerId);
      return res.status(200).json({ notifications });
    } catch (err) {
      console.error("Error listing notifications", err);
      return res.status(500).json({ message: "Failed to list notifications." });
    }
  },

  // Mark notification as seen
  markAsSeen: async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;
      if (!notificationId) {
        return res.status(400).json({ message: "notificationId is required." });
      }

      const ownerId = await resolveNotificationOwnerId(req, res);
      if (!ownerId) {
        return res;
      }

      const updated = await NotificationService.markNotificationAsSeen(
        notificationId,
        ownerId,
      );
      if (updated === 0) {
        return res.status(404).json({ message: "Notification not found." });
      }

      return res.status(200).json({ message: "Notification marked as seen." });
    } catch (err) {
      console.error("Error marking notification as seen", err);
      return res
        .status(500)
        .json({ message: "Failed to mark notification as seen." });
    }
  },

  // Archive notification
  archive: async (req: Request, res: Response) => {
    try {
      const { notificationId } = req.params;
      if (!notificationId) {
        return res.status(400).json({ message: "notificationId is required." });
      }

      const ownerId = await resolveNotificationOwnerId(req, res);
      if (!ownerId) {
        return res;
      }

      const outcome = await NotificationService.archiveNotificationForUser(
        notificationId,
        ownerId,
      );
      if (outcome === "not-found") {
        return res.status(404).json({ message: "Notification not found." });
      }

      return res.status(200).json({ message: "Notification archived." });
    } catch (err) {
      console.error("Error archiving notification", err);
      return res
        .status(500)
        .json({ message: "Failed to archive notification." });
    }
  },
};
