import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { TemplatePackController } from "../controllers/web/template-pack.controller";

// Management plane (session auth, same chain as the sibling developer
// routers): template pack publishing and installs
// (plan: developer-portal-plugin-registry.md). The catalog is readable by any
// authenticated org session; mutations need the integrations edit permission
// like the sandbox lifecycle.
const templatePackRouter = Router();

// Registered before "/:id/..." so "catalog" is never captured as a pack id.
templatePackRouter.get(
  "/catalog",
  authorizeCognito,
  withOrgPermissions(),
  TemplatePackController.getCatalog,
);

templatePackRouter.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  TemplatePackController.createPack,
);
templatePackRouter.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  TemplatePackController.listPacks,
);
templatePackRouter.post(
  "/:id/publish",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  TemplatePackController.publishPack,
);
// Install materializes DRAFT templates only (ADR 0005): nothing goes live in
// the installing org until a human publishes each draft.
templatePackRouter.post(
  "/:id/install",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  TemplatePackController.installPack,
);
templatePackRouter.delete(
  "/:id/install",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  TemplatePackController.uninstallPack,
);

export default templatePackRouter;
