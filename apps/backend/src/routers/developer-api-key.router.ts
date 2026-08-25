import { Router } from "express";
import { DeveloperApiKeyController } from "../controllers/web/developer-api-key.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  DeveloperApiKeyController.createApiKey,
);
router.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  DeveloperApiKeyController.listApiKeys,
);
router.delete(
  "/:keyId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:edit:any"),
  DeveloperApiKeyController.revokeApiKey,
);

export default router;
