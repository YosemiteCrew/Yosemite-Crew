# Developer Portal - Outbound Webhooks (v1)

**Goal:** Define org-scoped outbound webhooks so integrators receive change notifications instead of polling. This is gate #1 for the v1.1 write endpoints named in the [Developer Data API contract](./developer-portal-data-api.md) (section 6): writes must not ship before integrators can observe changes they did not originate.
**Scope:** `apps/backend` (models, management routes, emit hooks, BullMQ queue + worker), `apps/frontend` (portal UI for subscriptions and delivery log), `apps/dev-docs` (docs + event reference).
**Status:** Proposed, for ratification. Depends on PR #1696 (developer portal plumbing) and on the data API contract PR mounting the read surface, since payloads reuse its serializers.
**Related:** [Developer Data API contract](./developer-portal-data-api.md), ADR 0004 (tenant data residency), ADR 0005 (Phase 2 agent).

---

## 1. Placement: management plane only

The contract's plane split holds. Webhook subscriptions are configuration a human manages in the portal, so they live on the management plane with browser-session auth:

| Route                                                               | Purpose                                                        |
| ------------------------------------------------------------------- | -------------------------------------------------------------- |
| `POST /v1/developers/webhooks`                                      | Create subscription; response includes the signing secret once |
| `GET /v1/developers/webhooks` / `:id`                               | List / inspect                                                 |
| `PATCH /v1/developers/webhooks/:id`                                 | Update url, events, description; enable / disable              |
| `DELETE /v1/developers/webhooks/:id`                                | Remove subscription and stop deliveries                        |
| `POST /v1/developers/webhooks/:id/rotate-secret`                    | Issue a new secret (section 6)                                 |
| `POST /v1/developers/webhooks/:id/test`                             | Send a signed `ping` event to the endpoint                     |
| `GET /v1/developers/webhooks/:id/deliveries`                        | Delivery log, cursor-paginated per contract section 5.1        |
| `POST /v1/developers/webhooks/:id/deliveries/:deliveryId/redeliver` | Manual re-send of a dead-lettered delivery                     |

No API-key-authenticated webhook management in v1; the data plane stays read-only GET. Errors use the contract's `{ message, code }` envelope. Cap: 10 subscriptions per org (raiseable per tier later).

## 2. Event taxonomy

v1 events, aligned one-to-one with the data-plane resources the contract already serializes:

| Event                                                                   | Emitted when                                               |
| ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `appointment.created` / `appointment.updated` / `appointment.cancelled` | Booking created; reschedule or status change; cancellation |
| `patient.updated`                                                       | Patient record changes for a patient linked to the org     |
| `encounter.created` / `encounter.completed`                             | Encounter opened; encounter closed                         |
| `invoice.finalized` / `invoice.paid`                                    | Invoice leaves draft; payment settles                      |
| `ping`                                                                  | Test button only, never emitted organically                |

The set is deliberately small. Every event type is a compatibility contract: its payload is frozen to the data-plane GET shape, so each addition is a permanent maintenance surface. These eight cover the reconciliation loops the v1.1 writes need (did my booking land, did the invoice settle) without speculating about consumers that do not exist yet. New event types are additive and ship without a version bump, mirroring contract section 1.

Subscriptions select events from this list; unknown event names are a `400` at create/update time, exactly like canonical scope validation at key issuance (contract section 4).

## 3. Payload envelope

One serialization, not two: `data` is byte-for-byte the object that `GET /v1/developer/<resource>/:id` returns for the same row, produced by the same serializer function. There is no separate webhook shape to keep in sync, and an integrator can always re-fetch by id and get an identical object.

```json
{
  "id": "evt_9c1e...",
  "type": "appointment.created",
  "apiVersion": "v1",
  "occurredAt": "2026-07-09T09:30:12.000Z",
  "environment": "live",
  "data": { "...": "same fields as GET /v1/developer/appointments/:id" }
}
```

- `id` is unique per event and stable across retries - consumers dedupe on it (delivery is at-least-once, section 5).
- `apiVersion` names the data-plane version whose shape `data` uses; a future `/v2` adds `v2` subscriptions rather than mutating `v1` payloads.
- `environment` mirrors `DeveloperApiKeyEnvironment` (`live | test`); a subscription carries one environment and only receives matching events. Until v1.1 writes exist, all organic events are `live`.

## 4. Data model

New models in `packages/database/prisma/schema.prisma`, org-owned like `DeveloperApiKey`:

**WebhookSubscription**

- `id` (uuid), `organisationId`, `createdByUserId`
- `url` - HTTPS only, validated at write time and again at delivery time (section 7)
- `description` (nullable), `events` (`String[]`, validated against section 2)
- `environment` (`live | test`), `status` (`ENABLED | DISABLED | AUTO_DISABLED`)
- `secretCiphertext` - the signing secret encrypted at rest. Unlike API keys (SHA-256 hashed, verify-only), the server must recover this value to sign, so it is encrypted, not hashed
- `previousSecretCiphertext` (nullable), `previousSecretExpiresAt` (nullable) - rotation overlap (section 6)
- `consecutiveFailures` (int), `lastSuccessAt`, `lastFailureAt` - drives auto-disable (section 7)
- `createdAt`, `updatedAt`; `@@index([organisationId, status])`

**WebhookDelivery** - one row per event per subscription (the durable record; BullMQ jobs are ephemeral)

- `id` (uuid), `subscriptionId`, `organisationId` (denormalised for portal queries)
- `eventId`, `eventType`, `payload` (Json - the envelope as sent, for redelivery and debugging)
- `status` (`PENDING | RETRYING | DELIVERED | FAILED`) - `FAILED` is the dead-letter state
- `attemptCount` (int), `nextRetryAt` (nullable, display only; BullMQ owns actual scheduling)
- `responseStatus` (int, nullable), `responseSummary` (first 1 KB of response body or error string)
- `deliveredAt` (nullable), `createdAt`, `updatedAt`
- `@@index([subscriptionId, createdAt])`, `@@index([organisationId, createdAt])`

