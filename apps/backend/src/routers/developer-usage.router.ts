import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { DeveloperUsageController } from "../controllers/web/developer-usage.controller";

const developerUsageRouter = Router();

developerUsageRouter.get(
  "/",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("billing:view:any"),
  DeveloperUsageController.getUsage,
);

export default developerUsageRouter;
