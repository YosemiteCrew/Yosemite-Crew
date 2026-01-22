import { Router } from "express";
import { DocumentController } from "../controllers/app/document.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";

const router = Router();

/* ======================================================
   MOBILE ROUTES (PARENT / OWN CONTEXT)
   ====================================================== */

router.post(
  "/mobile/upload-url",
  authorizeCognitoMobile,
  DocumentController.getUploadUrl,
);

router.post(
  "/mobile/:companionId",
  authorizeCognitoMobile,
  DocumentController.createDocument,
);

router.get(
  "/mobile/:companionId",
  authorizeCognitoMobile,
  DocumentController.listDocumentsForParent,
);

router.patch(
  "/mobile/details/:id",
  authorizeCognitoMobile,
  DocumentController.updateDocument,
);

router.get(
  "/mobile/appointments/:appointmentId",
  authorizeCognitoMobile,
  DocumentController.listForAppointment,
);

router.get(
  "/mobile/view/:documentId",
  authorizeCognitoMobile,
  DocumentController.getDocumentDownloadUrl,
);

router.post(
  "/mobile/view",
  authorizeCognitoMobile,
  DocumentController.getSignedDownloadUrl,
);

router.delete(
  "/mobile/:documentId",
  authorizeCognitoMobile,
  DocumentController.deleteForParent,
);

router.get(
  "/search/:companionId",
  authorizeCognitoMobile,
  DocumentController.searchDocument,
);

/* ======================================================
   PMS ROUTES (RBAC ENABLED)
   ====================================================== */

// Create document (PMS)
router.post(
  "/pms/:companionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  DocumentController.createDocumentPms,
);

// List documents for companion (PMS)
router.get(
  "/pms/:companionId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.listForPms,
);

// Get document details (PMS)
router.get(
  "/pms/details/:documentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.getForPms,
);

// Update document (PMS)
router.patch(
  "/pms/details/:documentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:edit:any"),
  DocumentController.updateDocument,
);

// Download document (PMS)
router.get(
  "/pms/view/:documentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.getDocumentDownloadUrl,
);

// Signed download URL (PMS)
router.post(
  "/pms/view",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.getSignedDownloadUrl,
);

// List documents for appointment (PMS)
router.get(
  "/pms/appointments/:appointmentId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  DocumentController.listForAppointment,
);

export default router;
