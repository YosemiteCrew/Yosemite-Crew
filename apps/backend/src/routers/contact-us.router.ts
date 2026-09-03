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

/*
 * A second, GLOBAL budget for the contact form (#2645).
 *
 * The per-IP limiter above is untouched and still does its job against a single
 * noisy caller, but it cannot see a distributed run: between 2026-08-22 and
 * 2026-08-30 the route absorbed ~1,330 bot submissions from 516 distinct source
 * IPs, every one answered 201, and no IP came close to 10 in 15 minutes.
 *
 * `keyGenerator` returns a constant, so every caller shares one counter. 60 per
 * 15 minutes is far above any believable human volume for this form - the worst
 * real day in that window would have to be four times its own peak to reach it -
 * while capping a botnet at roughly 4% of what it managed.
 *
 * The trade-off is stated rather than hidden: once the global budget is spent,
 * genuine visitors get a 429 too. That is why it sits well above human volume
 * and why item 2 of #2645, a bot check on the form itself, is the real fix. This
 * bounds the damage until that lands.
 */
const globalContactBurstLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: () => "public-contact-form",
  message: {
    message: "Too many contact requests right now. Please try again shortly.",
  },
});

// Mobile/web public endpoint (user may or may not be logged in)
router.post("/contact", requireMobileAuth, ContactController.create);
router.post(
  "/contact-web",
  globalContactBurstLimiter,
  publicContactLimiter,
  ContactController.createWeb,
);
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
