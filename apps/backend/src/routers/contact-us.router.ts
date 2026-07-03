import { Router } from "express";
import { ContactController } from "src/controllers/app/contact-us.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";

const router = Router();

// Mobile/web public endpoint (user may or may not be logged in)
router.post("/contact", requireMobileAuth, ContactController.create);
router.post("/contact-web", ContactController.createWeb);
router.post(
  "/attachments/presigned-url",
  ContactController.getAttachmentUploadUrl,
);

// Internal admin / support tools
// router.use(requireAdminAuth);
router.get("/requests", requireWebAuth, ContactController.list);
router.get("/requests/:id", requireWebAuth, ContactController.getById);
router.patch(
  "/requests/:id/status",
  requireWebAuth,
  ContactController.updateStatus,
);

export default router;
