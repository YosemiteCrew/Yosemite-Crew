import { Request, Response } from "express";
import { resolveAuthorizedOrganisationId } from "src/middlewares/authorized-organisation";
import {
  parseKeysetCursor,
  clampPageSize,
} from "src/services/shared/pagination";
import { BillingReviewService } from "src/services/billing-review.service";
import logger from "src/utils/logger";

const LIMIT = { defaultSize: 50, maxSize: 100 };

export const BillingReviewController = {
  async list(this: void, req: Request, res: Response) {
    const organisationId = resolveAuthorizedOrganisationId(
      req,
      res,
      req.params.organisationId,
    );
    if (!organisationId) return;

    const cursor = parseKeysetCursor(req.query.cursor);
    if (cursor === null) {
      return res.status(400).json({ message: "Invalid cursor." });
    }
    const limit = clampPageSize(req.query.limit, LIMIT);

    try {
      const page = await BillingReviewService.list(
        organisationId,
        limit,
        cursor,
      );
      return res.status(200).json({
        data: page.items,
        meta: { nextCursor: page.nextCursor, hasMore: page.hasMore, limit },
        error: null,
      });
    } catch (error) {
      logger.error("Unable to load completed visits for billing review", error);
      return res.status(500).json({ message: "Internal server error" });
    }
  },
};
