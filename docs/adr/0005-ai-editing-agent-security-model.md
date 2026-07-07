# 0005. Security model for the Tier 1 in-browser AI editing agent

**Status:** Proposed
**Date:** 2026-07-07

## Context

Epic #1582 Phase 2 puts an AI editing agent inside `/developers`: a developer chats with a model in the browser and the agent edits their PIMS configuration (Forms, Templates, ObservationTool, FHIR mappings) through an MCP toolset over the [Developer Data API](../plans/developer-portal-data-api.md). The developer brings their own inference key (Claude or OpenAI); Yosemite Crew does not proxy or meter inference in Tier 1.

This is the highest-risk surface in the developer platform, and its security model must be decided **before** it is built:

- The agent operates inside a system holding veterinary health data. Model output is probabilistic; a hallucinated or prompt-injected tool call must not be able to change what clinicians see in production, alter the database schema, or exfiltrate patient data.
- Data the agent reads back from the PIMS (patient names, form field contents, template bodies) can itself contain adversarial text. Any security model that assumes the model "follows instructions" fails here.
- The BYO inference key is a valuable credential belonging to the developer. Custody, logging, and revocation need explicit rules, or the key leaks into logs and error reports by default.
- The building blocks are already built and constrain the design: versioned form/template models with a draft-then-publish lifecycle in the config engine, `DeveloperApiKey` with hashed keys and scoped auth (`authorizeApiKey` + `requireScope` in `apps/backend/src/middlewares/api-key-auth.ts`, PR #1696, unmerged as of this ADR's date), `DeveloperApiUsage` metering (same PR) with per-key rate limiting specified in the data API contract, and the read-only data-plane pattern prototyped in closed PR #1726 (`developer-data.router.ts`, `packages/mcp-server`) and superseded by the [Developer Data API contract](../plans/developer-portal-data-api.md).

## Decision

The Tier 1 agent is a **config-scoped, draft-only, human-promoted** editor. Five rules define the model.

### 1. Capability boundary: config tools only

- The MCP toolset exposes exactly: CRUD on Forms, Templates, and ObservationTool definitions **in draft state**, plus read-only access to data the developer's account can already see (the read endpoints of the [Developer Data API](../plans/developer-portal-data-api.md), e.g. `GET /v1/developer/appointments` and `GET /v1/developer/patients`, and config reads).
- The agent never gets schema or migration tools - Prisma Migrate stays the human-only source of truth (ADR 0001).
- No arbitrary HTTP fetch tool. No code-commit rights: code changes are Tier 2, a human path through the Yosemite GitHub App (see the [Tier 2 plan](../plans/developer-portal-tier2-github-app.md)).
- The tool list is a static allowlist compiled into the client. There is no "register a new tool at runtime" surface. Later config surfaces extend the allowlist only by code change reviewed against this ADR (the Phase 3b [website builder](../plans/developer-portal-website-builder.md) registers its site-config tools this way).

### 2. Draft/promote gate: no agent-initiated publish

- Every agent write creates or updates a **draft version** using the existing versioned form/template models - the same versioning and publish machinery clinicians already use, not a parallel one.
- Publishing (promoting a draft to the active version) is a separate endpoint requiring an interactive human session (`requireWebAuth`, ADR 0003 / PR #1763, unmerged as of this ADR's date). It is deliberately absent from the MCP toolset.
- The `/developers` UI shows a diff between the draft and the published version before the publish button.
- A prompt-injected agent can therefore at worst litter the draft space; it cannot change what renders in a clinic.

### 3. Key custody: client-side by default, vaulted opt-in

- The BYO inference key lives in the browser session by default (memory/session storage, never a cookie). Inference calls go browser-to-provider directly; the key never transits Yosemite Crew servers.
- As an opt-in convenience ("remember my key"), the key may be stored server-side encrypted with AES-256-GCM under a per-developer data key, itself wrapped by a key-encryption-key supplied from environment/KMS - the same envelope pattern as other platform secrets.
- The key is never written to logs, error reports, or audit entries in any storage mode.
- The developer can revoke (delete) the vaulted copy at any time.

### 4. Tool-call auth: the developer's own identity, narrow scope

- Agent tool calls hit the backend as the developer, never as a service account: either the developer's own web session, or a purpose-issued `DeveloperApiKey` created for the agent.
- That key carries a dedicated narrow scope set - `config:draft:write` plus read scopes (`config:read` and the canonical `:read` scopes from the data API contract, section 4) - enforced per route by the existing `requireScope` middleware. It cannot publish, and it cannot write outside config drafts.
- The key gets the `DeveloperApiUsage` metering from PR #1696 and the standard per-key rate limits defined in the data API contract.
- Every tool call is audit-logged with the developer id, key id, tool name, target entity, and the agent conversation id, so a bad edit is traceable to the exact chat turn that produced it.

### 5. Prompt-injection stance: assume the model is compromised

- All data returned from PIMS reads is treated as untrusted input to the model.
- Defences are structural, not behavioural: the tool allowlist is static (an injected instruction cannot add tools); no tool accepts an arbitrary URL or can send data anywhere except the Yosemite Crew API, limiting exfiltration to what the developer's own scopes already permit; write blast radius is capped at drafts.
- The human diff-review-publish step is the final backstop. System-prompt hardening is applied but never relied on.

## Consequences

**Good:**

- Worst-case agent compromise (full prompt injection) is bounded: garbage drafts and reads the developer was already entitled to. No schema change, no production config change, no cross-tenant access, no exfiltration channel.
- Reuses already-built machinery - versioned drafts, `authorizeApiKey`/`requireScope`, rate limiting, usage metering - instead of a new privileged execution path, so the agent's surface is reviewable as ordinary API routes.
- BYO client-side keys mean Yosemite Crew holds no inference credentials by default: nothing to breach, no provider terms-of-service exposure, no inference cost pass-through in v1.
- The audit trail (tool call + conversation id) makes agent behaviour debuggable and gives compliance a complete answer to "what did the AI change and who approved it".

**Bad / accepted trade-offs:**

- Draft/promote adds friction: the "vibe code your PIMS" loop always ends in a manual review-and-publish click. Rapid iterate-preview cycles must work against drafts (the Phase 2 sandboxed preview) to keep the loop tight.
- Client-side key custody is worse UX: the key must be re-entered per browser/session unless the developer opts into the vault, and browser-to-provider calls depend on the provider's CORS support (Anthropic supports this; a thin egress-pinned relay may be needed for providers that do not).
- Audit volume is high - one row per tool call, and an agent conversation can emit dozens - so audit storage needs retention limits from day one.
- A dedicated `config:draft:write` scope and a draft-only write path add scope-model and endpoint complexity to the API surface shipped in PR #1696.

## Definition of done

This ADR is implemented when:

- The MCP toolset ships with only the tools named in rule 1, and adding a tool requires a code change reviewed against this ADR.
- No publish/promote endpoint accepts the agent's API key scope; publish requires `requireWebAuth`.
- The `config:draft:write` scope exists in the `DeveloperApiKey` scope model and is enforced by `requireScope` on every agent-writable route.
- Key vaulting is opt-in, envelope-encrypted, and a log/error-report scan shows no inference-key material.
- Every agent tool call produces an audit row carrying the conversation id.

## Alternatives considered

- **Server-side agent execution** (backend holds the conversation loop and calls the inference provider): rejected for v1. It forces server custody of every developer's BYO key and moves the agent inside the trust boundary, where a compromise has server-level blast radius instead of one browser session. Revisit if the platform later meters inference itself - platform-owned keys change the custody calculus entirely.
- **Agent with direct publish rights** (no draft gate, writes go live): rejected. An unreviewed model output changing forms and templates that clinicians use on real patients is not defensible for a system handling health data. The human diff review is the compliance control, not an optional convenience.
- **Fully client-side agent with no server tools** (model only generates config JSON the developer pastes in): rejected. It cannot read current config or data to ground its edits, which is the whole value of the loop, and manual paste bypasses validation and audit rather than avoiding risk.
