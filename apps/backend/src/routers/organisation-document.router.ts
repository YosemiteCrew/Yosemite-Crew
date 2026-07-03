import { Router } from "express";
import { OrganizationDocumentController } from "src/controllers/web/organisation-document.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Upload document file
router.post(
  "/pms/:orgId/documents/upload",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  OrganizationDocumentController.uploadFile,
);

// Create document record
router.post(
  "/pms/:orgId/documents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  OrganizationDocumentController.create,
);

// Update document metadata
router.patch(
  "/pms/:orgId/documents/:documentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  OrganizationDocumentController.update,
);

// Delete document
router.delete(
  "/pms/:orgId/documents/:documentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  OrganizationDocumentController.remove,
);

// List documents for organisation
router.get(
  "/pms/:orgId/documents",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  OrganizationDocumentController.list,
);

// Get document by id
router.get(
  "/pms/:orgId/documents/:documentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  OrganizationDocumentController.getById,
);

// Upsert policy documents
router.post(
  "/pms/:orgId/documents/policy",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  OrganizationDocumentController.upsertPolicy,
);

/* ======================================================
   MOBILE ROUTES (PUBLIC / READ-ONLY)
   ====================================================== */

router.get(
  "/mobile/:orgId/documents",
  requireMobileAuth,
  OrganizationDocumentController.listPublic,
);

export default router;
