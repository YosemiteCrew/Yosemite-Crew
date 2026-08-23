import { Router } from "express";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PetPassportController } from "src/controllers/web/pet-passport.controller";
import { PassportConsentController } from "src/controllers/web/passport-consent.controller";
import { requireCompanionPermission } from "src/middlewares/companion-access";

const router = Router();

// Clinical-record capture: each record is created as a signed-able
// ClinicalArtifact child hung off the appointment's encounter (encounterId in the
// body). The passport reads them back via the encounter.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/immunizations",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("vaccinations:edit:any"),
  PetPassportController.recordImmunization,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/treatments",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordParasiteTreatment,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/titrations",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordRabiesTitration,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/clinical-exams",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.recordClinicalExam,
);

// Attestation: a verified vet signs a recorded clinical artifact (-> SIGNED, the
// state the passport surfaces) or revokes it.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/records/:recordId/sign",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:attest:any"),
  PetPassportController.signRecord,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/records/:recordId/attest",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:attest:any"),
  PetPassportController.attestRecord,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/records/:recordId/revoke",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:attest:any"),
  PetPassportController.revokeRecord,
);

// Cross-practice sharing consent (per recipient practice; pet-parent consent
// recorded). The owning practice requests; the parent grants via mobile/email.
router.post(
  "/pms/organisation/:organisationId/companion/:patientId/consents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PassportConsentController.requestConsent,
);

router.get(
  "/pms/organisation/:organisationId/consents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PassportConsentController.listConsents,
);

// PET PARENT (mobile) surface. No organisation in the path and no staff
// permission gate: the service proves the caller is the pet's primary parent
// and derives the org from the pet's own membership. Wallet passes are served
// here rather than from the public token route so the app never has to hold a
// bearer credential.
router.get(
  "/mobile/companion/:patientId",
  requireMobileAuth,
  requireCompanionPermission("companionProfile", "patientId"),
  PetPassportController.getPassportForParent,
);

router.get(
  "/mobile/companion/:patientId/wallet/apple",
  requireMobileAuth,
  requireCompanionPermission("companionProfile", "patientId"),
  PetPassportController.getApplePassForParent,
);

router.get(
  "/mobile/companion/:patientId/wallet/google",
  requireMobileAuth,
  requireCompanionPermission("companionProfile", "patientId"),
  PetPassportController.getGooglePassForParent,
);

// Revoking the public link is the owner's call, not a practice's: a staff
// session must not be able to mint or kill a pet's public share on its own.
router.delete(
  "/mobile/companion/:patientId/share-link",
  requireMobileAuth,
  requireCompanionPermission("companionProfile", "patientId"),
  PetPassportController.revokePublicToken,
);

// Granting is the PET PARENT's action, so this is a mobile-authenticated route
// and carries no staff permission gate. The service verifies the caller is the
// pet's primary parent; a practice must never be able to authorise its own
// access to another practice's records.
router.post(
  "/mobile/organisation/:organisationId/consents/:consentId/grant",
  requireMobileAuth,
  PassportConsentController.grantConsent,
);

router.post(
  "/pms/organisation/:organisationId/consents/:consentId/revoke",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PassportConsentController.revokeConsent,
);

router.post(
  "/pms/organisation/:organisationId/companion/:patientId/issue",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("passport:edit:any"),
  PetPassportController.issuePassport,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/passport",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getPassport,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/wallet/apple",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getApplePass,
);

router.get(
  "/pms/organisation/:organisationId/companion/:patientId/wallet/google",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("companions:view:any"),
  PetPassportController.getGooglePass,
);

export default router;
