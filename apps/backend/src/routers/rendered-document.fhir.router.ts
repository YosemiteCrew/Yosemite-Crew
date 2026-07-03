import { Router } from "express";
import { RenderedDocumentFhirController } from "src/controllers/web/rendered-document.fhir.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.get(
  "/organisation/:organisationId/:renderedDocumentId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:view:any", "prescription:view:any"]),
  (req, res) => RenderedDocumentFhirController.getRenderedDocument(req, res),
);

router.get(
  "/organisation/:organisationId/:renderedDocumentId/pdf",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:view:any", "prescription:view:any"]),
  (req, res) => RenderedDocumentFhirController.getRenderedDocumentPdf(req, res),
);

router.post(
  "/organisation/:organisationId/:renderedDocumentId/rerender-pdf",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any", "prescription:edit:any"]),
  (req, res) =>
    RenderedDocumentFhirController.rerenderRenderedDocumentPdf(req, res),
);

router.post(
  "/organisation/:organisationId/:renderedDocumentId/sign",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission(["forms:edit:any", "prescription:edit:any"]),
  (req, res) => RenderedDocumentFhirController.signRenderedDocument(req, res),
);

export default router;
