import { Router } from "express";
import rateLimit from "express-rate-limit";
import { ServiceController } from "../controllers/web/service.controller";
import { attachSessionIfPresent, requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

// Clinic and slot discovery is a signed-out surface: the pet-parent mobile app
// browses organisations and bookable windows before the user authenticates, so
// these read routes stay reachable without a session. The per-IP limiter is the
// only budget standing between an anonymous caller and unbounded scraping of the
// directory or repeated slot computation, so cap it here.
const publicServiceReadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.createService,
);
router.post(
  "/bulk",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.createMany,
);
// Signed-out browsing, but a signed-in caller may omit lat/lng and fall back to
// their own saved address. `attachSessionIfPresent` supplies the verified id for
// that fallback without rejecting anonymous callers - previously the id came
// from the client-supplied `x-user-id` header, so anyone could resolve another
// account's saved location.
router.get(
  "/organisation/search",
  publicServiceReadLimiter,
  attachSessionIfPresent,
  ServiceController.listOrganisationByServiceName,
);
router.get(
  "/organisation/:organisationId",
  publicServiceReadLimiter,
  ServiceController.listByOrganisation,
);
// Slot routes expose staff identifiers (`vetIds`) only to authenticated callers.
// `attachSessionIfPresent` binds the session when one is sent (staff web app,
// signed-in mobile booking) so those responses keep the assignment hint, while
// anonymous discovery gets the redacted response the controller returns.
router.post(
  "/bookable-slots",
  publicServiceReadLimiter,
  attachSessionIfPresent,
  ServiceController.getBookableSlotsForService,
);
router.post(
  "/bookable-slots/calendar-prefill",
  publicServiceReadLimiter,
  attachSessionIfPresent,
  ServiceController.getCalendarPrefill,
);
router.get("/:id", publicServiceReadLimiter, ServiceController.getServiceById);
router.patch(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.updateService,
);
router.delete(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  ServiceController.deleteService,
);

export default router;
