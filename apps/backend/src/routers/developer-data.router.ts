/*
 * The developer data plane: `/v1/developer`, authenticated by API key only.
 *
 * The plural `/v1/developers` management plane next door is the opposite
 * surface - browser session, no key - and the two must not converge. A session
 * is never accepted here and a key is never accepted there.
 *
 * Every org-scoped route composes four middlewares in this order, and the order
 * is load-bearing:
 *
 *   authorizeApiKey        verify the key, meter the call, bind req.userId
 *   requireScope(...)      the key must carry the scope for this resource
 *   withOrgPermissions()   caller must hold a live active membership of the
 *                          organisation named in x-org-id, resolved per request
 *   requirePermission(...) that membership must carry the read permission
 *
 * A key does NOT carry an organisation (#2599 removed `organisationId` from
 * `DeveloperApiKey`; it holds `ownerUserId`). That is why the practice arrives
 * per request and is re-checked every time: a key with a practice baked into it
 * keeps reading that practice after its holder is offboarded, while a live
 * membership check stops the moment the membership goes inactive.
 *
 * Routes addressed by a resource id use `withAppointmentOrgPermissions()`
 * instead, which derives the organisation from the record rather than from the
 * caller. Without that, a holder of two practices could name practice A in
 * `x-org-id` while fetching a record owned by practice B.
 */
import { Router } from "express";
import { authorizeApiKey, requireScope } from "src/middlewares/api-key-auth";
import {
  requirePermission,
  withAppointmentOrgPermissions,
  withOrgPermissions,
} from "src/middlewares/rbac";
import { DeveloperDataController } from "../controllers/web/developer-data.controller";

const developerDataRouter = Router();

developerDataRouter.use(authorizeApiKey);

/*
 * Not org-gated, deliberately: this is how a key holder discovers which
 * practices they may name in `x-org-id`, so it cannot itself require one. It
 * reads only the caller's own active memberships.
 */
developerDataRouter.get(
  "/organizations",
  DeveloperDataController.listOrganizations,
);

/*
 * Also not org-gated, and scope-free: usage belongs to the developer, not to a
 * practice, and a key that has exhausted its quota still needs to be able to
 * read why. `authorizeApiKey` answers 429 before this handler on a key that is
 * over quota, so this reports the state that produced the 429 on the next
 * period rather than acting as an escape hatch.
 */
developerDataRouter.get("/usage", DeveloperDataController.getUsage);

developerDataRouter.get(
  "/appointments",
  requireScope("appointments:read"),
  withOrgPermissions(),
  requirePermission("appointments:view:any"),
  DeveloperDataController.listAppointments,
);

developerDataRouter.get(
  "/appointments/:appointmentId",
  requireScope("appointments:read"),
  withAppointmentOrgPermissions(),
  requirePermission("appointments:view:any"),
  DeveloperDataController.getAppointment,
);

export default developerDataRouter;
