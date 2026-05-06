import { Router } from "express";
import { ServiceController } from "../controllers/web/service.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.createService,
);
router.post(
  "/bulk",
  authorizeCognito,
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
router.patch("/:id", authorizeCognito, ServiceController.updateService);
router.delete("/:id", authorizeCognito, ServiceController.deleteService);

export default router;