## 5. Delivery: BullMQ queue + worker, at-least-once

Reuses the existing queue infrastructure exactly as the house pattern prescribes: a `webhook-delivery.queue.ts` in `apps/backend/src/queues/` built on `defaultQueueOptions` / `redisConnection` from `bull.config.ts`, and a `webhook-delivery.worker.ts` in `apps/backend/src/workers/` (same shape as `appointment.worker.ts`).

- **Emit:** service-layer hooks (the same choke points that will write `AuditTrail` rows for gate #2) create one `WebhookDelivery` row per matching enabled subscription and enqueue a job carrying the delivery id. The Prisma write happens first; the enqueue is fire-and-forget after commit, so a Redis blip loses timeliness, not the record.
- **Attempt:** the worker loads the row, re-runs the SSRF checks (section 7), POSTs the payload with a 10-second timeout, and records `responseStatus`. Any 2xx within timeout is success; redirects are not followed and count as failure.
- **Retry:** BullMQ `attempts: 8` with `backoff: { type: "exponential", delay: 60_000 }` - roughly 1m, 2m, 4m, ... spanning about two hours, then dead-letter: status `FAILED`, visible in the portal with its response history, manually redeliverable.
- **At-least-once, unordered:** a timeout after the receiver processed the request causes a duplicate on retry, and retries interleave across events. Consumers must dedupe on `id` and treat `occurredAt` as the ordering signal; the docs say this in bold.

## 6. Signing

Stripe-style HMAC so receivers can authenticate payloads without a shared session:

```
Yosemite-Signature: t=1783330212,v1=<hex hmac-sha256 over "<t>.<raw body>">
```

- Per-subscription 32-byte random secret, shown once in the create response (like the API key plaintext in PR #1696) and never retrievable afterwards.
- Signing over `timestamp.body` plus a documented 5-minute replay window (receiver rejects stale `t`) defeats replay of captured deliveries.
- **Rotation:** `rotate-secret` generates a new secret (returned once), moves the old one to `previousSecretCiphertext` with a 24-hour `previousSecretExpiresAt`, and during overlap every delivery carries two signatures (`v1=<new>,v1=<old>`) so receivers can roll keys without dropped events. After expiry the old secret is deleted.

## 7. Security

- **HTTPS only.** Non-HTTPS urls are rejected at create/update and again at delivery time.
- **SSRF.** The endpoint url is developer-supplied, so the delivery worker is a request-forgery vector into our network. House precedent: the attachment scanner (`apps/backend/src/services/attachmentScanner.service.ts`) guards a user-authored webhook attachment url with an inline check on the dataflow path to `fetch`. Webhook targets cannot use its allowlist approach (any customer host is legitimate), so the worker instead resolves DNS itself, rejects loopback, RFC 1918, link-local, and cloud-metadata ranges, and pins the connection to the vetted IP (defeating DNS rebinding between check and use). No redirects are followed. The check lives inline in the worker, same as the scanner precedent.
- **Auto-disable.** After 20 consecutive dead-lettered deliveries or 3 days without a success while failing, the subscription flips to `AUTO_DISABLED`, delivery stops, and the portal shows why. Re-enabling is an explicit `PATCH`. This protects both the queue and the unresponsive receiver.
- **No secrets in payloads.** Envelope `data` reuses the data-plane serializers, so the contract's field-level exclusions (Stripe internals, credentials, `metadata`) apply automatically.

## 8. Observability

The portal's webhook detail page renders the `WebhookDelivery` log: event type, status, attempt count, response code, response summary, timestamps - with filters for status and event type, cursor pagination, and per-row redeliver for dead letters. Worker logs go through the existing Winston logger; queue depth and failure counts ride the same monitoring as the other BullMQ queues.

## 9. What this unblocks, and what it does not

**Unblocks:** gate #1 of the data API contract's section 6. With webhooks live, the v1.1 write endpoints (`POST /v1/developer/appointments`, cancel, patient PATCH, invoice finalize) can mount once the remaining gates land: `AuditTrail` coverage with the API key id as `actorId` and a new `AuditActorType` for API keys (gate #2), the `Idempotency-Key` convention (gate #3), and canonical scope issuance (gate #4, shipping with the contract PR).

**Non-goals for v1:**

- Inbound webhooks (receiving third-party events; the existing `chatWebhook.controller.ts` for Stream is a separate concern and untouched).
- A per-event filtering DSL (e.g. "only appointments for room X") - subscriptions filter by event type only.
- Payload transforms, fan-out formats, or non-HTTP transports (queues, email).
- Sandbox event streams - `test` environment events arrive only when v1.1 test-mode writes exist.

## 10. Open questions for reviewers

1. **Thin vs fat payloads.** This doc proposes fat (full GET shape inline). Thin payloads (id + type only, consumer re-fetches) shrink the replay surface and guarantee freshness but force every consumer to hold an API key and spend quota on fetch-backs. Is fat right for v1, or should `data` be optional per subscription?
2. **Rotation UX.** Is a fixed 24-hour dual-signature overlap enough, or does the portal need a "confirm receiver updated" step before expiring the old secret? And is one previous secret sufficient, or do we need a small keyring?
3. **Delivery log retention.** `WebhookDelivery` rows grow with org activity times subscriptions. Proposal: prune `DELIVERED` rows after 30 days and `FAILED` after 90 (a BullMQ repeatable job, like the existing schedulers). Long enough? Should retention be tier-dependent?
