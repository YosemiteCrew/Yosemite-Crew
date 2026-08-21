import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { MARController } from "src/controllers/web/mar.controller";

const router = Router();

// A MAR entry is a medication administration record: creating one, or moving it
// to GIVEN / HELD / MISSED, is a clinical drug action, not a scheduling action.
// These routes previously authorised against `appointments:*`, which every role
// including RECEPTIONIST holds - and RECEPTIONIST has no prescription rights at
// all. `:any`/`:own` of the same resource is the repo's established any-of
// idiom, so clinicians keep working while non-clinical roles lose the routes.
const VIEW_MEDICATION_RECORDS = [
  "prescription:view:any",
  "prescription:view:own",
] as const;
const EDIT_MEDICATION_RECORDS = [
  "prescription:edit:any",
  "prescription:edit:own",
] as const;

router.get(
  "/pms/organisation/:organisationId/mar-entries",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission([...VIEW_MEDICATION_RECORDS]),
  MARController.list,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission([...EDIT_MEDICATION_RECORDS]),
  MARController.create,
);

router.get(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission([...VIEW_MEDICATION_RECORDS]),
  MARController.get,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/administer",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission([...EDIT_MEDICATION_RECORDS]),
  MARController.administer,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/hold",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission([...EDIT_MEDICATION_RECORDS]),
  MARController.hold,
);

router.post(
  "/pms/organisation/:organisationId/mar-entries/:marEntryId/miss",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission([...EDIT_MEDICATION_RECORDS]),
  MARController.markMissed,
);

export default router;
