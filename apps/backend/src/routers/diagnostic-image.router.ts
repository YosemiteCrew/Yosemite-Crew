import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { DiagnosticImageController } from "src/controllers/web/diagnostic-image.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/diagnostic-images";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DiagnosticImageController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DiagnosticImageController.record,
);
router.get(
  `${base}/:imageId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DiagnosticImageController.get,
);
router.post(
  `${base}/:imageId/review`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DiagnosticImageController.review,
);
router.put(
  `${base}/:imageId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  DiagnosticImageController.update,
);

export default router;
