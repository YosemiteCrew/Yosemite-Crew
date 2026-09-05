import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import { LabIngestionQuarantineService } from "src/services/lab-ingestion-quarantine.service";

// Constrained rather than free text: the value goes into a `where` clause, and
// the set of providers this poller talks to is closed.
const querySchema = z.object({
  provider: z.enum(["IDEXX"]).optional(),
});

// The rows are uuid-keyed, so anything else is a malformed request rather than
// a miss - answered as such instead of being sent to the database.
const idSchema = z.object({
  id: z.uuid(),
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

  resolveQuarantine: async (req: Request, res: Response) => {
    const parsed = idSchema.safeParse(req.params);
    if (!parsed.success) {
      res.status(400).json({
        error: "Invalid quarantine id.",
        code: "INVALID_QUARANTINE_ID",
      });
      return;
    }

    try {
      const resolved = await LabIngestionQuarantineService.resolve(
        parsed.data.id,
      );
      if (!resolved) {
        // One status for both, deliberately: an id that does not exist and one
        // already resolved are the same outcome for the caller, and telling
        // them apart would report on rows they did not ask about.
        res.status(404).json({
          error: "No unresolved quarantined result with that id.",
          code: "QUARANTINE_NOT_FOUND",
        });
        return;
      }

      res.status(200).json({ id: parsed.data.id, resolved: true });
    } catch (error) {
      logger.error("Failed to resolve a quarantined lab result", error);
      res.status(500).json({
        error: "Unable to resolve the quarantined lab result.",
        code: "LAB_QUARANTINE_RESOLVE_FAILED",
      });
    }
  },
};
