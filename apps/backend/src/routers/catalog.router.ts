import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CatalogController } from "src/controllers/web/catalog.controller";

const router = Router();

// Compatibility-only JSON routes. New catalog clients should prefer
// /fhir/v1/healthcare-service and its custom FHIR operations.

router.post(
  "/products",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createProduct,
);

router.patch(
  "/products/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateProduct,
);

router.get(
  "/products/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getProductById,
);

router.get(
  "/packages/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getPackageDetail,
);

router.get(
  "/organisation/:organisationId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listProducts,
);

router.get(
  "/organisations/:organisationId/summary",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getOrganisationSummary,
);

router.get(
  "/organisations/:organisationId/services/nearby",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getCatalogNearbyOrganisations,
);

router.post(
  "/organisations/:organisationId/bookable-slots",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getCatalogBookableSlots,
);

router.post(
  "/organisations/:organisationId/bookable-slots/calendar-prefill",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getCatalogCalendarPrefill,
);

router.get(
  "/organisations/:organisationId/specialities",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listSpecialities,
);

router.post(
  "/organisations/:organisationId/specialities",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createSpeciality,
);

router.patch(
  "/organisations/:organisationId/specialities/:specialityId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateSpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/archive",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.archiveSpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/restore",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.restoreSpeciality,
);

router.delete(
  "/organisations/:organisationId/specialities/:specialityId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.deleteSpeciality,
);

router.get(
  "/organisation/:organisationId/specialities/:specialityId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getSpecialityCatalog,
);

router.get(
  "/organisations/:organisationId/specialities/:specialityId/services",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listServicesBySpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/services",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createService,
);

router.patch(
  "/organisations/:organisationId/services/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateService,
);

router.post(
  "/organisations/:organisationId/services/:id/archive",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.archiveService,
);

router.post(
  "/organisations/:organisationId/services/:id/restore",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.restoreService,
);

router.delete(
  "/organisations/:organisationId/services/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.deleteService,
);

router.get(
  "/organisations/:organisationId/specialities/:specialityId/packages",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listPackagesBySpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/packages",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createPackage,
);

router.get(
  "/organisations/:organisationId/packages/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getPackageDetail,
);

router.patch(
  "/organisations/:organisationId/packages/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updatePackage,
);

router.post(
  "/organisations/:organisationId/packages/:id/archive",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.archivePackage,
);

router.post(
  "/organisations/:organisationId/packages/:id/restore",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.restorePackage,
);

router.delete(
  "/organisations/:organisationId/packages/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.deletePackage,
);

router.get(
  "/organisations/:organisationId/items/search",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.searchItems,
);

router.get(
  "/organisations/:organisationId/specialities/:specialityId/archive",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getArchiveCatalog,
);

router.post(
  "/resolve",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.resolveProduct,
);

export default router;
