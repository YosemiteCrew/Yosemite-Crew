import { Request, Response, Router } from "express";
import {
  DocumensoAuthController,
  DocumensoKeyController,
} from "src/controllers/web/documenso.controller";
import { authorizeCognito } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";

const router = Router();

router.post(
  "/pms/redirect/:orgId",
  authorizeCognito,
  withOrgPermissions(),
  requirePermission("document:view:any"),
  (req: Request<{ orgId: string }>, res: Response) =>
    DocumensoAuthController.createRedirectUrl(req, res),
);

router.post(
  "/pms/store-api-key/:orgId",
  (req: Request<{ orgId: string }>, res: Response) =>
    DocumensoKeyController.storeApiKey(req, res),
);

export default router;
