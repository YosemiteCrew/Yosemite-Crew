import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PatientConsentController } from "src/controllers/web/patient-consent.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/patient-consents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientConsentController.list,
);

router.post(
  "/pms/organisation/:organisationId/patient-consents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientConsentController.grant,
);

router.get(
  "/pms/organisation/:organisationId/patient-consents/:consentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientConsentController.get,
);

router.post(
  "/pms/organisation/:organisationId/patient-consents/:consentId/revoke",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientConsentController.revoke,
);

export default router;
