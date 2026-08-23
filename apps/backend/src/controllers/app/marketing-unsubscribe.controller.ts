import type { Request, Response } from "express";
import { z } from "zod";
import {
  InvalidMarketingUnsubscribeTokenError,
  MarketingUnsubscribeConfigError,
  readMarketingUnsubscribeToken,
  unsubscribeMarketingEmail,
} from "src/services/marketing-unsubscribe.service";
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
 * GET confirms and mutates nothing.
 *
 * Mail providers, link scanners and security products fetch every URL in a
 * delivered message before a human sees it. While GET performed the
 * unsubscribe, merely delivering a marketing email could set `UnsubscribeAll`
 * on the recipient's SES contact and silently stop all further marketing mail.
 * The state change now happens only on POST, which those scanners do not issue.
 * This is the same reason RFC 8058 one-click unsubscribe is specified as a POST.
 */
const confirmPage = (token: string) =>
  page(
    "Unsubscribe",
    `<h1>Unsubscribe from marketing emails?</h1>
<p>This stops marketing emails. Transactional messages about your account, such as appointment confirmations, are unaffected.</p>
<form method="POST">
  <input type="hidden" name="token" value="${escapeHtml(token)}" />
  <button type="submit">Yes, unsubscribe me</button>
</form>`,
  );

const successPage = page(
  "Unsubscribed",
  `<h1>You have been unsubscribed</h1>
<p>You will no longer receive marketing emails from us. Transactional messages about your account are unaffected.</p>`,
);

const handleError = (error: unknown, res: Response): Response => {
  if (
    error instanceof z.ZodError ||
    error instanceof InvalidMarketingUnsubscribeTokenError
  ) {
    return res.status(400).json({ message: "Invalid unsubscribe link." });
  }
  if (error instanceof MarketingUnsubscribeConfigError) {
    logger.error("Marketing unsubscribe configuration is invalid.", { error });
  } else {
    logger.error("Failed to unsubscribe SES marketing contact.", { error });
  }
  return res.status(500).json({ message: "Unable to unsubscribe right now." });
};

export const MarketingUnsubscribeController = {
  // Not async: this handler only reads and renders. Having no await is the point
  // rather than an oversight.
  confirm(this: void, req: Request, res: Response): Response {
    try {
      const { token } = UnsubscribeQuerySchema.parse(req.query);
      // Validate the token so a broken link fails here rather than after the
      // recipient has clicked through, but do not write anything.
      readMarketingUnsubscribeToken(token);
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
      const body = req.body as { token?: unknown } | undefined;
      const source = typeof body?.token === "string" ? body : req.query;
      const { token } = UnsubscribeQuerySchema.parse(source);
      await unsubscribeMarketingEmail(token);

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
