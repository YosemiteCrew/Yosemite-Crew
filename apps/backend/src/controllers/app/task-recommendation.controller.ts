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
        disclaimer:
          "These are general husbandry suggestions commonly recommended for this breed and age. They are not a diagnosis or advice about your companion specifically. Your vet knows your companion; ask them before acting on anything here.",
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
