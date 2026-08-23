import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";

const UnsubscribeQuerySchema = z.object({
  token: z.string().min(1),
});

export const unsubscribePage = (
  title: string,
  inner: string,
) => `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
<body><main>${inner}</main></body>
</html>`;

type UnsubscribeControllerConfig = {
  /**
   * Validates the token WITHOUT writing anything, so a broken link fails on the
   * confirmation page rather than after the recipient has clicked through.
   */
  readToken: (token: string) => unknown;
  unsubscribe: (token: string) => Promise<unknown>;
  /** Thrown for a token that is malformed, expired or not ours -> 400. */
  InvalidTokenError: new (...args: never[]) => Error;
  /** Thrown when the server is misconfigured -> 500, logged differently. */
  ConfigError: new (...args: never[]) => Error;
  configErrorMessage: string;
  failureMessage: string;
  confirmPage: (token: string) => string;
  successPage: string;
};

/**
 * The two unsubscribe surfaces - care reminders and marketing email - are the
 * same handler over different tokens, services and copy, so they are built
 * from one factory rather than written twice.
 *
 * The GET/POST split is the load-bearing part and belongs here so neither
 * surface can lose it: mail providers, link scanners and security products
 * fetch every URL in a delivered message before a human sees it, so a GET that
 * persisted the opt-out would let mere delivery unsubscribe the recipient. The
 * state change happens only on POST, which those scanners do not issue - the
 * same reason RFC 8058 one-click unsubscribe is specified as a POST.
 */
export const createUnsubscribeController = (
  config: UnsubscribeControllerConfig,
) => {
  const handleError = (error: unknown, res: Response): Response => {
    if (
      error instanceof z.ZodError ||
      error instanceof config.InvalidTokenError
    ) {
      return res.status(400).json({ message: "Invalid unsubscribe link." });
    }
    if (error instanceof config.ConfigError) {
      logger.error(config.configErrorMessage, { error });
    } else {
      logger.error(config.failureMessage, { error });
    }
    return res
      .status(500)
      .json({ message: "Unable to unsubscribe right now." });
  };

  return {
    // Not async: this handler only reads and renders, and having no await is
    // the point rather than an oversight.
    confirm(this: void, req: Request, res: Response): Response {
      try {
        const { token } = UnsubscribeQuerySchema.parse(req.query);
        config.readToken(token);
        return res
          .status(200)
          .set("Content-Type", "text/html; charset=utf-8")
          .send(config.confirmPage(token));
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
        // The token arrives in the form body when the confirmation page posts
        // it, and in the query string for a direct API call.
        const body = req.body as { token?: unknown } | undefined;
        const source = typeof body?.token === "string" ? body : req.query;
        const { token } = UnsubscribeQuerySchema.parse(source);
        await config.unsubscribe(token);

        if (req.accepts(["html", "json"]) === "html") {
          return res
            .status(200)
            .set("Content-Type", "text/html; charset=utf-8")
            .send(config.successPage);
        }
        return res.status(200).json({ message: "Successfully unsubscribed." });
      } catch (error) {
        return handleError(error, res);
      }
    },
  };
};
