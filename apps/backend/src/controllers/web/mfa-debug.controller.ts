import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import { getSessionUserId, createTotpDeviceForUser } from "@yosemite-crew/auth";
import { isLocalDevEnvironment } from "../../utils/local-dev";

function assertLocalDev() {
  if (!isLocalDevEnvironment()) {
    throw new Error(
      "MFA debug endpoints are disabled outside local development",
    );
  }
}

export class MfaDebugController {
  static async createTotpDevice(req: SessionRequest, res: Response) {
    try {
      assertLocalDev();

      const userId = await getSessionUserId(req);

      const result = await createTotpDeviceForUser(userId, "Local dev device");

      return res.status(200).json(result);
    } catch (error) {
      console.error("[MFA Debug] createTotpDevice failed:", error);

      return res.status(500).json({
        status: "ERROR",
        message:
          error instanceof Error
            ? error.message
            : "Failed to create TOTP device",
        error,
      });
    }
  }
}
