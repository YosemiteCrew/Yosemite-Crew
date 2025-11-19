import { Router } from "express";
import { AvailabilityController } from "src/controllers/web/availability.controller";
import { authorizeCognito } from "src/middlewares/auth";

const router = Router();

router.use(authorizeCognito);

// Base
router.post("/:orgId/base", (req, res) =>
  AvailabilityController.setAllBaseAvailability(req, res),
);
router.get("/:orgId/base", (req, res) =>
  AvailabilityController.getBaseAvailability(req, res),
);
router.delete("/:orgId/base", (req, res) =>
  AvailabilityController.deleteBaseAvailability(req, res),
);

// Weekly overrides
router.post("/:orgId/weekly", (req, res) =>
  AvailabilityController.addWeeklyAvailabilityOverride(req, res),
);
router.get("/:orgId/weekly", (req, res) =>
  AvailabilityController.getWeeklyAvailabilityOverride(req, res),
);
router.delete("/:orgId/weekly", (req, res) =>
  AvailabilityController.deleteWeeklyAvailabilityOverride(req, res),
);

// Occupancy
router.post("/:orgId/occupancy", (req, res) =>
  AvailabilityController.addOccupancy(req, res),
);
router.post("/:orgId/occupancy/bulk", (req, res) =>
  AvailabilityController.addAllOccupancies(req, res),
);
router.get("/:orgId/occupancy", (req, res) =>
  AvailabilityController.getOccupancy(req, res),
);

// Computed availability and status
router.get("/:orgId/final", (req, res) =>
  AvailabilityController.getFinalAvailability(req, res),
);
router.get("/:orgId/status", (req, res) =>
  AvailabilityController.getCurrentStatus(req, res),
);

export default router;
