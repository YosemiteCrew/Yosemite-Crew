import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { LabOrderController } from "src/controllers/web/lab-order.controller";

const router = Router();

router.get(
  "/pms/organisation/:organisationId/:provider/tests",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.listProviderTests(req, res),
);

router.post(
  "/pms/organisation/:organisationId/:provider/orders",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabOrderController.createIdexxOrder(req, res),
);

router.get(
  "/pms/organisation/:organisationId/:provider/orders/:idexxOrderId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:view:any"),
  (req, res) => LabOrderController.getOrder(req, res),
);

router.put(
  "/pms/organisation/:organisationId/:provider/orders/:idexxOrderId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabOrderController.updateOrder(req, res),
);

router.delete(
  "/pms/organisation/:organisationId/:provider/orders/:idexxOrderId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("labs:edit:any"),
  (req, res) => LabOrderController.cancelOrder(req, res),
);

export default router;
