import { Router } from "express";
import { MobilePatientProblemController } from "../controllers/app/patient-problem.controller";
import { requireMobileAuth } from "src/middlewares/auth";
import { requireCompanionPermission } from "src/middlewares/companion-access";

export const mobilePatientProblemRouter = Router();

// What the signed-in parent's companion is being treated for. Path-keyed by
// patient, so the whole access decision is the shared middleware's - see the
// controller.
mobilePatientProblemRouter.get(
  "/mobile/companion/:patientId",
  requireMobileAuth,
  requireCompanionPermission("medicalRecords", "patientId"),
  MobilePatientProblemController.listForCompanion,
);

export default mobilePatientProblemRouter;
