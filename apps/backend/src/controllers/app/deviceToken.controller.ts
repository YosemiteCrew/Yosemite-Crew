import {Request, Response} from "express";
import { DeviceTokenService } from "../../services/deviceToken.service";
import logger from "src/utils/logger";

export class DeviceTokenController {
  static async registerDeviceToken(req: Request, res: Response) {
    const { userId, deviceToken } = req.body;
    try {
      await DeviceTokenService.registerToken(userId, deviceToken, req.body.platform);
      res.status(200).json({ message: "Device token registered successfully." });
    } catch (error) {
      logger.error(`Error registering device token: ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({ message: "Failed to register device token." });
    }
  }

  static async unregisterDeviceToken(req: Request, res: Response) {
    const { deviceToken } = req.body;
    try {
      await DeviceTokenService.removeToken(deviceToken);
      res.status(200).json({ message: "Device token unregistered successfully." });
    } catch (error) {
      logger.error(`Error unregistering device token: ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({ message: "Failed to unregister device token." });
    }
  }
}   