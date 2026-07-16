import { Router } from "express";
import { DocumentController } from "../controllers/app/document.controller";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/mobile/upload-url",
  requireMobileAuth,
  DocumentController.getUploadUrl,
);

router.get(
  "/mobile/search/:patientId",
  requireMobileAuth,
  DocumentController.searchDocumentMobile,
);

router.post(
  "/mobile/:patientId",
  requireMobileAuth,
  DocumentController.createDocument,
);

router.get(
  "/mobile/:patientId",
  requireMobileAuth,
  DocumentController.listDocumentsForParent,
);

router.patch(
  "/mobile/details/:id",
  requireMobileAuth,
  DocumentController.updateDocument,
);

router.post(
  "/mobile/appointments/:appointmentId",
  requireMobileAuth,
  DocumentController.listForAppointment,
);

router.get(
  "/mobile/view/:documentId",
  requireMobileAuth,
  DocumentController.getDocumentDownloadUrl,
);

router.post(
  "/mobile/view",
  requireMobileAuth,
  DocumentController.getSignedDownloadUrl,
);

router.delete(
  "/mobile/:documentId",
  requireMobileAuth,
  DocumentController.deleteForParent,
);

router.get(
  "/search/:patientId",
  requireMobileAuth,
  DocumentController.searchDocument,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Generate upload URL (PMS)
router.post(
  "/pms/upload-url",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  DocumentController.getUploadUrl,
);

// Create document (PMS)
router.post(
  "/pms/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  DocumentController.createDocumentPms,
);

// List documents for companion (PMS)
router.get(
  "/pms/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.listForPms,
);

// Get document details (PMS)
router.get(
  "/pms/details/:documentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.getForPms,
);

// Update document (PMS)
router.patch(
  "/pms/details/:documentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  DocumentController.updateDocument,
);

// Download document (PMS)
router.get(
  "/pms/view/:documentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.getDocumentDownloadUrl,
);

// Signed download URL (PMS)
router.post(
  "/pms/view",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.getSignedDownloadUrl,
);

// List documents for appointment (PMS)
router.post(
  "/pms/appointments/:appointmentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.listForAppointment,
);

export default router;
