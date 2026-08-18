import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { MedicalCertificateController } from "src/controllers/web/medical-certificate.controller";

export const medicalCertificateRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/medical-certificates";

medicalCertificateRouter
  .route(BASE)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    MedicalCertificateController.list,
  )
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    MedicalCertificateController.create,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId`)
  .get(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:view:any"),
    MedicalCertificateController.get,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId/issue`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    MedicalCertificateController.issue,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId/revoke`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    MedicalCertificateController.revoke,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId/expire`)
  .post(
    requireWebAuth,
    withOrgPermissions(),
    requirePermission("companions:edit:any"),
    MedicalCertificateController.expire,
  );
