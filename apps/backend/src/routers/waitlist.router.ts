import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { WaitlistController } from "src/controllers/web/waitlist.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/waitlist",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  WaitlistController.list,
);

router.post(
  "/pms/organisation/:organisationId/waitlist",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WaitlistController.add,
);

router.get(
  "/pms/organisation/:organisationId/waitlist/:entryId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  WaitlistController.get,
);

router.post(
  "/pms/organisation/:organisationId/waitlist/:entryId/offer",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WaitlistController.offer,
);

router.post(
  "/pms/organisation/:organisationId/waitlist/:entryId/book",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WaitlistController.book,
);

router.post(
  "/pms/organisation/:organisationId/waitlist/:entryId/cancel",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WaitlistController.cancel,
);

router.post(
  "/pms/organisation/:organisationId/waitlist/expire-stale",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  WaitlistController.expireStale,
);

export default router;
