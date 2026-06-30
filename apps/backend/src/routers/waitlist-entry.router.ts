import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { WaitlistEntryController } from "src/controllers/web/waitlist-entry.controller";

export const waitlistEntryRouter = Router({ mergeParams: true });

waitlistEntryRouter
  .route("/pms/organisation/:organisationId/waitlist")
  .get(requirePermission("appointments:view:any"), WaitlistEntryController.list)
  .post(
    requirePermission("appointments:edit:any"),
    WaitlistEntryController.add,
  );

waitlistEntryRouter
  .route("/pms/organisation/:organisationId/waitlist/:entryId")
  .get(requirePermission("appointments:view:any"), WaitlistEntryController.get);

waitlistEntryRouter
  .route("/pms/organisation/:organisationId/waitlist/:entryId/offer")
  .post(
    requirePermission("appointments:edit:any"),
    WaitlistEntryController.offer,
  );

waitlistEntryRouter
  .route("/pms/organisation/:organisationId/waitlist/:entryId/book")
  .post(
    requirePermission("appointments:edit:any"),
    WaitlistEntryController.book,
  );

waitlistEntryRouter
  .route("/pms/organisation/:organisationId/waitlist/:entryId/cancel")
  .post(
    requirePermission("appointments:edit:any"),
    WaitlistEntryController.cancel,
  );

waitlistEntryRouter
  .route("/pms/organisation/:organisationId/waitlist/:entryId/expire")
  .post(
    requirePermission("appointments:edit:any"),
    WaitlistEntryController.expire,
  );
