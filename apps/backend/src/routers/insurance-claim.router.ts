import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { InsuranceClaimController } from "src/controllers/web/insurance-claim.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/insurance-claims",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  InsuranceClaimController.list,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.create,
);

router.get(
  "/pms/organisation/:organisationId/insurance-claims/:claimId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  InsuranceClaimController.get,
);

router.put(
  "/pms/organisation/:organisationId/insurance-claims/:claimId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.update,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims/:claimId/submit",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.submit,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims/:claimId/status",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.updateStatus,
);

router.post(
  "/pms/organisation/:organisationId/insurance-claims/:claimId/cancel",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("billing:edit:any"),
  InsuranceClaimController.cancel,
);

export default router;
