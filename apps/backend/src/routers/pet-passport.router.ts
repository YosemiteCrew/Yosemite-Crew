import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PetPassportController } from "src/controllers/web/pet-passport.controller";

const router = Router();

// Clinical records (vaccinations, titrations, parasite treatments) are written
// through the clinical-artifact workflow now, not here. This router only issues
// passports and reads the assembled passport + wallet passes.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/issue",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.issuePassport,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/passport",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getPassport,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/wallet/apple",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getApplePass,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/wallet/google",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getGooglePass,
);

export default router;
