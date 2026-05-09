import type { Response } from "express";
import type { SessionRequest } from "@yosemite-crew/auth";
import {
  getSessionUserId,
  getMfaStatusForRequest,
  requireTotpForUser,
  removeTotpRequirementForUser,
} from "@yosemite-crew/auth";

export class MfaController {
  static async status(req: SessionRequest, res: Response) {
    try {
      const status = await getMfaStatusForRequest(req);

      return res.status(200).json({
        status: "OK",
        mfa: status,
      });
    } catch {
      return res.status(500).json({
        status: "ERROR",
        message: "Failed to get MFA status",
      });
    }
  }

  static async enableTotp(req: SessionRequest, res: Response) {
    try {
      const userId = getSessionUserId(req);

      await requireTotpForUser(userId);

      const status = await getMfaStatusForRequest(req);

      return res.status(200).json({
        status: "OK",
        mfa: status,
      });
    } catch {
      return res.status(500).json({
        status: "ERROR",
        message: "Failed to enable TOTP",
      });
    }
  }

  static async disableTotp(req: SessionRequest, res: Response) {
    try {
      const userId = getSessionUserId(req);

      await removeTotpRequirementForUser(userId);

      const status = await getMfaStatusForRequest(req);

      return res.status(200).json({
        status: "OK",
        mfa: status,
      });
    } catch {
      return res.status(500).json({
        status: "ERROR",
        message: "Failed to disable TOTP",
      });
    }
  }
}
