import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PetPassportController } from "src/controllers/web/pet-passport.controller";

const router = Router();

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/vaccinations",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("vaccinations:edit:any"),
  PetPassportController.recordVaccination,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/vaccinations",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.listVaccinations,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/treatments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordParasiteTreatment,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/treatments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.listParasiteTreatments,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/titrations",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordRabiesTitration,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/titrations",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.listRabiesTitrations,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/passport",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getPassport,
);

export default router;
