# OpenStatus Agent Webhook: Implementation Overview

**Tracking issue:** [#1608](https://github.com/YosemiteCrew/Yosemite-Crew/issues/1608)
**Branch:** `claude/openstatus-agent-webhook-6nohp3`
**Scope:** backend only (no frontend changes required for the core feature)
**Status:** implemented in this PR.

---

## 1. Goal

We already use OpenStatus for the public status page (`https://yosemite-crew.openstatus.dev/`). The frontend Footer already reads the public status API and renders the incident state, so the consumer side is done. What was missing is automatic incident creation. Previously the path from "a monitor is failing" to "the status page shows a real incident" was fully manual.

This feature adds a backend webhook endpoint plus a service. When an OpenStatus monitor fails, OpenStatus POSTs a webhook to our backend, which opens a status report on the public status page. When the monitor recovers, the same endpoint resolves it.

## 2. Design decision: deterministic, not an LLM agent

The implementation is deterministic. It calls the OpenStatus v1 REST API directly to open and resolve status reports. It does not run an LLM agent and does not use the MCP server. Reasons:

- It fully delivers the core value (auto open and auto resolve incidents).
- It removes the prompt-injection risk of feeding webhook content to a model that can publish to a public page.
- It adds no new dependencies (uses axios and zod, already in the backend) and needs no model API key.

An LLM-authored incident-copy variant can be layered on later if richer prose is wanted; it is intentionally out of scope here.

## 3. How it works (flow)

1. An OpenStatus monitor watches `https://<backend-host>/health` (endpoint already exists at `apps/backend/src/app.ts`).
2. On failure or degradation, OpenStatus POSTs a webhook to `POST /v1/openstatus/webhook`. The payload contains the monitor, a `status` of `error`, `degraded`, or `recovered`, and optional `statusCode`, `latency`, and `errorMessage`.
3. The controller authenticates the request using a shared secret sent as the `x-openstatus-webhook-secret` header (constant-time compare), then validates the payload with zod.
4. The controller delegates to `OpenStatusService.handleMonitorEvent`.
5. The service calls the OpenStatus v1 REST API (`https://api.openstatus.dev/v1`, auth header `x-openstatus-key`):
   - `error` or `degraded`: open a status report, unless one is already open for that monitor (idempotent against repeated webhooks and replays).
   - `recovered`: resolve every open report for that monitor.
6. The existing Footer reflects the incident automatically. No frontend change needed.

OpenStatus is the source of truth for open incidents. The service looks up open reports via `GET /status_report` rather than keeping local incident state, so it is stateless and safe across multiple backend instances.

## 4. Files added

| File                                                              | Purpose                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `apps/backend/src/controllers/web/openstatus.controller.ts`       | Verifies the shared-secret header, parses the raw JSON body, validates with zod, delegates to the service. |
| `apps/backend/src/services/openstatus.service.ts`                 | Calls the OpenStatus v1 REST API to open and resolve status reports; idempotent open, stateless resolve.   |
| `apps/backend/test/services/openstatus.service.test.ts`           | Service unit tests (axios mocked).                                                                         |
| `apps/backend/test/controllers/web/openstatus.controller.test.ts` | Controller unit tests (service mocked).                                                                    |

## 5. Files edited

| File                        | Change                                                                                                                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `apps/backend/src/app.ts`   | Registers `POST /v1/openstatus/webhook` with `express.raw`, next to the Stripe and Documenso webhook routes. Raw body is required so the request can be authenticated before JSON parsing. |
| `apps/backend/.env.example` | Adds the OpenStatus variable names (no values).                                                                                                                                            |

No dependency changes: the service uses axios and zod, which the backend already depends on.

## 6. Environment variables

Set real values in the runtime `.env` (and the deploy secret store). Only names go in `.env.example`; never commit real values.

| Variable                    | Required | Notes                                                                                                                       |
| --------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------- |
| `OPENSTATUS_API_KEY`        | yes      | Write-scoped key used to create and resolve status reports (`x-openstatus-key`). Server-side only.                          |
| `OPENSTATUS_WEBHOOK_SECRET` | yes      | Shared secret sent by OpenStatus as the `x-openstatus-webhook-secret` header. If unset, the endpoint rejects every request. |
| `OPENSTATUS_PAGE_ID`        | yes      | Numeric id of the status page reports are attached to.                                                                      |
| `OPENSTATUS_API_BASE_URL`   | no       | Overrides the API base; defaults to `https://api.openstatus.dev/v1`.                                                        |

## 7. OpenStatus dashboard config (not in the repo)

Done by someone logged into the OpenStatus account:

1. Point a monitor at `https://<backend-host>/health`.
2. Attach a webhook notification channel targeting `/v1/openstatus/webhook`, and add a custom header `x-openstatus-webhook-secret` whose value matches `OPENSTATUS_WEBHOOK_SECRET`.
3. Generate a write-scoped API key and store it as `OPENSTATUS_API_KEY`.
4. Note the status page id and store it as `OPENSTATUS_PAGE_ID`.

## 8. Security notes

- OpenStatus webhooks are not HMAC-signed. Authentication is a shared secret sent as a custom header, compared in constant time. A missing secret configuration fails closed (the endpoint rejects all requests).
- The API key and webhook secret are server-side secrets only. They must never reach the frontend bundle and must never be committed.
- The deterministic design means no untrusted webhook content is ever handed to a model that could publish to the public status page.
- Idempotent open plus stateless resolve limit the effect of duplicate or replayed webhooks.

## 9. NOT touched

- Frontend `Footer.tsx`: already consumes the public status API and renders the incident state. The dot updates automatically once a report is opened.
- `docusaurus.config.ts`: status link is fine as-is.

## 10. Reference

- OpenStatus v1 REST API: `POST /status_report`, `POST /status_report/{id}/update`, `GET /status_report` (auth header `x-openstatus-key`).
- Existing webhook patterns: `apps/backend/src/controllers/web/stripe.controller.ts`, `apps/backend/src/controllers/web/documenso.controller.ts`.
- `apps/backend/src/app.ts` (webhook registration; `/health` endpoint).
- `apps/frontend/src/app/ui/widgets/Footer/Footer.tsx` (the status consumer that already works).
