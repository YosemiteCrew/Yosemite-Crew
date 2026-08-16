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

// No auth middleware: this route is reached from the wallet-pass QR. The
// credential is a 256-bit share token, NOT the patient id - the patient id is
// an internal identifier that is already handed to authenticated clients and
// embedded in app routes, so it could be neither rotated nor revoked. The
// owner can rotate or revoke this token at any time, and every failure returns
// the same uniform 404.
router.get(
  "/token/:token",
  publicPassportLimiter,
  PetPassportController.getPublicPassportByToken,
);

export default router;
