import { Router } from "express";
import { RenderedDocumentFhirController } from "src/controllers/web/rendered-document.fhir.controller";
import { requireWebAuth } from "src/middlewares/auth";
import {
  requirePermission,
  withRenderedDocumentOrgPermissions,
} from "src/middlewares/rbac";

const router = Router();

router.get(
  "/organisation/:organisationId/:renderedDocumentId",
  requireWebAuth,
  withRenderedDocumentOrgPermissions(),
  requirePermission(["forms:view:any", "prescription:view:any"]),
  (req, res) => RenderedDocumentFhirController.getRenderedDocument(req, res),
);

router.get(
  "/organisation/:organisationId/:renderedDocumentId/pdf",
  requireWebAuth,
  withRenderedDocumentOrgPermissions(),
  requirePermission(["forms:view:any", "prescription:view:any"]),
  (req, res) => RenderedDocumentFhirController.getRenderedDocumentPdf(req, res),
);

router.post(
  "/organisation/:organisationId/:renderedDocumentId/rerender-pdf",
  requireWebAuth,
  withRenderedDocumentOrgPermissions(),
  requirePermission(["forms:edit:any", "prescription:edit:any"]),
  (req, res) =>
    RenderedDocumentFhirController.rerenderRenderedDocumentPdf(req, res),
);

router.post(
  "/organisation/:organisationId/:renderedDocumentId/sign",
  requireWebAuth,
  withRenderedDocumentOrgPermissions(),
  requirePermission(["forms:edit:any", "prescription:edit:any"]),
  (req, res) => RenderedDocumentFhirController.signRenderedDocument(req, res),
);

export default router;
