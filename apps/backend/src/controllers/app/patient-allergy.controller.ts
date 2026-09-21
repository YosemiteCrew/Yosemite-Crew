import { Request, Response } from "express";
import { MobilePatientAllergyService } from "src/services/mobile-patient-allergy.service";
import logger from "src/utils/logger";

export const MobilePatientAllergyController = {
  /**
   * The signed-in parent's view of one companion's live allergies.
   *
   * There is no `resolveParentId` here and no ownership check in the handler.
   * `requireCompanionPermission("medicalRecords", "patientId")` has already
   * resolved the caller to a parent, proven an ACTIVE link to this exact
   * patient and checked the feature flag on it, answering 404 or 403 itself.
   * Repeating any of that here would be a second copy of the rule that can
   * drift from the one every other path-keyed companion route enforces.
   */
  listForCompanion: async (req: Request, res: Response) => {
    try {
      const allergies =
        await MobilePatientAllergyService.listAllergiesForCompanion(
          req.params.patientId,
        );

      // An empty list is a 200, not a 404. "This animal has no recorded
      // allergies" is an answer the owner needs, and it is a different answer
      // from "you cannot see this animal", which the middleware already gave.
      return res.status(200).json({ allergies });
    } catch (err) {
      logger.error(
        `Error listing companion allergies: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      return res
        .status(500)
        .json({ message: "Failed to list companion allergies." });
    }
  },
};
