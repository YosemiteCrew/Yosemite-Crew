import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { SearchController } from "src/controllers/web/search.controller";

const router = Router();

router.get(
  "/organisations/:organisationId/medications",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission(["inventory:view:any", "prescription:view:any"]),
  (req, res) => SearchController.searchMedications(req, res),
);

router.get(
  "/organisations/:organisationId/inventory-items",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("inventory:view:any"),
  (req, res) => SearchController.searchInventoryItems(req, res),
);

router.get(
  "/organisations/:organisationId/templates",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  (req, res) => SearchController.searchTemplates(req, res),
);

router.get(
  "/organisations/:organisationId/tasks",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("tasks:view:any"),
  (req, res) => SearchController.searchTasks(req, res),
);

router.get(
  "/organisations/:organisationId/documents",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req, res) => SearchController.searchDocuments(req, res),
);

router.get(
  "/organisations/:organisationId/services",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  (req, res) => SearchController.searchServices(req, res),
);

router.get(
  "/organisations/:organisationId/packages",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  (req, res) => SearchController.searchPackages(req, res),
);

export default router;
