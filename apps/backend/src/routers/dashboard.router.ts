import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { DashboardController } from "src/controllers/web/dashboard.controller";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/summary/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.summary,
);
router.get(
  "/appointments/:organisationId/trend",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.appointmentsTrend,
);
router.get(
  "/revenue/:organisationId/trend",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.revenueTrend,
);
router.get(
  "/appointment-leaders/:organisationId",
  authorizeCognito,
  withOrgPermissions,
  requirePermission(["analytics:view:any"]),
  DashboardController.appointmentLeaders,
);
router.get(
  "/revenue-leaders/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.revenueLeaders,
);
router.get(
  "/inventory/:organisationId/turnover",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.inventoryTurnover,
);
router.get(
  "/inventory/:organisationId/products",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.productTurnover,
);

export default router;
