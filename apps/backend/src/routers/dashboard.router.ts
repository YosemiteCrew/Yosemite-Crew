import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { DashboardController } from "src/controllers/web/dashboard.controller";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { SavedReportController } from "src/controllers/web/saved-report.controller";

const router = Router();

router.get(
  "/views/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  SavedReportController.listViews,
);
router.post(
  "/views/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:edit:any"]),
  SavedReportController.createView,
);
router.patch(
  "/views/:organisationId/:viewId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:edit:any"]),
  SavedReportController.updateView,
);
router.delete(
  "/views/:organisationId/:viewId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:edit:any"]),
  SavedReportController.deleteView,
);
router.get(
  "/schedules/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:view:any"]),
  SavedReportController.listSchedules,
);
router.post(
  "/schedules/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:edit:any"]),
  SavedReportController.createSchedule,
);
router.patch(
  "/schedules/:organisationId/:scheduleId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:edit:any"]),
  SavedReportController.updateSchedule,
);
router.delete(
  "/schedules/:organisationId/:scheduleId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["analytics:edit:any"]),
  SavedReportController.deleteSchedule,
);

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
