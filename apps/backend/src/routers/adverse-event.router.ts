import { Router } from "express";
import { AdverseEventController } from "../controllers/web/adverse-event.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

// Mobile app: submit report
router.post(
  "/",
  authorizeCognitoMobile,
  AdverseEventController.createFromMobile,
);

router.get(
  "/regulatory-authority/",
  authorizeCognitoMobile,
  AdverseEventController.getRegulatoryAuthorityInof,
);

// PMS: list reports for org
router.get(
  "/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  AdverseEventController.listForOrg,
);

// Both: view single report
router.get("/:id", authorizeCognito, AdverseEventController.getById);

// PMS: update status / mark forwarded / closed
router.patch(
  "/:id/status",
  authorizeCognito,
  AdverseEventController.updateStatus,
);

export default router;
