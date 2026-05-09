import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import TOTP from "supertokens-node/recipe/totp";
import { getSessionUserId } from "@yosemite-crew/auth";

function assertLocalDev() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("MFA debug endpoints are disabled in production");
  }
}

export class MfaDebugController {
  static async createTotpDevice(req: SessionRequest, res: Response) {
    try {
      assertLocalDev();

      const userId = getSessionUserId(req);

      const result = await TOTP.createDevice(
        userId,
        undefined,
        "Local dev device",
      );

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
