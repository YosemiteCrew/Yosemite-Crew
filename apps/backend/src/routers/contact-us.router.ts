import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ContactController } from "src/controllers/app/contact-us.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";

const router = Router();

// The public contact form is reachable without a session, so the global limiter is the
// only thing standing between an anonymous caller and an unbounded run of submissions or
// S3 upload grants. Keep a tighter per-IP budget on those two routes specifically.
const publicContactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

// Mobile/web public endpoint (user may or may not be logged in)
router.post("/contact", requireMobileAuth, ContactController.create);
router.post("/contact-web", publicContactLimiter, ContactController.createWeb);
router.post(
  "/attachments/presigned-url",
  publicContactLimiter,
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
