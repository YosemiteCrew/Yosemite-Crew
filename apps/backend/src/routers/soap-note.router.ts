import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { SOAPNoteController } from "src/controllers/web/soap-note.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/soap-notes";

router.get(
  base,
  requirePermission("appointments:view:any"),
  SOAPNoteController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  SOAPNoteController.create,
);
router.get(
  `${base}/:noteId`,
  requirePermission("appointments:view:any"),
  SOAPNoteController.get,
);
router.put(
  `${base}/:noteId`,
  requirePermission("appointments:edit:any"),
  SOAPNoteController.update,
);
router.post(
  `${base}/:noteId/sign`,
  requirePermission("appointments:edit:any"),
  SOAPNoteController.sign,
);
router.post(
  `${base}/:noteId/amend`,
  requirePermission("appointments:edit:any"),
  SOAPNoteController.amend,
);

export default router;
