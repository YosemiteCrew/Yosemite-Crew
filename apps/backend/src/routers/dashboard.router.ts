import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { DashboardController } from "src/controllers/web/dashboard.controller";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/summary/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.summary,
);
router.get(
  "/appointments/:organisationId/trend",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.appointmentsTrend,
);
router.get(
  "/revenue/:organisationId/trend",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.revenueTrend,
);
router.get(
  "/appointment-leaders/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.appointmentLeaders,
);
router.get(
  "/revenue-leaders/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.revenueLeaders,
);
router.get(
  "/inventory/:organisationId/turnover",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.inventoryTurnover,
);
router.get(
  "/inventory/:organisationId/products",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  DashboardController.productTurnover,
);

export default router;
