import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { LabOrderController } from "src/controllers/web/lab-order.controller";
import { LabCensusController } from "src/controllers/web/lab-census.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/:provider/orders",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.listOrders(req, res),
);
router.post(
  "/pms/organisation/:organisationId/:provider/orders/search",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.searchOrders(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/tests",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.listProviderTests(req, res),
);
router.post(
  "/pms/organisation/:organisationId/:provider/tests",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.listProviderTests(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/ivls/devices",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabCensusController.listIvlsDevices(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/census",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabCensusController.listCensus(req, res),
);

router.delete(
  "/pms/organisation/:organisationId/:provider/census",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabCensusController.deleteCensus(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/census/:censusId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabCensusController.getCensusById(req, res),
);

router.delete(
  "/pms/organisation/:organisationId/:provider/census/:censusId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabCensusController.deleteCensusById(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/census/patient/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabCensusController.getCensusPatient(req, res),
);
router.post(
  "/pms/organisation/:organisationId/:provider/census/patient",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabCensusController.getCensusPatient(req, res),
);

router.post(
  "/pms/organisation/:organisationId/:provider/census",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabCensusController.addCensusPatient(req, res),
);

router.delete(
  "/pms/organisation/:organisationId/:provider/census/patient/:patientId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabCensusController.deleteCensusPatient(req, res),
);

router.post(
  "/pms/organisation/:organisationId/:provider/orders",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabOrderController.createIdexxOrder(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/orders/:idexxOrderId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.getOrder(req, res),
);

router.put(
  "/pms/organisation/:organisationId/:provider/orders/:idexxOrderId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabOrderController.updateOrder(req, res),
);

router.delete(
  "/pms/organisation/:organisationId/:provider/orders/:idexxOrderId",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabOrderController.cancelOrder(req, res),
);

export default router;
