import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { withOrgPermissions, requirePermission } from "src/middlewares/rbac";
import { PatientProblemController } from "src/controllers/web/patient-problem.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/patient-problems",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientProblemController.list,
);

router.post(
  "/pms/organisation/:organisationId/patient-problems",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientProblemController.create,
);

router.get(
  "/pms/organisation/:organisationId/patient-problems/:problemId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  PatientProblemController.get,
);

router.put(
  "/pms/organisation/:organisationId/patient-problems/:problemId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientProblemController.update,
);

router.post(
  "/pms/organisation/:organisationId/patient-problems/:problemId/resolve",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("appointments:edit:any"),
  PatientProblemController.resolve,
);

export default router;
