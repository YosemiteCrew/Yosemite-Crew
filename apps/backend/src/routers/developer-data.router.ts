import { Router } from "express";
import {
  authorizeApiKey,
  authorizeApiKeyVerifyOnly,
  requireScope,
} from "src/middlewares/api-key-auth";
import { DeveloperDataController } from "../controllers/web/developer-data.controller";
import { DeveloperEventsController } from "../controllers/web/developer-events.controller";
import { DeveloperFhirController } from "../controllers/web/developer-fhir.controller";
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

// FHIR capability statement: valid key, NO scope, quota-exempt (FHIR plan
// section 3 - same carve-out as /usage).
developerDataRouter.get(
  "/fhir/metadata",
  authorizeApiKeyVerifyOnly,
  DeveloperFhirController.metadata,
);

// SSE event stream: the key is verified once at connect and the long-lived
// connection never increments the monthly quota (a stream is not N calls).
developerDataRouter.get(
  "/events",
  authorizeApiKeyVerifyOnly,
  DeveloperEventsController.stream,
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

// FHIR R4 dialect (plan: developer-portal-fhir-api.md): same scopes, same
// org scoping, same quota unit per call as the JSON endpoints above. The
// envelope differs (Bundle / OperationOutcome), nothing else does.
developerDataRouter.get(
  "/fhir/Organization",
  requireScope("organization:read"),
  DeveloperFhirController.searchOrganization,
);
developerDataRouter.get(
  "/fhir/Organization/:id",
  requireScope("organization:read"),
  DeveloperFhirController.readOrganization,
);
developerDataRouter.get(
  "/fhir/Patient",
  requireScope("patients:read"),
  DeveloperFhirController.searchPatients,
);
developerDataRouter.get(
  "/fhir/Patient/:id",
  requireScope("patients:read"),
  DeveloperFhirController.readPatient,
);
developerDataRouter.get(
  "/fhir/Appointment",
  requireScope("appointments:read"),
  DeveloperFhirController.searchAppointments,
);
developerDataRouter.get(
  "/fhir/Appointment/:id",
  requireScope("appointments:read"),
  DeveloperFhirController.readAppointment,
);
developerDataRouter.get(
  "/fhir/Encounter",
  requireScope("encounters:read"),
  DeveloperFhirController.searchEncounters,
);
developerDataRouter.get(
  "/fhir/Encounter/:id",
  requireScope("encounters:read"),
  DeveloperFhirController.readEncounter,
);
developerDataRouter.get(
  "/fhir/Invoice",
  requireScope("invoices:read"),
  DeveloperFhirController.searchInvoices,
);
developerDataRouter.get(
  "/fhir/Invoice/:id",
  requireScope("invoices:read"),
  DeveloperFhirController.readInvoice,
);

export default developerDataRouter;
