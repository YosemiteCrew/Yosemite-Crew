import type { NextFunction, Request, Response } from "express";
import { timingSafeEqual } from "node:crypto";

const BACKFILL_KEY = process.env.YOSEMITE_BACKFILL_KEY;

/**
 * Middleware that validates the backfill shared secret.
 * The key is compared in constant time to prevent timing attacks.
 * If no key is configured, the endpoint is disabled.
 */
export const requireBackfillKey = (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (!BACKFILL_KEY) {
    res.status(503).json({
      message: "Backfill endpoint is not configured",
      code: "BACKFILL_NOT_CONFIGURED",
    });
    return;
  }

  const presentedKey = req.header("x-backfill-key");
  if (!presentedKey) {
    res
      .status(401)
      .json({ message: "Unauthorized", code: "MISSING_BACKFILL_KEY" });
    return;
  }

  const presented = Buffer.from(presentedKey);
  const expected = Buffer.from(BACKFILL_KEY);
  if (
    presented.length !== expected.length ||
    !timingSafeEqual(presented, expected)
  ) {
    res
      .status(401)
      .json({ message: "Unauthorized", code: "INVALID_BACKFILL_KEY" });
    return;
  }

  next();
};
