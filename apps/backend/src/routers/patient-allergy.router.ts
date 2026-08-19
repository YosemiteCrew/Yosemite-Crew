import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PatientAllergyController } from "src/controllers/web/patient-allergy.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/patient-allergies",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientAllergyController.list,
);

router.post(
  "/pms/organisation/:organisationId/patient-allergies",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientAllergyController.create,
);

router.get(
  "/pms/organisation/:organisationId/patient-allergies/:allergyId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientAllergyController.get,
);

router.put(
  "/pms/organisation/:organisationId/patient-allergies/:allergyId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientAllergyController.update,
);

router.post(
  "/pms/organisation/:organisationId/patient-allergies/:allergyId/resolve",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientAllergyController.resolve,
);

export default router;
