import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PetPassportController } from "src/controllers/web/pet-passport.controller";
import { PassportConsentController } from "src/controllers/web/passport-consent.controller";

const router = Router();

// Clinical-record capture: each record is created as a signed-able
// ClinicalArtifact child hung off the appointment's encounter (encounterId in the
// body). The passport reads them back via the encounter.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/immunizations",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("vaccinations:edit:any"),
  PetPassportController.recordImmunization,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/treatments",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordParasiteTreatment,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/titrations",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordRabiesTitration,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/clinical-exams",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordClinicalExam,
);

// Attestation: a verified vet signs a recorded clinical artifact (-> SIGNED, the
// state the passport surfaces) or revokes it.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/records/:recordId/sign",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.signRecord,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/records/:recordId/attest",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.attestRecord,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/records/:recordId/revoke",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.revokeRecord,
);

// Cross-practice sharing consent (per recipient practice; pet-parent consent
// recorded). The owning practice requests; the parent grants via mobile/email.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/consents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PassportConsentController.requestConsent,
);

router.get(
  "/pms/organisation/:organisationId/consents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PassportConsentController.listConsents,
);

router.post(
  "/pms/organisation/:organisationId/consents/:consentId/grant",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PassportConsentController.grantConsent,
);

router.post(
  "/pms/organisation/:organisationId/consents/:consentId/revoke",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PassportConsentController.revokeConsent,
);

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
