import { Router } from "express";
import { requirePermission } from "src/middlewares/rbac";
import { MedicalCertificateController } from "src/controllers/web/medical-certificate.controller";

export const medicalCertificateRouter = Router({ mergeParams: true });

const BASE = "/pms/organisation/:organisationId/medical-certificates";

medicalCertificateRouter
  .route(BASE)
  .get(
    requirePermission("companions:view:any"),
    MedicalCertificateController.list,
  )
  .post(
    requirePermission("companions:edit:any"),
    MedicalCertificateController.create,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId`)
  .get(
    requirePermission("companions:view:any"),
    MedicalCertificateController.get,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId/issue`)
  .post(
    requirePermission("companions:edit:any"),
    MedicalCertificateController.issue,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId/revoke`)
  .post(
    requirePermission("companions:edit:any"),
    MedicalCertificateController.revoke,
  );

medicalCertificateRouter
  .route(`${BASE}/:certId/expire`)
  .post(
    requirePermission("companions:edit:any"),
    MedicalCertificateController.expire,
  );
