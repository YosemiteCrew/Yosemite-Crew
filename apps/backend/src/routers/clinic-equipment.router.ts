import { Router } from "express";
import { ClinicEquipmentController } from "src/controllers/web/clinic-equipment.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

export const clinicEquipmentRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/clinic-equipment";

clinicEquipmentRouter.post(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.create,
);

clinicEquipmentRouter.get(
  BASE,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  ClinicEquipmentController.list,
);

clinicEquipmentRouter.get(
  `${BASE}/:equipmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  ClinicEquipmentController.get,
);

clinicEquipmentRouter.patch(
  `${BASE}/:equipmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.update,
);

clinicEquipmentRouter.delete(
  `${BASE}/:equipmentId`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.delete,
);

clinicEquipmentRouter.post(
  `${BASE}/:equipmentId/maintenance-logs`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.addMaintenanceLog,
);

clinicEquipmentRouter.get(
  `${BASE}/:equipmentId/maintenance-logs`,
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  ClinicEquipmentController.listMaintenanceLogs,
);
