import type { Request, Response } from "express";
import { z } from "zod";
import {
  CareReminderOptOutConfigError,
  InvalidCareReminderOptOutTokenError,
  readCareReminderOptOutToken,
  unsubscribeFromCareReminders,
} from "src/services/care-reminder-opt-out.service";
import { escapeHtml } from "src/utils/email-templates";
import logger from "src/utils/logger";

const UnsubscribeQuerySchema = z.object({
  token: z.string().min(1),
});

const page = (title: string, inner: string) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body><main>${inner}</main></body>
</html>`;

/**
 * GET renders a confirmation and mutates nothing.
 *
 * Mail providers, link scanners and security products fetch every URL in a
 * message before a human ever sees it. If GET persisted the opt-out, simply
 * delivering the reminder could unsubscribe the recipient. The state change
 * therefore happens only on POST, which those scanners do not issue - the same
 * reason RFC 8058 one-click unsubscribe is specified as a POST.
 */
const confirmPage = (token: string) =>
  page(
    "Stop care reminders",
    `<h1>Stop receiving care reminders?</h1>
<p>This stops care reminders from this practice only. Reminders from any other practice that cares for your companion are unaffected, and your appointment confirmations still apply.</p>
<form method="POST">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <button type="submit">Yes, stop these reminders</button>
</form>`,
  );

const successPage = page(
  "Reminders stopped",
  `<h1>You have been unsubscribed</h1>
<p>You will no longer receive care reminders from this practice. Reminders from any other practice that cares for your companion are unaffected, and your appointment confirmations still apply.</p>`,
);

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
  // Not async: this handler only reads and renders, and having no await is the
  // point rather than an oversight.
  confirm(this: void, req: Request, res: Response): Response {
    try {
      const { token } = UnsubscribeQuerySchema.parse(req.query);
      // Validate the token so a broken link fails here rather than after the
      // recipient has clicked through, but do not write anything.
      readCareReminderOptOutToken(token);
      return res
        .status(200)
        .set("Content-Type", "text/html; charset=utf-8")
        .send(confirmPage(token));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async unsubscribe(
    this: void,
    req: Request,
    res: Response,
  ): Promise<Response> {
    try {
      // The token arrives in the form body when the confirmation page posts it,
      // and in the query string for a direct API call.
      const source =
        typeof (req.body as { token?: unknown } | undefined)?.token === "string"
          ? (req.body as { token: string })
          : req.query;
      const { token } = UnsubscribeQuerySchema.parse(source);
      await unsubscribeFromCareReminders(token);

      if (req.accepts(["html", "json"]) === "html") {
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
