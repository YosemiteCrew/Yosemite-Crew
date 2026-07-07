import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { DeveloperSandboxController } from "../controllers/web/developer-sandbox.controller";

// Management plane (session auth, same chain as the sibling developer
// routers): seeded demo clinic lifecycle for a developer organisation.
const developerSandboxRouter = Router();

developerSandboxRouter.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  DeveloperSandboxController.createSandbox,
);
developerSandboxRouter.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  DeveloperSandboxController.getSandbox,
);
developerSandboxRouter.delete(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  DeveloperSandboxController.deleteSandbox,
);

export default developerSandboxRouter;
