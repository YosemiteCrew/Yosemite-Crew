import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { LabResultController } from "src/controllers/web/lab-result.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/:provider/results",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabResultController.list(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/results/search",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabResultController.search(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/results/:resultId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabResultController.get(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/results/:resultId/pdf",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabResultController.getPdf(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/results/:resultId/notifications/pdf",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabResultController.getNotificationsPdf(req, res),
);

export default router;
