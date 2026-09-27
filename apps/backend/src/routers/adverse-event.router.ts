import { Router } from "express";
import { AdverseEventController } from "../controllers/web/adverse-event.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withAdverseEventOrgPermissions,
  withOrgPermissions,
} from "src/middlewares/rbac";
import {
  requireCompanionPermissionForResource,
  resolveAdverseEventCompanion,
} from "src/middlewares/companion-access";

const router = Router();

// Mobile app: submit a report for a companion the caller may report on. The
// app offers it from the emergency actions, so it is gated the same way.
router.post(
  "/",
  requireMobileAuth,
  requireCompanionPermissionForResource(
    "emergencyBasedPermissions",
    resolveAdverseEventCompanion,
  ),
  AdverseEventController.createFromMobile,
);

router.get(
  "/regulatory-authority/",
  requireMobileAuth,
  AdverseEventController.getRegulatoryAuthorityInof,
);

// PMS: list reports for org
router.get(
  "/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  AdverseEventController.listForOrg,
);

// PMS: view a single report sent to the caller's organisation
router.get(
  "/:id",
  requireWebAuth,
  withAdverseEventOrgPermissions(),
  requirePermission("companions:view:any"),
  AdverseEventController.getById,
);

// PMS: update status / mark forwarded / closed
router.patch(
  "/:id/status",
  requireWebAuth,
  withAdverseEventOrgPermissions(),
  requirePermission("companions:edit:any"),
  AdverseEventController.updateStatus,
);

export default router;
