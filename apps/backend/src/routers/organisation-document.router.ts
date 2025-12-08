import { Router } from "express";
import { OrganizationDocumentController } from "src/controllers/web/organisation-document.controller";
import { authorizeCognito, authorizeCognitoMobile } from "src/middlewares/auth";

const router = Router();

/**
 * PMS ROUTES
 */

router.get(
  "/pms/:orgId/documents/upload",
  authorizeCognito,
  OrganizationDocumentController.uploadFile,
);

router.post(
  "/pms/:orgId/documents",
  authorizeCognito,
  OrganizationDocumentController.create,
);

router.patch(
  "/pms/:orgId/documents/:documentId",
  authorizeCognito,
  OrganizationDocumentController.update,
);

router.delete(
  "/pms/:orgId/documents/:documentId",
  authorizeCognito,
  OrganizationDocumentController.remove,
);

router.get(
  "/pms/:orgId/documents",
  authorizeCognito,
  OrganizationDocumentController.list,
);

router.get(
  "/pms/:orgId/documents/:documentId",
  authorizeCognito,
  OrganizationDocumentController.getById,
);

/** Upsert policy docs */
router.post(
  "/pms/:orgId/documents/policy",
  authorizeCognito,
  OrganizationDocumentController.upsertPolicy,
);

/**
 * MOBILE ROUTES
 */
router.get(
  "/mobile/:orgId/documents",
  authorizeCognitoMobile,
  OrganizationDocumentController.listPublic,
);

export default router;
