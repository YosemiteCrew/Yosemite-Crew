import { Router } from "express";
import { ClinicEquipmentController } from "src/controllers/web/clinic-equipment.controller";
import { requirePermission } from "src/middlewares/rbac";

export const clinicEquipmentRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/clinic-equipment";

clinicEquipmentRouter.post(
  BASE,
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.create,
);

clinicEquipmentRouter.get(
  BASE,
  requirePermission("inventory:view:any"),
  ClinicEquipmentController.list,
);

clinicEquipmentRouter.get(
  `${BASE}/:equipmentId`,
  requirePermission("inventory:view:any"),
  ClinicEquipmentController.get,
);

clinicEquipmentRouter.patch(
  `${BASE}/:equipmentId`,
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.update,
);

clinicEquipmentRouter.delete(
  `${BASE}/:equipmentId`,
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.delete,
);

clinicEquipmentRouter.post(
  `${BASE}/:equipmentId/maintenance-logs`,
  requirePermission("inventory:edit:any"),
  ClinicEquipmentController.addMaintenanceLog,
);

clinicEquipmentRouter.get(
  `${BASE}/:equipmentId/maintenance-logs`,
  requirePermission("inventory:view:any"),
  ClinicEquipmentController.listMaintenanceLogs,
);
