import { Router } from "express";
import { ContactController } from "src/controllers/app/contact-us.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

// Mobile/web public endpoint (user may or may not be logged in)
router.post("/contact", authorizeCognitoMobile, ContactController.create);

// Internal admin / support tools
// router.use(requireAdminAuth);
router.get("/requests", authorizeCognito, ContactController.list);
router.get("/requests/:id", authorizeCognito, ContactController.getById);
router.patch(
  "/requests/:id/status",
  authorizeCognito,
  ContactController.updateStatus,
);

export default router;
