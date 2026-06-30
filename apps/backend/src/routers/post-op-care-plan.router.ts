import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { PostOpCarePlanController } from "src/controllers/web/post-op-care-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/post-op-care-plans";

router.get(
  base,
  requirePermission("appointments:view:any"),
  PostOpCarePlanController.list,
);
router.post(
  base,
  requirePermission("appointments:edit:any"),
  PostOpCarePlanController.create,
);
router.get(
  `${base}/:planId`,
  requirePermission("appointments:view:any"),
  PostOpCarePlanController.get,
);
router.post(
  `${base}/:planId/review`,
  requirePermission("appointments:edit:any"),
  PostOpCarePlanController.review,
);
router.put(
  `${base}/:planId`,
  requirePermission("appointments:edit:any"),
  PostOpCarePlanController.update,
);

export default router;
