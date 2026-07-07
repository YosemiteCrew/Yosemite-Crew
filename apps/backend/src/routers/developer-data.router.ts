import { Router } from "express";
import {
  authorizeApiKey,
  authorizeApiKeyVerifyOnly,
  requireScope,
} from "src/middlewares/api-key-auth";
import { DeveloperDataController } from "../controllers/web/developer-data.controller";
import { DeveloperMcpController } from "../controllers/web/developer-mcp.controller";

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

// Stateless MCP protocol responses: GET (no server-initiated stream) and
// DELETE (no session to terminate) are 405 regardless of credentials, so they
// sit BEFORE authorizeApiKey and never consume rate limit or quota.
developerDataRouter.get("/mcp", DeveloperMcpController.methodNotAllowed);
developerDataRouter.delete("/mcp", DeveloperMcpController.methodNotAllowed);

// Everything below verifies the key, applies the per-key rate limit, and
// increments the monthly quota.
developerDataRouter.use(authorizeApiKey);

// Remote MCP endpoint: one quota unit per MCP POST, exactly like a REST call.
// No route-level requireScope - each tool enforces its own scope inside
// DeveloperMcpService so a mixed-scope key still sees its permitted tools.
developerDataRouter.post("/mcp", DeveloperMcpController.handlePost);

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
