import type { Request, Response } from "express";
import { z } from "zod";
import logger from "src/utils/logger";
import { SuperadminContactService } from "src/services/superadmin-contact.service";

const backfillSchema = z.object({
  since: z.iso.datetime().optional(),
  until: z.iso.datetime().optional(),
  batchSize: z.coerce.number().int().positive().max(500).optional(),
});

export const SuperAdminContactBackfillController = {
  async triggerBackfill(req: Request, res: Response) {
    try {
      const parsed = backfillSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: "Invalid request body",
          details: parsed.error.issues,
        });
      }

      const options = {
        since: parsed.data.since ? new Date(parsed.data.since) : undefined,
        until: parsed.data.until ? new Date(parsed.data.until) : undefined,
        batchSize: parsed.data.batchSize,
      };

      logger.info("Starting SuperAdmin contact backfill", options);

      const result =
        await SuperadminContactService.backfillContactSubmissions(options);

      logger.info("SuperAdmin contact backfill completed", result);

      res.status(200).json({
        message: "Backfill completed",
        ...result,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.includes("must be configured")
      ) {
        return res.status(503).json({
          error: "SuperAdmin contact intake is not configured",
          message: error.message,
        });
      }
      logger.error("Failed to run SuperAdmin contact backfill", { error });
      res.status(500).json({
        error: "Internal server error",
        message: "Failed to run backfill",
      });
    }
  },
};
