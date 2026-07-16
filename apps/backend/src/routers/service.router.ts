import { Router } from "express";
import { ServiceController } from "../controllers/web/service.controller";
import { requireAnyAuth, requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.createService,
);
router.post(
  "/bulk",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.createMany,
);
// Read paths are consumed by both the staff web app and the pet-parent mobile
// app, so they take `requireAnyAuth` rather than a product-specific guard.
// They are not part of a signed-out surface: without authentication these
// expose organisation and practitioner data to anonymous callers.
router.get(
  "/organisation/search",
  requireAnyAuth,
  ServiceController.listOrganisationByServiceName,
);
router.get(
  "/organisation/:organisationId",
  requireAnyAuth,
  ServiceController.listByOrganisation,
);
router.post(
  "/bookable-slots",
  requireAnyAuth,
  ServiceController.getBookableSlotsForService,
);
router.post(
  "/bookable-slots/calendar-prefill",
  requireAnyAuth,
  ServiceController.getCalendarPrefill,
);
router.get("/:id", requireAnyAuth, ServiceController.getServiceById);
router.patch(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.updateService,
);
router.delete(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.deleteService,
);

export default router;
