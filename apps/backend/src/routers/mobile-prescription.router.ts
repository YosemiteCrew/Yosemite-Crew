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

export default mobilePrescriptionRouter;
