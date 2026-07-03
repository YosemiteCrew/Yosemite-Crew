import { Router } from "express";
import { AdverseEventController } from "../controllers/web/adverse-event.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

// Mobile app: submit report
router.post("/", requireMobileAuth, AdverseEventController.createFromMobile);

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

// Both: view single report
router.get("/:id", requireWebAuth, AdverseEventController.getById);

// PMS: update status / mark forwarded / closed
router.patch(
  "/:id/status",
  requireWebAuth,
  AdverseEventController.updateStatus,
);

export default router;
