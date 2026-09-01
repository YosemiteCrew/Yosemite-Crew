import { Router } from "express";
import { requireWebAuth } from "src/middlewares/auth";
import { requireActiveAccount } from "src/middlewares/require-active-account";
import { DeveloperUsageController } from "../controllers/web/developer-usage.controller";

const developerUsageRouter = Router();

/*
 * `requireWebAuth` only, deliberately, with no role or organisation gate.
 *
 * Usage belongs to the developer, and the handler scopes its query to
 * `resolveVerifiedUserId(req)` - the caller's own session-derived id.
 * `withOrgPermissions()` made this unreachable for the accounts it exists for:
 * a developer signup creates no UserOrganization row, so the middleware
 * answered 400 before the handler ran (issue #2551).
 *
 * A reviewer will want to add a `developer` role check back. Do not: the role is
 * self-assignable via `POST /fhir/v1/user`, so gating on it would turn a value
 * the caller controls into an authorisation input.
 */

developerUsageRouter.get(
  "/",
  requireWebAuth,
  requireActiveAccount(),
  DeveloperUsageController.getUsage,
);

export default developerUsageRouter;
