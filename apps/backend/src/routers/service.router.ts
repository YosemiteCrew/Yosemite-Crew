import { Router } from "express";
import { ServiceController } from "../controllers/web/service.controller";
import { requireWebAuth } from "src/middlewares/auth";
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
router.get(
  "/organisation/search",
  ServiceController.listOrganisationByServiceName,
);
router.get(
  "/organisation/:organisationId",
  ServiceController.listByOrganisation,
);
router.post("/bookable-slots", ServiceController.getBookableSlotsForService);
router.post(
  "/bookable-slots/calendar-prefill",
  ServiceController.getCalendarPrefill,
);
router.get("/:id", ServiceController.getServiceById);
router.patch("/:id", requireWebAuth, ServiceController.updateService);
router.delete("/:id", requireWebAuth, ServiceController.deleteService);

export default router;
