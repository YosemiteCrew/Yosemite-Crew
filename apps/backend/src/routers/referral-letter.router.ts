import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { ReferralLetterController } from "src/controllers/web/referral-letter.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/referral-letters",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ReferralLetterController.list,
);

router.post(
  "/pms/organisation/:organisationId/referral-letters",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReferralLetterController.create,
);

router.get(
  "/pms/organisation/:organisationId/referral-letters/:letterId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  ReferralLetterController.get,
);

router.put(
  "/pms/organisation/:organisationId/referral-letters/:letterId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReferralLetterController.update,
);

router.post(
  "/pms/organisation/:organisationId/referral-letters/:letterId/sign",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReferralLetterController.sign,
);

router.post(
  "/pms/organisation/:organisationId/referral-letters/:letterId/send",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReferralLetterController.send,
);

router.post(
  "/pms/organisation/:organisationId/referral-letters/:letterId/cancel",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  ReferralLetterController.cancel,
);

export default router;
