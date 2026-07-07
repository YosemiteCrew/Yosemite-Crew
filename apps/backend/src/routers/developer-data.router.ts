import { Router } from "express";
import {
  authorizeApiKey,
  authorizeApiKeyVerifyOnly,
  requireScope,
} from "src/middlewares/api-key-auth";
import { DeveloperDataController } from "../controllers/web/developer-data.controller";

// Developer Data API v1 (mounted at /v1/developer): API-key-authenticated,
// org-scoped, read-only. The management plane at /v1/developers stays
// session-authenticated; the two never mix (contract section 1).
const developerDataRouter = Router();

// Usage introspection must stay reachable when the monthly quota is exhausted,
// so it is registered BEFORE the quota-enforcing authorizeApiKey and uses the
// verify-only variant (contract 3.6). No scope required: any valid key may
// always see where it stands.
developerDataRouter.get(
  "/usage",
  authorizeApiKeyVerifyOnly,
  DeveloperDataController.getUsage,
);

// Everything below verifies the key, applies the per-key rate limit, and
// increments the monthly quota.
developerDataRouter.use(authorizeApiKey);

developerDataRouter.get(
  "/appointments",
  requireScope("appointments:read"),
  DeveloperDataController.listAppointments,
);
developerDataRouter.get(
  "/appointments/:id",
  requireScope("appointments:read"),
  DeveloperDataController.getAppointment,
);
developerDataRouter.get(
  "/patients",
  requireScope("patients:read"),
  DeveloperDataController.listPatients,
);
developerDataRouter.get(
  "/patients/:id",
  requireScope("patients:read"),
  DeveloperDataController.getPatient,
);
developerDataRouter.get(
  "/encounters",
  requireScope("encounters:read"),
  DeveloperDataController.listEncounters,
);
developerDataRouter.get(
  "/encounters/:id",
  requireScope("encounters:read"),
  DeveloperDataController.getEncounter,
);
developerDataRouter.get(
  "/invoices",
  requireScope("invoices:read"),
  DeveloperDataController.listInvoices,
);
developerDataRouter.get(
  "/invoices/:id",
  requireScope("invoices:read"),
  DeveloperDataController.getInvoice,
);
developerDataRouter.get(
  "/organization",
  requireScope("organization:read"),
  DeveloperDataController.getOrganization,
);

export default developerDataRouter;
