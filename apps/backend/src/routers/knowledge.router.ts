import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireWebAuth, requireMobileAuth } from "src/middlewares/auth";
import { requirePermission, withOrgPermissions } from "src/middlewares/rbac";
import { MerckController } from "src/controllers/web/merck.controller";
import { MerckMobileController } from "src/controllers/app/merck.controller";
import { resolveVerifiedUserId } from "src/utils/request";

const router = Router();

// Keyed only on the session-verified caller. Both routes sit behind auth, and the
// mobile route has no :organisationId, so folding in a client-supplied x-org-id would
// let one token mint a fresh bucket per header value. This limiter fronts shared Merck
// credentials, so the key must be unforgeable rather than merely granular.
const merckSearchLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => resolveVerifiedUserId(req) ?? "unknown-user",
});

router.get(
  "/pms/organisation/:organisationId/merck/manuals/search",
  requireWebAuth,
  withOrgPermissions(),
  requirePermission("integrations:view:any"),
  merckSearchLimiter,
  (req, res) => MerckController.searchManuals(req, res),
);

router.get(
  "/mobile/merck/manuals/search",
  requireMobileAuth,
  merckSearchLimiter,
  (req, res) => MerckMobileController.searchManuals(req, res),
);

export default router;
