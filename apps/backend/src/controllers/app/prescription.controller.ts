import { Request, Response } from "express";
import { MobilePrescriptionService } from "src/services/mobile-prescription.service";
import {
  InventoryConsumptionService,
  InventoryConsumptionServiceError,
} from "src/services/inventory-consumption.service";
import { parseKeysetCursor } from "src/services/shared/pagination";
import logger from "src/utils/logger";
import { resolveParentId } from "src/controllers/app/shared/owner-controller.helpers";

export const MobilePrescriptionController = {
  listPrescriptions: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) {
        return;
      }

      /*
       * Rejected up front rather than passed through. A malformed cursor is a
       * caller mistake and answering 400 keeps every failure from the query
       * itself honestly a 500; inferring "bad cursor" from a thrown error
       * would report a database outage as the caller's fault.
       *
       * The offending value is not logged. It is caller-controlled, a raw
       * CR/LF in it forges a second log line, and the 400 already tells the
       * only party who can act on it.
       */
      const cursor = parseKeysetCursor(req.query.cursor);
      if (cursor === null) {
        return res.status(400).json({
          message:
            "Unknown or malformed cursor. Use nextCursor from the previous response.",
        });
      }

      const page = await MobilePrescriptionService.listPrescriptionsForParent(
        parentId,
        { limit: req.query.limit, cursor },
      );

      /*
       * `prescriptions` keeps its name and its shape. The three fields beside
       * it are what stops this being a silently truncated list: a client that
       * ignores them sees a short page, and one that reads them can tell the
       * difference between the end of the data and the end of the page.
       */
      return res.status(200).json({
        prescriptions: page.prescriptions,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
        limit: page.limit,
      });
    } catch (err) {
      logger.error(
        `Error listing prescriptions: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      return res.status(500).json({ message: "Failed to list prescriptions." });
    }
  },

  requestRefill: async (req: Request, res: Response) => {
    try {
      const parentId = await resolveParentId(req, res);
      if (!parentId) {
        return;
      }

      const prescription =
        await MobilePrescriptionService.getOwnedPrescriptionForRefill(
          parentId,
          req.params.id,
        );
      if (!prescription) {
        return res.status(404).json({ message: "Prescription not found." });
      }

      /*
       * The same write the PIMS side already makes when a prescription is
       * signed (`shouldCreateDispenseRequestForPrescription`) and upserts on
       * every re-request while one stays PENDING. Calling it here rather than
       * inventing a second write path is what gives a refill request the
       * right shape once it reaches staff, and what makes asking twice before
       * the first fill is reviewed a no-op instead of a duplicate.
       */
      await InventoryConsumptionService.createPrescriptionDispenseRequest({
        organisationId: prescription.organisationId,
        prescriptionId: prescription.id,
        medications: prescription.medications,
        requestedBy: parentId,
        context: { encounterId: prescription.encounterId },
      });

      return res.status(201).json({ status: "PENDING" });
    } catch (err) {
      if (err instanceof InventoryConsumptionServiceError) {
        return res.status(err.statusCode).json({ message: err.message });
      }
      logger.error(
        `Error requesting prescription refill: ${
          err instanceof Error ? err.message : "Unknown error"
        }`,
      );
      return res.status(500).json({ message: "Failed to request refill." });
    }
  },
};
