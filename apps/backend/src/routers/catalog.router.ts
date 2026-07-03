import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { CatalogController } from "src/controllers/web/catalog.controller";

const router = Router();

// Compatibility-only JSON routes. New catalog clients should prefer
// /fhir/v1/healthcare-service and its custom FHIR operations.

router.post(
  "/products",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createProduct,
);

router.patch(
  "/products/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateProduct,
);

router.get(
  "/products/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getProductById,
);

router.get(
  "/packages/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getPackageDetail,
);

router.get(
  "/organisation/:organisationId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listProducts,
);

router.get(
  "/organisations/:organisationId/summary",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getOrganisationSummary,
);

router.get(
  "/organisations/:organisationId/services/nearby",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getCatalogNearbyOrganisations,
);

router.post(
  "/organisations/:organisationId/bookable-slots",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getCatalogBookableSlots,
);

router.post(
  "/organisations/:organisationId/bookable-slots/calendar-prefill",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getCatalogCalendarPrefill,
);

router.get(
  "/organisations/:organisationId/specialities",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listSpecialities,
);

router.post(
  "/organisations/:organisationId/specialities",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createSpeciality,
);

router.patch(
  "/organisations/:organisationId/specialities/:specialityId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateSpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/archive",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.archiveSpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/restore",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.restoreSpeciality,
);

router.delete(
  "/organisations/:organisationId/specialities/:specialityId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.deleteSpeciality,
);

router.get(
  "/organisation/:organisationId/specialities/:specialityId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getSpecialityCatalog,
);

router.get(
  "/organisations/:organisationId/specialities/:specialityId/services",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listServicesBySpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/services",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createService,
);

router.patch(
  "/organisations/:organisationId/services/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updateService,
);

router.post(
  "/organisations/:organisationId/services/:id/archive",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.archiveService,
);

router.post(
  "/organisations/:organisationId/services/:id/restore",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.restoreService,
);

router.delete(
  "/organisations/:organisationId/services/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.deleteService,
);

router.get(
  "/organisations/:organisationId/specialities/:specialityId/packages",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.listPackagesBySpeciality,
);

router.post(
  "/organisations/:organisationId/specialities/:specialityId/packages",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.createPackage,
);

router.get(
  "/organisations/:organisationId/packages/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getPackageDetail,
);

router.patch(
  "/organisations/:organisationId/packages/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.updatePackage,
);

router.post(
  "/organisations/:organisationId/packages/:id/archive",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.archivePackage,
);

router.post(
  "/organisations/:organisationId/packages/:id/restore",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.restorePackage,
);

router.delete(
  "/organisations/:organisationId/packages/:id",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:edit:any"),
  CatalogController.deletePackage,
);

router.get(
  "/organisations/:organisationId/items/search",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.searchItems,
);

router.get(
  "/organisations/:organisationId/specialities/:specialityId/archive",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.getArchiveCatalog,
);

router.post(
  "/resolve",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("specialities:view:any"),
  CatalogController.resolveProduct,
);

export default router;
