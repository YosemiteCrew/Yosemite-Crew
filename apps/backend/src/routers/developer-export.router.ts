import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { DeveloperExportController } from "../controllers/web/developer-export.controller";

// Management plane (session auth, same chain as the sibling developer
// routers): bulk NDJSON exports of the organisation's data-plane resources.
const developerExportRouter = Router();

developerExportRouter.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  DeveloperExportController.createExport,
);
developerExportRouter.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  DeveloperExportController.listExports,
);
developerExportRouter.get(
  "/:id",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  DeveloperExportController.getExport,
);

export default developerExportRouter;
