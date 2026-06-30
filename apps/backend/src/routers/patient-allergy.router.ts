import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PatientAllergyController } from "src/controllers/web/patient-allergy.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/patient-allergies",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientAllergyController.list,
);

router.post(
  "/pms/organisation/:organisationId/patient-allergies",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientAllergyController.create,
);

router.get(
  "/pms/organisation/:organisationId/patient-allergies/:allergyId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientAllergyController.get,
);

router.put(
  "/pms/organisation/:organisationId/patient-allergies/:allergyId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientAllergyController.update,
);

router.post(
  "/pms/organisation/:organisationId/patient-allergies/:allergyId/resolve",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientAllergyController.resolve,
);

export default router;
