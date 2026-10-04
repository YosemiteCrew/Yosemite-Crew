import type { Request, Response } from "express";
import logger from "src/utils/logger";
import {
  PracticeWebsiteError,
  PracticeWebsiteService,
} from "src/services/practice-website.service";
import { PublicBookingError } from "src/services/public-booking.service";

/**
 * The published clinic website, for anyone on the internet.
 *
 * Declined lookups get their deliberate status and message; anything else is
 * a flat 500 with no detail.
 */
export const PublicSiteController = {
  getSite: async (req: Request<{ slug: string }>, res: Response) => {
    try {
      const result = await PracticeWebsiteService.getPublicSite(
        req.params.slug,
      );
      if (result.kind === "redirect") {
        return res.status(200).json({ data: { redirectTo: result.slug } });
      }
      return res.status(200).json({ data: result.site });
    } catch (error: unknown) {
      if (
        error instanceof PracticeWebsiteError ||
        error instanceof PublicBookingError
      ) {
        return res.status(error.status).json({ message: error.message });
      }
      logger.error("public getSite error", error);
      return res.status(500).json({ message: "Something went wrong" });
    }
  },
};

export default PublicSiteController;
