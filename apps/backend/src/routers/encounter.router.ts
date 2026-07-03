import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { EncounterController } from "src/controllers/web/case-encounter.controller";

const router = Router();

router.post(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.create,
);

router.patch(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.update,
);

router.post(
  String.raw`/:id/\$discharge`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.discharge,
);

router.post(
  String.raw`/:id/\$assign-unit`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.assignUnit,
);

router.get(
  String.raw`/:id/\$unit-assignments`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.listUnitAssignments,
);

router.get(
  String.raw`/:id/\$admission-unit-assignments`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.listAdmissionUnitAssignments,
);

router.post(
  String.raw`/:id/\$start`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.start,
);

router.post(
  String.raw`/:id/\$ready-for-discharge`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.readyForDischarge,
);

router.post(
  String.raw`/:id/\$undo-ready-for-discharge`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  EncounterController.undoReadyForDischarge,
);

router.get(
  String.raw`/\$active-inpatients`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.listActiveInpatients,
);

router.get(
  "/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.getById,
);

router.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  EncounterController.list,
);

export default router;
