import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { PostOpCarePlanController } from "src/controllers/web/post-op-care-plan.controller";

const router = Router();
const base = "/pms/organisation/:organisationId/post-op-care-plans";

router.get(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PostOpCarePlanController.list,
);
router.post(
  base,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PostOpCarePlanController.create,
);
router.get(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PostOpCarePlanController.get,
);
router.post(
  `${base}/:planId/review`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PostOpCarePlanController.review,
);
router.put(
  `${base}/:planId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PostOpCarePlanController.update,
);

export default router;
