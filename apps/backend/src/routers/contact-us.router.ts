import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ContactController } from "src/controllers/app/contact-us.controller";
import { requireAnyAuth, requireMobileAuth } from "src/middlewares/auth";
import { requireSuperAdmin } from "src/middlewares/super-admin";

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

// Internal admin / support tools.
//
// These read and triage submissions to the PUBLIC contact form - names, email
// addresses, phone numbers, message bodies and attachments belonging to people
// who have no relationship with any practice. The admin gate here was commented
// out, leaving `requireWebAuth` as the only control, so every staff account in
// every organisation could enumerate that whole queue. It is not tenant data and
// there is no organisation to scope it to; it belongs to the operator, which is
// what `requireSuperAdmin` expresses.
router.use("/requests", requireAnyAuth, requireSuperAdmin);
router.get("/requests", ContactController.list);
router.get("/requests/:id", ContactController.getById);
router.patch("/requests/:id/status", ContactController.updateStatus);

export default router;
