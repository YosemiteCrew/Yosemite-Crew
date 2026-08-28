import { Router } from "express";
import rateLimit from "express-rate-limit";
import { PublicBookingController } from "src/controllers/app/public-booking.controller";

/**
 * The public booking page's own API. No session, by design.
 *
 * Follows the shape the other unauthenticated routers in this codebase already
 * use (`pet-passport-public`, `companion-card-public`): a per-IP budget tighter
 * than the global limiter, no auth middleware, and a service that returns one
 * uniform 404 for everything it declines to confirm.
 *
 * Reads and writes get separate budgets because they cost different things. A
 * read burns database time; a write can put an email in a stranger's inbox and a
 * row in a veterinary database, so it is held to the same budget as the public
 * contact form.
 */

// Slot computation walks availability for every practitioner on a date, so this
// is the most expensive anonymous call in the codebase. 60 per quarter-hour is
// enough for a person choosing a date and well short of scraping a schedule.
const publicReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

// Matches `contact-us`'s public write budget. Each accepted call sends mail to
// an address the caller chose, so the limit is really a cap on how much of
// somebody else's inbox one IP can spend.
const publicWriteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const router = Router();

// Registered before the `:slug` routes. Nothing currently collides - the slug
// routes need a literal second segment - but a slug pattern one edit away from
// swallowing `/requests` is not worth relying on.
//
// A write, not a GET: it flips a status and mails the practice, and mail clients
// and link scanners prefetch GETs, which would confirm requests nobody clicked.
router.post(
  "/requests/confirm",
  publicWriteLimiter,
  PublicBookingController.confirmRequest,
);

router.get("/:slug", publicReadLimiter, PublicBookingController.getPractice);
router.get("/:slug/slots", publicReadLimiter, PublicBookingController.getSlots);

router.post(
  "/:slug/requests",
  publicWriteLimiter,
  PublicBookingController.submitRequest,
);

export default router;
