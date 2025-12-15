import { Request, Response } from "express";
import { DeviceTokenService } from "../../services/deviceToken.service";
import logger from "src/utils/logger";

type RegisterDeviceTokenBody = {
  userId: string;
  deviceToken: string;
  platform: "ios" | "android";
};

type UnregisterDeviceTokenBody = {
  deviceToken: string;
};

export class DeviceTokenController {
  static async registerDeviceToken(
    this: void,
    req: Request<unknown, unknown, RegisterDeviceTokenBody>,
    res: Response,
  ) {
    const { userId, deviceToken, platform } = req.body;

    if (
      typeof userId !== "string" ||
      typeof deviceToken !== "string" ||
      (platform !== "ios" && platform !== "android")
    ) {
      return res.status(400).json({ message: "Invalid device token payload." });
    }

    try {
      await DeviceTokenService.registerToken(userId, deviceToken, platform);
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
      await DeviceTokenService.removeToken(deviceToken);
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
