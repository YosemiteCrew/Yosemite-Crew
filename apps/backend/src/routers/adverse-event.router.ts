// src/routes/adverseEvent.routes.ts
import { Router } from "express";
import { AdverseEventController } from "../controllers/web/adverse-event.controller";
import { authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// Mobile app: submit report
router.post("/", authorizeCognitoMobile, AdverseEventController.createFromMobile);

router.get("/regulatory-authority/", authorizeCognitoMobile, )

// PMS: list reports for org
router.get(
  "/organisation/:organisationId",
  AdverseEventController.listForOrg,
);

// Both: view single report
router.get("/:id", AdverseEventController.getById);

// PMS: update status / mark forwarded / closed
router.patch("/:id/status", AdverseEventController.updateStatus);

export default router;