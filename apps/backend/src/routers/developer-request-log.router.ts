import { Router } from "express";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { DeveloperRequestLogController } from "../controllers/web/developer-request-log.controller";

// Management plane (session auth, same chain as the sibling developer
// routers): request-log observability for an organisation's API keys.
const developerRequestLogRouter = Router();

developerRequestLogRouter.get(
  "/",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  DeveloperRequestLogController.listRequestLogs,
);

export default developerRequestLogRouter;
