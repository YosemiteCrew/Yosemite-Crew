import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import { LabIngestionQuarantineService } from "src/services/lab-ingestion-quarantine.service";

// Constrained rather than free text: the value goes into a `where` clause, and
// the set of providers this poller talks to is closed.
const querySchema = z.object({
  provider: z.enum(["IDEXX"]).optional(),
});

export const SuperAdminLabIngestionController = {
  listQuarantine: async (req: Request, res: Response) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        error: "Unknown provider.",
        code: "INVALID_LAB_PROVIDER",
      });
      return;
    }

    try {
      const quarantine = await LabIngestionQuarantineService.listUnresolved(
        parsed.data.provider,
      );
      res.status(200).json(quarantine);
    } catch (error) {
      logger.error("Failed to list quarantined lab results", error);
      res.status(500).json({
        error: "Unable to list quarantined lab results.",
        code: "LAB_QUARANTINE_LIST_FAILED",
      });
    }
  },
};
