import { Router } from "express";
import { BookingPageController } from "src/controllers/web/booking-page.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.use(requireWebAuth);

/**
 * Configuring the public booking page is an organisation-administration act, not
 * a catalogue edit: it decides what the practice publishes about itself on the
 * open internet. `teams:*:any` is the existing permission pair that expresses
 * that scope - it already guards the organisation logo - and in
 * `ROLE_PERMISSIONS` only the admin-tier roles hold the `edit` half, while
 * clinical roles hold `view` alone. `specialities:edit:any` would have been the
 * wrong reach: every role that can rename a service would have been able to put
 * the practice online.
 */
router.get(
  "/:organisationId",
  withOrgPermissions(),
  requirePermission("teams:view:any"),
  BookingPageController.getConfig,
);

router.put(
  "/:organisationId",
  withOrgPermissions(),
  requirePermission("teams:edit:any"),
  BookingPageController.saveConfig,
);

/**
 * The queue of confirmed public booking requests.
 *
 * Gated on `appointments:*:any` rather than `teams:*`, because this is clinical
 * scheduling work rather than organisation administration: the people who
 * triage a request into the diary are the ones who already hold the appointment
 * permissions, and the receptionist who books them should not need the
 * permission that publishes the practice.
 */
router.get(
  "/:organisationId/requests",
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  BookingPageController.listRequests,
);

router.patch(
  "/:organisationId/requests/:requestId",
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  BookingPageController.updateRequestStatus,
);

export default router;
