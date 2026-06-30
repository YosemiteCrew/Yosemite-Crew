import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { DiagnosticImageController } from "src/controllers/web/diagnostic-image.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/diagnostic-images";

router.get(
  base,
  requirePermission("appointments:view:any"),
  DiagnosticImageController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  DiagnosticImageController.record,
);
router.get(
  `${base}/:imageId`,
  requirePermission("appointments:view:any"),
  DiagnosticImageController.get,
);
router.post(
  `${base}/:imageId/review`,
  requirePermission("appointments:edit:any"),
  DiagnosticImageController.review,
);
router.put(
  `${base}/:imageId`,
  requirePermission("appointments:edit:any"),
  DiagnosticImageController.update,
);

export default router;
