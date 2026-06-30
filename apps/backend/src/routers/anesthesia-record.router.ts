import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { AnesthesiaRecordController } from "src/controllers/web/anesthesia-record.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/anesthesia-records";

router.get(
  base,
  requirePermission("appointments:view:any"),
  AnesthesiaRecordController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  AnesthesiaRecordController.create,
);
router.get(
  `${base}/:recordId`,
  requirePermission("appointments:view:any"),
  AnesthesiaRecordController.get,
);
router.put(
  `${base}/:recordId`,
  requirePermission("appointments:edit:any"),
  AnesthesiaRecordController.update,
);

export default router;
