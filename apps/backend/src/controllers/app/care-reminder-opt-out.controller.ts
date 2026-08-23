import type { Request, Response } from "express";
import { z } from "zod";
import {
  CareReminderOptOutConfigError,
  InvalidCareReminderOptOutTokenError,
  unsubscribeFromCareReminders,
} from "src/services/care-reminder-opt-out.service";
import logger from "src/utils/logger";

const UnsubscribeQuerySchema = z.object({
  token: z.string().min(1),
});

const successPage = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reminders stopped</title></head>
<body><main><h1>You have been unsubscribed</h1><p>You will no longer receive care reminders from this practice. Reminders from any other practice that cares for your companion are unaffected, and your appointment confirmations still apply.</p></main></body>
</html>`;

const handleError = (error: unknown, res: Response): Response => {
  if (
    error instanceof z.ZodError ||
    error instanceof InvalidCareReminderOptOutTokenError
  ) {
    return res.status(400).json({ message: "Invalid unsubscribe link." });
  }
  if (error instanceof CareReminderOptOutConfigError) {
    logger.error("Care reminder opt-out configuration is invalid.", { error });
  } else {
    logger.error("Failed to record care reminder opt-out.", { error });
  }
  return res.status(500).json({ message: "Unable to unsubscribe right now." });
};

export const CareReminderOptOutController = {
  async unsubscribe(
    this: void,
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      const { token } = UnsubscribeQuerySchema.parse(req.query);
      await unsubscribeFromCareReminders(token);

      if (req.method === "GET") {
        return res
          .status(200)
          .set("Content-Type", "text/html; charset=utf-8")
          .send(successPage);
      }
      return res.status(200).json({ message: "Successfully unsubscribed." });
    } catch (error) {
      return handleError(error, res);
    }
  },
};
