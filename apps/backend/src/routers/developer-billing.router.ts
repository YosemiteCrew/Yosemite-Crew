import { Router } from "express";
import { DeveloperBillingController } from "../controllers/web/developer-billing.controller";
import { requireWebAuth } from "src/middlewares/auth";

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
 * A reviewer will want to add a `developer` role check back. Do not: the role is
 * self-assignable. `SELF_ASSIGNABLE_ROLES` in `user.controller.ts` lets a caller
 * claim `developer` by posting it to `POST /fhir/v1/user`, so gating on it would
 * turn a value the caller controls into an authorisation input. The session is
 * the authority, and ownership is enforced in the query.
 */

/*
 * `POST /v1/developers/billing/webhook` is deliberately NOT here. Stripe's
 * signature check needs the unparsed body, and this router mounts after the
 * global `express.json()`, so a raw parser on it would never run. It is
 * registered directly on the app alongside the other webhooks instead - see
 * `app.ts`.
 */

router.get("/", requireWebAuth, DeveloperBillingController.getSubscription);

router.post(
  "/checkout",
  requireWebAuth,
  DeveloperBillingController.createCheckout,
);

router.post("/portal", requireWebAuth, DeveloperBillingController.createPortal);

export default router;
