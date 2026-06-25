import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PetPassportController } from "src/controllers/web/pet-passport.controller";

// Public, unauthenticated QR verification endpoint: a prime scraping target, so
// it gets a tighter per-IP limit. Only formally-issued passports resolve, and
// the assembled record carries no owner/contact data.
const publicPassportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// No auth middleware: this route is reached from the wallet-pass QR and is
// gated by the passport existing (issued) and a uniform 404 otherwise.
router.get(
  "/:patientId",
  publicPassportLimiter,
  PetPassportController.getPublicPassport,
);

export default router;
