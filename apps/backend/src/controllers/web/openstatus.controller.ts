import { Request, Response } from "express";
import crypto from "node:crypto";
import logger from "src/utils/logger";
import {
  OpenStatusService,
  openStatusMonitorEventSchema,
} from "src/services/openstatus.service";

// OpenStatus webhooks are not HMAC-signed. Authentication is done with a
// shared secret sent as a custom header configured on the webhook channel.
const WEBHOOK_SECRET_HEADER = "x-openstatus-webhook-secret";

const isAuthorized = (provided: string | undefined): boolean => {
  const secret = process.env.OPENSTATUS_WEBHOOK_SECRET;
  if (!secret) {
    logger.error(
      "OPENSTATUS_WEBHOOK_SECRET is not configured; rejecting webhook",
    );
    return false;
  }
  if (!provided) return false;

  // Hash both sides to a fixed length so timingSafeEqual never throws on a
  // length mismatch and the comparison stays constant-time.
  const expected = crypto.createHash("sha256").update(secret).digest();
  const actual = crypto.createHash("sha256").update(provided).digest();
  return crypto.timingSafeEqual(expected, actual);
};

export const OpenStatusWebhookController = {
  async handle(req: Request, res: Response) {
    try {
      const header = req.headers[WEBHOOK_SECRET_HEADER];
      const provided = Array.isArray(header) ? header[0] : header;
      if (!isAuthorized(provided)) {
        return res.status(401).end();
      }

      const rawBody = req.body as Buffer;
      let json: unknown;
      try {
        json = JSON.parse(rawBody.toString("utf8"));
      } catch {
        return res.status(400).json({ message: "Invalid JSON" });
      }

      const parsed = openStatusMonitorEventSchema.safeParse(json);
      if (!parsed.success) {
        logger.warn("OpenStatus webhook received an invalid payload", {
          issues: parsed.error.issues,
        });
        return res.status(400).json({ message: "Invalid payload" });
      }

      await OpenStatusService.handleMonitorEvent(parsed.data);
      return res.status(200).json({ received: true });
    } catch (err) {
      logger.error("OpenStatus webhook error", err);
      return res.status(500).json({
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  },
};
