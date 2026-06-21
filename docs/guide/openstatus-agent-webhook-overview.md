# OpenStatus Agent Webhook: Implementation Overview

**Tracking issue:** [#1608](https://github.com/YosemiteCrew/Yosemite-Crew/issues/1608)
**Branch to work on:** `claude/openstatus-agent-webhook-6nohp3`
**Scope:** backend only (no frontend changes required for the core feature)

---

## 1. Goal

We already use OpenStatus for the public status page (`https://yosemite-crew.openstatus.dev/`). The frontend Footer already reads the public status API and renders the incident state, so the consumer side is done. What is missing is automatic incident creation. Today the path from "a monitor is failing" to "the status page shows a real incident" is fully manual.

This work adds a backend webhook endpoint plus an agent service. When an OpenStatus monitor fails, OpenStatus POSTs a webhook to our backend. The backend runs an agent loop against the OpenStatus MCP server (`api.openstatus.dev/mcp`) to open an incident report, post updates, and resolve it when the monitor recovers.

---

## 2. How it works (flow)

1. OpenStatus monitor watches `https://<backend-host>/health`.
2. Monitor fails. OpenStatus fires a webhook to `POST /v1/openstatus/webhook` on our backend.
3. The webhook controller verifies the signature and parses the payload (which monitor, regions, timestamp).
4. The controller hands off to the OpenStatus service.
5. The service connects to `api.openstatus.dev/mcp` with a write-scoped API key and runs the tool loop: open an incident report, post status updates, and mark resolved on recovery.
6. The existing Footer reflects the incident automatically. No frontend change needed.

The pattern mirrors our existing Stripe and Documenso webhooks, which already use raw body parsing and HMAC signature verification.

---

## 3. Files to ADD

| File | Purpose |
|------|---------|
| `apps/backend/src/controllers/web/openstatus.controller.ts` | Verifies the webhook HMAC signature (reuse the `crypto.createHmac` and `timingSafeEqual` approach from `documenso.controller.ts`), parses the payload, delegates to the service. |
| `apps/backend/src/services/openstatus.service.ts` | Connects to `api.openstatus.dev/mcp` with the write-scoped API key and runs the agent tool loop: open report, post updates, resolve. |
| `apps/backend/src/controllers/web/__tests__/openstatus.controller.test.ts` | Tests for signature verification and payload handling. Place to match the existing backend test layout. |
| `apps/backend/src/services/__tests__/openstatus.service.test.ts` | Tests for the service. Mock the MCP client; do not call the live API in tests. |

---

## 4. Files to EDIT

| File | Change |
|------|--------|
| `apps/backend/src/app.ts` (near lines 32 to 42) | Register the route next to the Stripe and Documenso webhook routes: `app.post("/v1/openstatus/webhook", express.raw({ type: "application/json" }), (req, res) => OpenStatusController.handle(req, res));`. Raw body is required so the signature can be verified. |
| `apps/backend/.env.example` | Add key names only (no values): `OPENSTATUS_API_KEY`, `OPENSTATUS_WEBHOOK_SECRET`, the monitor id mapping, and a model key such as `ANTHROPIC_API_KEY` if the agent reasons with an LLM. |
| `apps/backend/package.json` | Add the MCP client SDK (`@modelcontextprotocol/sdk`) and any model SDK used. Install with `pnpm --filter backend add <pkg>`. This will also update the root `pnpm-lock.yaml`. |

---

## 5. Environment variables

Set real values in the local `.env` and in the deploy secret store. Never commit real values. Only names go into `.env.example`.

| Variable | Scope | Notes |
|----------|-------|-------|
| `OPENSTATUS_API_KEY` | write | The agent authenticates with this. Must be write-scoped so it can file and resolve incidents. Server-side only. |
| `OPENSTATUS_WEBHOOK_SECRET` | n/a | Shared secret used to verify the inbound webhook signature. |
| Monitor id mapping | n/a | Maps the monitor id in the webhook payload to the page or component the incident should target. |
| `ANTHROPIC_API_KEY` (or chosen model key) | n/a | Only if the agent uses an LLM to write incident text. Optional depending on implementation. |

---

## 6. OpenStatus dashboard config (not in the repo)

Done by someone logged into the OpenStatus account:

1. Point a monitor at `https://<backend-host>/health`. The endpoint already exists at `apps/backend/src/app.ts` line 76 and returns `{ status: "ok" }`.
2. Attach a webhook notification channel that targets `/v1/openstatus/webhook`.
3. Generate a write-scoped API key and store it as `OPENSTATUS_API_KEY` in the backend environment.

---

## 7. Security notes

- OpenStatus API keys carry read or write scopes, enforced before any database lookup. The auto-resolving agent needs a write-scoped key.
- The API key and webhook secret live as server-side secrets only. They must never reach the frontend bundle and must never be committed.
- Verify the webhook signature before doing any work, the same way the Stripe and Documenso controllers do.

---

## 8. NOT touched

- Frontend `Footer.tsx`: already consumes the public status API and renders the incident state. The dot updates automatically once the agent files an incident. Optional later enhancement: surface the agent-authored incident title and message by extending the fetch and rendering around the status map in `Footer.tsx`.
- `docusaurus.config.ts`: status link is fine as-is.

---

## 9. Repo guidelines to follow

- Do not run `git commit` from an agent session. Use the COMMIT CHECKPOINT pattern and let a human commit.
- Conventional commits enforced by commitlint. Use scope `backend`. Example: `feat(backend): add OpenStatus agent webhook endpoint`.
- No `Co-Authored-By` or signature lines on commits.
- No `--no-verify`. All pre-commit hooks must pass. Fix root causes, no `eslint-disable` suppressions.
- Backend changes get backend-appropriate checks and tests. New files ship with tests.
- PR raised as a draft. Title matches the conventional-commit pattern. Body covers what changed, why, impact area, and validation performed.

---

## 10. Reference files

- `apps/backend/src/controllers/web/stripe.controller.ts`
- `apps/backend/src/controllers/web/documenso.controller.ts`
- `apps/backend/src/app.ts` (lines 32 to 42 for webhook registration, line 76 for `/health`)
- `apps/frontend/src/app/ui/widgets/Footer/Footer.tsx` (lines 11 to 41 and 179 to 187 for the status consumer that already works)
