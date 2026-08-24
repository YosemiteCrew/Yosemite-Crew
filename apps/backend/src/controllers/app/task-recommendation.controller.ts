import type { Request, Response } from "express";
import logger from "src/utils/logger";
import {
  TaskRecommendationError,
  TaskRecommendationService,
} from "src/services/task-recommendation.service";

/**
 * Recommendations are read for ONE companion at a time, by the companion id in
 * the path, so the route can sit behind the same co-parent gate as every other
 * companion-scoped read. Matching happens on the server: the client never holds
 * the rules, so a withdrawn rule stops appearing immediately rather than waiting
 * out mobile adoption.
 */
export const TaskRecommendationController = {
  listForCompanion: async (req: Request, res: Response) => {
    try {
      const { patientId } = req.params;
      const recommendations =
        await TaskRecommendationService.forCompanion(patientId);

      return res.status(200).json({
        recommendations,
        // Sent with every response rather than hard-coded in the app, so the
        // wording can be corrected without a release. The app shows it beside
        // the list; the per-card citation is the substantive part.
        //
        // Deliberately does NOT say "for this breed and age". Not every rule is
        // breed-specific or age-bounded - a species-wide life-stage task matches
        // on neither - and a blanket claim would overstate what triggered the
        // guidance. What each card was actually matched on is in its own
        // `because` block, which is the honest place for it.
        disclaimer:
          "These are general husbandry suggestions, not a diagnosis or advice about your companion specifically. Each one shows what it was matched on and where it comes from. Your vet knows your companion; ask them before acting on anything here.",
      });
    } catch (error) {
      if (error instanceof TaskRecommendationError) {
        return res.status(error.statusCode).json({ message: error.message });
      }
      logger.error("Failed to build companion recommendations", error);
      return res
        .status(500)
        .json({ message: "Unable to load recommendations." });
    }
  },
};
