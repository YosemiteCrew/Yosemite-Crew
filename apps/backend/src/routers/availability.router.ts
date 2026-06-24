import { Router } from "express";
import { AvailabilityController } from "src/controllers/web/availability.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

router.use(authorizeCognito);

// Base
router.post(
  "/:orgId/base",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) => AvailabilityController.setAllBaseAvailability(req, res),
);
router.get(
  "/:orgId/base",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  (req, res) => AvailabilityController.getBaseAvailability(req, res),
);
router.get(
  "/:orgId/base/all",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  (req, res) =>
    AvailabilityController.getOrganisationBaseAvailability(req, res),
);
router.delete(
  "/:orgId/base",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) => AvailabilityController.deleteBaseAvailability(req, res),
);
router.post(
  "/:orgId/:userId/base",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) => AvailabilityController.setBaseAvailabilityForUser(req, res),
);

// Weekly overrides
router.post(
  "/:orgId/weekly",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) => AvailabilityController.addWeeklyAvailabilityOverride(req, res),
);
router.get(
  "/:orgId/weekly",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  (req, res) => AvailabilityController.getWeeklyAvailabilityOverride(req, res),
);
router.delete(
  "/:orgId/weekly",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) =>
    AvailabilityController.deleteWeeklyAvailabilityOverride(req, res),
);

// Occupancy
router.post(
  "/:orgId/occupancy",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) => AvailabilityController.addOccupancy(req, res),
);
router.post(
  "/:orgId/occupancy/bulk",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  (req, res) => AvailabilityController.addAllOccupancies(req, res),
);
router.get(
  "/:orgId/occupancy",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  (req, res) => AvailabilityController.getOccupancy(req, res),
);

// Computed availability and status
router.get(
  "/:orgId/final",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  (req, res) => AvailabilityController.getFinalAvailability(req, res),
);
router.get(
  "/:orgId/status",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  (req, res) => AvailabilityController.getCurrentStatus(req, res),
);

export default router;
