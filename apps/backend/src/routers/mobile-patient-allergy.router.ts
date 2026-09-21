import { Router } from "express";
import { MobilePatientAllergyController } from "../controllers/app/patient-allergy.controller";
import { requireMobileAuth } from "src/middlewares/auth";
import { requireCompanionPermission } from "src/middlewares/companion-access";

export const mobilePatientAllergyRouter = Router();

// What the signed-in parent's companion is allergic to. Path-keyed by patient,
// so the whole access decision is the shared middleware's - see the controller.
mobilePatientAllergyRouter.get(
  "/mobile/companion/:patientId",
  requireMobileAuth,
  requireCompanionPermission("medicalRecords", "patientId"),
  MobilePatientAllergyController.listForCompanion,
);

export default mobilePatientAllergyRouter;
