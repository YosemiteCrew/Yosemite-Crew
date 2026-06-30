import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PreventiveCarePlanController } from "src/controllers/web/preventive-care-plan.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/preventive-care-plans",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PreventiveCarePlanController.list,
);

router.post(
  "/pms/organisation/:organisationId/preventive-care-plans",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PreventiveCarePlanController.create,
);

router.get(
  "/pms/organisation/:organisationId/preventive-care-plans/:planId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PreventiveCarePlanController.get,
);

router.put(
  "/pms/organisation/:organisationId/preventive-care-plans/:planId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PreventiveCarePlanController.update,
);

router.post(
  "/pms/organisation/:organisationId/preventive-care-plans/:planId/items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PreventiveCarePlanController.addItem,
);

router.post(
  "/pms/organisation/:organisationId/preventive-care-plans/:planId/items/:itemId/complete",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PreventiveCarePlanController.completeItem,
);

export default router;
