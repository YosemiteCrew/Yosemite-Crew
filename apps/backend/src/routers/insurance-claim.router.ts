import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { InsuranceClaimController } from "src/controllers/web/insurance-claim.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/insurance-claims",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  InsuranceClaimController.list,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.create,
);

router.get(
  "/pms/organisation/:organisationId/insurance-claims/:claimId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  InsuranceClaimController.get,
);

router.put(
  "/pms/organisation/:organisationId/insurance-claims/:claimId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.update,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims/:claimId/submit",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.submit,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims/:claimId/status",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.updateStatus,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims/:claimId/cancel",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.cancel,
);

export default router;
