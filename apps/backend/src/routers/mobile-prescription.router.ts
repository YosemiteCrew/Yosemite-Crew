import { Router } from "express";
import { MobilePrescriptionController } from "../controllers/app/prescription.controller";
import { requireMobileAuth } from "src/middlewares/auth";

export const mobilePrescriptionRouter = Router();

// Prescriptions for the signed-in parent's companions.
mobilePrescriptionRouter.get(
  "/mobile",
  requireMobileAuth,
  MobilePrescriptionController.listPrescriptions,
);

// Refill request for one of the signed-in parent's own prescriptions.
mobilePrescriptionRouter.post(
  "/mobile/:id/refill",
  requireMobileAuth,
  MobilePrescriptionController.requestRefill,
);

export default mobilePrescriptionRouter;
