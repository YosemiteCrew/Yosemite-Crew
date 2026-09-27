import { Request, Response } from "express";
import { DeviceTokenService } from "../../services/deviceToken.service";
import { findParentIdForAuthUser } from "src/services/shared/parent-identity";
import { resolveVerifiedUserId } from "src/utils/request";
import logger from "src/utils/logger";

type RegisterDeviceTokenBody = {
  deviceToken: string;
  platform: "ios" | "android";
};

type UnregisterDeviceTokenBody = {
  deviceToken: string;
};

/**
 * The ids a signed-in caller's devices are registered under. Notifications are
 * addressed to the parent, so a token is stored against the caller's parent
 * record, or against their own account until they have one. Any `userId` in
 * the body is ignored: a device only ever registers for the person signed in
 * on it.
 */
const resolveCallerIds = async (
  req: Request,
): Promise<{ owner: string; all: string[] } | null> => {
  const userId = resolveVerifiedUserId(req);
  if (!userId) return null;
  const parentId = await findParentIdForAuthUser(userId);
  return parentId
    ? { owner: parentId, all: [parentId, userId] }
    : { owner: userId, all: [userId] };
};

export class DeviceTokenController {
  static async registerDeviceToken(
    this: void,
    req: Request<unknown, unknown, RegisterDeviceTokenBody>,
    res: Response,
  ) {
    const { deviceToken, platform } = req.body;

    if (
      typeof deviceToken !== "string" ||
      (platform !== "ios" && platform !== "android")
    ) {
      return res.status(400).json({ message: "Invalid device token payload." });
    }

    try {
      const caller = await resolveCallerIds(req as Request);
      if (!caller) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      await DeviceTokenService.registerToken(
        caller.owner,
        deviceToken,
        platform,
      );
      res
        .status(200)
        .json({ message: "Device token registered successfully." });
    } catch (error) {
      logger.error(
        `Error registering device token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      res.status(500).json({ message: "Failed to register device token." });
    }
  }

  static async unregisterDeviceToken(
    this: void,
    req: Request<unknown, unknown, UnregisterDeviceTokenBody>,
    res: Response,
  ) {
    const { deviceToken } = req.body;

    if (typeof deviceToken !== "string" || !deviceToken.trim()) {
      return res.status(400).json({ message: "Invalid device token payload." });
    }

    try {
      const caller = await resolveCallerIds(req as Request);
      if (!caller) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      await DeviceTokenService.removeTokenForOwners(deviceToken, caller.all);
      res
        .status(200)
        .json({ message: "Device token unregistered successfully." });
    } catch (error) {
      logger.error(
        `Error unregistering device token: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      res.status(500).json({ message: "Failed to unregister device token." });
    }
  }
}
