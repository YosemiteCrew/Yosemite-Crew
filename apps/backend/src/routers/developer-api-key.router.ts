import { Router } from "express";
import { DeveloperApiKeyController } from "../controllers/web/developer-api-key.controller";
import { requireWebAuth } from "src/middlewares/auth";
import { requireActiveAccount } from "src/middlewares/require-active-account";

const router = Router();

/*
 * `requireWebAuth` only, deliberately, with no role or organisation gate.
 *
 * These resources belong to the developer, and the handlers scope every query
 * to `resolveVerifiedUserId(req)` - the caller's own session-derived id. There
 * is nothing for an org gate to protect here, and `withOrgPermissions()` made
 * the routes unreachable for the very accounts they exist for: a developer
 * signup creates no UserOrganization row, so the middleware answered 400 before
 * any handler ran (issue #2551).
 *
 * `requireActiveAccount()` sits alongside it because the soft delete leaves the
 * session valid: an org-gated route is covered incidentally, since deletion
 * removes the memberships `withOrgPermissions()` needs, but a user-scoped route
 * has no such cover and would otherwise let a deleted account mint credentials.
 *
 * A reviewer will want to add a `developer` role check back. Do not: the role is
 * self-assignable. `SELF_ASSIGNABLE_ROLES` in `user.controller.ts` lets a caller
 * claim `developer` by posting it to `POST /fhir/v1/user`, so gating on it would
 * turn a value the caller controls into an authorisation input. The session is
 * the authority, and ownership is enforced in the query.
 */

router.post(
  "/",
  requireWebAuth,
  requireActiveAccount(),
  DeveloperApiKeyController.createApiKey,
);
router.get(
  "/",
  requireWebAuth,
  requireActiveAccount(),
  DeveloperApiKeyController.listApiKeys,
);
router.delete(
  "/:keyId",
  requireWebAuth,
  requireActiveAccount(),
  DeveloperApiKeyController.revokeApiKey,
);

export default router;
