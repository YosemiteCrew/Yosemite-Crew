import { Router } from "express";
import { ContactController } from "src/controllers/app/contact-us.controller";

const router = Router();

router.post("/contact", ContactController.create);
router.get("/dashboard/stats", ContactController.getDashboardStats);
router.get("/requests", ContactController.list);
router.get("/requests/:id", ContactController.getById);
router.patch("/requests/:id/status", ContactController.updateStatus);

export default router;
