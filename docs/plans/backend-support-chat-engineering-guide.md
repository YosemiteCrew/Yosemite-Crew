# Backend Support Chat Engineering Guide

## Objective

Enable a reusable Stream Chat based support flow where PMS users and mobile users can message Superadmin support, while preserving organization context in every support conversation.

This guide is implementation-facing and assumes existing chat flows already exist for:

- Appointment chat
- Org direct chat
- Org group chat

The new support flow must not break those existing flows.

## Final Behavior

- Support chat is a distinct chat session type: `SUPPORT`.
- Support scope is explicit via `supportScope`:
- `COMPANY`: requester -> Yosemite Crew superadmin support
- `ORG`: requester -> target PIMS organization support team
- Threading policy:
- Company support: one thread per `(requesterUserId, COMPANY)`.
- Org support: one thread per `(requesterUserId, organisationId, ORG)`.
- Every support session/channel stores org context fields for queueing and display.
- Superadmin can list and open company support sessions across organizations.
- PMS users can list/open org support sessions for their own organization.
- Requester can access only their own support sessions.

### Support lifecycle (production-grade)

Use a ticket lifecycle for `SUPPORT` sessions instead of hard-closing the channel:

- `OPEN`: active support handling
- `RESOLVED`: agent marked resolved; user can still type in same thread
- `CLOSED`: terminal archival state (admin-only/manual cleanup)

Key rule:

- Do not freeze/disable support channel on resolve.
- If requester sends a new message in a `RESOLVED` support session, transition it back to `OPEN` in the same thread.

## Existing Context To Reuse

- Chat server client already exists in `apps/backend/src/services/chat.service.ts` using `StreamChat.getInstance(STREAM_KEY, STREAM_SECRET)`.
- Existing router is `apps/backend/src/routers/chat.router.ts`.
- Existing controller is `apps/backend/src/controllers/app/chat.controller.ts`.
- Existing session persistence exists in both:
- Mongo model: `apps/backend/src/models/chatSession.ts`
- Prisma model: `apps/backend/prisma/schema.prisma`

## Production-Grade Reuse Strategy (Backend)

Implement support features by extending current chat architecture, not by creating a parallel stack.

Reuse-first rules:

- Keep all support session orchestration inside `ChatService` domain; avoid scattering business logic in controllers.
- Reuse existing token generation and Stream client initialization paths.
- Reuse existing auth middlewares (`authorizeCognito`, `authorizeCognitoMobile`) and add only minimal superadmin guard.
- Reuse dual-write/read-switch conventions already present in chat service.

Duplication controls:

- Create shared helpers for support scope handling (`COMPANY` vs `ORG`) instead of separate duplicated code blocks.
- Create one resolver for support participants (`resolveSupportParticipants`) and one for support channel metadata (`buildSupportChannelData`).
- Create one lifecycle transition utility for `OPEN/RESOLVED/CLOSED` to enforce consistent DB + Stream updates.

Performance and reliability baseline:

- Idempotent `ensure` behavior.
- Retry-safe lifecycle transitions.
- Non-blocking email sends with structured failure logs.

## Existing Flow Compatibility (Must Not Break)

Current live flows:

- PMS web uses:
- client chats (`APPOINTMENT`, Stream `messaging`)
- colleague chats (`ORG_DIRECT`, Stream `team`)
- group chats (`ORG_GROUP`, Stream `team`)
- Mobile uses provider appointment chat (`APPOINTMENT` flow).

Audience model:

- Mobile requester: pet parent.
- PMS requester: provider/staff user.
- Superadmin: company support operator.

Compatibility requirements:

- Do not change behavior of existing routes:
- `POST /v1/chat/pms/appointments/:appointmentId`
- `POST /v1/chat/mobile/appointments/:appointmentId`
- existing group/direct management endpoints.
- Add support via new endpoints and support-specific service methods.
- Keep existing `listMySessions` route behavior stable for current screens.

Support routing boundary:

- Mobile Account support: parent -> company support (`supportScope=COMPANY`).
- Mobile linked-business support (View Business + Business List cards): parent -> selected org support (`supportScope=ORG`).
- PMS support section handles org support conversations (`supportScope=ORG`) for authenticated org staff.
- Superadmin queue handles company support primarily; org-support visibility can remain restricted to PMS org users unless explicitly enabled for operations oversight.

Required update in current backend:

- Because `listMySessions` currently returns all non-closed sessions by org/member, adding `SUPPORT` can pollute existing PMS colleague/group lists.
- Implement one of these in backend:
- Preferred: exclude `SUPPORT` from existing `/pms/sessions/:organisationId` and `/mobile/sessions` responses.
- Alternative: add optional type filter query and keep old default as non-support for backward compatibility.
- Provide dedicated support list endpoints (already defined below) for support UI.

## Data Model Changes

### 1. Prisma enum and model updates

Update `apps/backend/prisma/schema.prisma`.

Add enum value:

- `ChatSessionType.SUPPORT`

Add fields in `model ChatSession`:

- `requesterUserId String?`
- `requesterKind String?` with allowed values enforced in service (or promote to enum if desired).
- `chatCategory String?` (for explicit channel/scope classification, set to `support`).
- `organisationName String?` (denormalized display context for queue).
- `supportInboxId String?` (stable Stream user id, default `support_yosemitecrew`).
- `supportScope String?` with values `COMPANY | ORG`.
- `supportLifecycleStatus String?` with values `OPEN | RESOLVED | CLOSED` for support sessions.
- `resolvedAt DateTime?`
- `resolvedBy String?`
- `firstResponseAt DateTime?` (optional but recommended for SLA metrics)

Add indexes:

- `@@index([type, requesterUserId, organisationId])`
- `@@index([type, organisationId, status, updatedAt])`
- `@@index([type, requesterUserId, status, updatedAt])`
- `@@index([type, supportScope, organisationId, updatedAt])`

Important:

- Keep existing fields and enums backward compatible.
- Do not change behavior for `APPOINTMENT`, `ORG_DIRECT`, `ORG_GROUP`.

### 2. Mongo model updates

Update `apps/backend/src/models/chatSession.ts`.

Add `SUPPORT` in `ChatSessionType` union and schema enum.

Add schema fields:

- `requesterUserId: { type: String, trim: true }`
- `requesterKind: { type: String, enum: ["PMS_USER", "PARENT_USER"] }`
- `chatCategory: { type: String, trim: true }`
- `organisationName: { type: String, trim: true }`
- `supportInboxId: { type: String, trim: true, default: "support_yosemitecrew" }`
- `supportScope: { type: String, enum: ["COMPANY", "ORG"] }`
- `supportLifecycleStatus: { type: String, enum: ["OPEN", "RESOLVED", "CLOSED"] }`
- `resolvedAt: { type: Date, default: null }`
- `resolvedBy: { type: String, trim: true }`
- `firstResponseAt: { type: Date, default: null }`

Add indexes:

- `{ type: 1, requesterUserId: 1, organisationId: 1 }`
- `{ type: 1, organisationId: 1, status: 1, updatedAt: -1 }`

Note:

- For `organisationId` uniqueness with nullable values, enforce uniqueness in service logic rather than global DB unique index (safe across Mongo + Prisma).

## Stream Identity and Channel Metadata

### Stable support identity

Use one stable Stream user id:

- `support_yosemitecrew`

Display/email metadata:

- `name: "Yosemite Support"`
- `email: "support@yosemitecrew.com"` in custom data (not as Stream user id).

### Required support channel fields

When creating support channels, set channel custom data:

- `type: "SUPPORT"`
- `chatCategory: "support"`
- `supportScope: "COMPANY" | "ORG"`
- `requesterUserId`
- `requesterKind`
- `organisationId`
- `organisationName`
- `supportInboxId`
- `status: "active"`
- `supportLifecycleStatus: "OPEN"`
- `created_by_id: requesterUserId`

Why `created_by_id` is mandatory:

- Stream server-side create/watch throws if channel is created without `created_by` or `created_by_id`.

## Service Layer Implementation

Update `apps/backend/src/services/chat.service.ts`.

### 1. Extend session type handling

- Add `SUPPORT` in any `ChatSessionType` switch/mapper.
- Update `getStreamChannelType`:
- `SUPPORT` should map to `team` (recommended) for parity with internal chats.

### 2. Add helper methods

Add internal helpers:

- `ensureSupportInboxUser()` to upsert `support_yosemitecrew`.
- `buildSupportSessionKey(requesterUserId, organisationId?)` for deterministic channel id.
- `upsertRequesterStreamUser(...)` to ensure profile image/name in Stream.
- `assertSupportAccess(session, userId, roleContext)` for requester/admin access boundaries.

### 3. Add core public methods

Add methods:

- `ensureOrgSupportChatForPmsUser(input)`
- Input: `requesterUserId`, `organisationId`, `organisationName`
- Validate requester is staff/member of `organisationId`.
- Find existing `SUPPORT` session by requester + org + `supportScope=ORG`.
- If missing, create Stream channel and DB session.

- `ensureCompanySupportChatForMobileUser(input)`
- Input: `requesterUserId`
- Unique by requester + `supportScope=COMPANY`.

- `ensureOrgSupportChatForMobileUser(input)`
- Input: `requesterUserId`, `organisationId`, `organisationName`
- Validate requester is linked to target organization/business.
- Unique by requester + org + `supportScope=ORG`.

- `openSupportChatBySessionId(sessionId, actor)`
- Validate session exists and is `SUPPORT`.
- Validate actor can access session.
- Return `{ channelId, token, expiresAt, channelType }`.

- `listSupportSessionsForSuperadmin(filters)`
- Query only `type=SUPPORT` and `supportScope=COMPANY` by default.
- Support filters: `organisationId`, `supportLifecycleStatus`, `requesterUserId`, pagination.
- Sort by `updatedAt desc`.

- `listOrgSupportSessionsForPms(organisationId, actorUserId, filters)`
- Query `type=SUPPORT`, `supportScope=ORG`, and enforce actor org membership.

- `listSupportSessionsForRequester(requesterUserId, scope, organisationId?)`
- Used by support UI only; does not replace current `listMySessions`.

- `resolveSupportSession(sessionId, actorUserId, resolutionNote?)`
- Set `supportLifecycleStatus=RESOLVED`, store `resolvedAt` and `resolvedBy`.
- Send system message: `Marked as resolved. If you need more support, reply in this chat.`

- `reopenSupportSession(sessionId, actorUserId, reason?)`
- Set `supportLifecycleStatus=OPEN`, clear `resolvedAt/resolvedBy` if desired.
- Send system message indicating chat was reopened.

- `autoReopenSupportSessionOnUserMessage(event)`
- Triggered from Stream `message.new` webhook.
- If sender is requester and session is `RESOLVED`, auto-transition to `OPEN`.

### 4. Session creation specifics

Channel id strategy:

- Deterministic id recommended for idempotency.
- Company example: `support_company_${sha256(requesterUserId).slice(0, 16)}`
- Org example: `support_org_${sha256(requesterUserId + ':' + organisationId).slice(0, 16)}`

Members:

- Company support: `[requesterUserId, supportInboxId]`
- Org support: `[requesterUserId, ...orgSupportMemberIds]`
- `orgSupportMemberIds` should come from organization roles/policies (for example OWNER/MANAGER/SUPPORT) and stay configurable.

DB session type:

- `type: SUPPORT`

DB fields:

- `requesterUserId`, `requesterKind`, `organisationId`, `organisationName`, `supportInboxId` (company only), `supportScope`, `members`, `status=ACTIVE`, `isPrivate=true`, `chatCategory="support"`, `supportLifecycleStatus="OPEN"`

## Controller Layer Changes

Update `apps/backend/src/controllers/app/chat.controller.ts`.

Add handlers:

- `ensurePmsOrgSupportSession`
- `ensurePmsCompanySupportSession` (optional)
- `ensureMobileCompanySupportSession`
- `ensureMobileOrgSupportSession`
- `openSupportSession`
- `listPmsOrgSupportSessions`
- `listMobileCompanySupportSessions`
- `listMobileOrgSupportSessions`
- `listSuperadminSupportSessions`
- `resolveSupportSessionAsSuperadmin`
- `reopenSupportSessionAsSuperadmin`

Validation rules:

- Parse body safely with existing `getObjectBody` approach.
- Validate required fields and return `400` with clear messages.
- Use `resolveUserIdFromRequest(req)`.
- Keep consistent `ChatServiceError` handling.

## Router Changes

Update `apps/backend/src/routers/chat.router.ts`.

### PMS routes

- `POST /pms/support/org/sessions/ensure`
- `GET /pms/support/org/sessions/:organisationId`
- `POST /pms/support/org/sessions/:sessionId/open`
- `POST /pms/support/org/sessions/:sessionId/resolve`
- `POST /pms/support/org/sessions/:sessionId/reopen`

### Mobile routes

- Company support (Account screen):
- `POST /mobile/support/company/sessions/ensure`
- `GET /mobile/support/company/sessions`
- `POST /mobile/support/company/sessions/:sessionId/open`
- Org support (View Business + Business List cards):
- `POST /mobile/support/org/sessions/ensure`
- `GET /mobile/support/org/sessions`
- `POST /mobile/support/org/sessions/:sessionId/open`

### Superadmin routes

If superadmin auth middleware exists, use it. Else introduce one before enabling endpoint access.

- `POST /superadmin/token`
- `GET /superadmin/support/sessions`
- `POST /superadmin/support/sessions/:sessionId/open`
- `POST /superadmin/support/sessions/:sessionId/resolve`
- `POST /superadmin/support/sessions/:sessionId/reopen`

## API Contracts

### 1. Ensure PMS org-support session

`POST /v1/chat/pms/support/org/sessions/ensure`

Request:

```json
{
  "organisationId": "org_123",
  "organisationName": "Happy Tails Vet"
}
```

Response:

```json
{
  "id": "session_uuid",
  "type": "SUPPORT",
  "supportScope": "ORG",
  "channelId": "support_a1b2c3d4e5f6",
  "channelType": "team",
  "organisationId": "org_123",
  "organisationName": "Happy Tails Vet",
  "requesterUserId": "user_abc",
  "requesterKind": "PMS_USER",
  "supportLifecycleStatus": "OPEN",
  "members": ["user_abc", "org_staff_1", "org_staff_2"],
  "status": "ACTIVE"
}
```

### 2. Ensure mobile company-support session

`POST /v1/chat/mobile/support/company/sessions/ensure`

Request:

```json
{}
```

Response:

```json
{
  "id": "session_uuid",
  "type": "SUPPORT",
  "supportScope": "COMPANY",
  "channelId": "support_company_abc123",
  "channelType": "team",
  "requesterUserId": "parent_abc",
  "requesterKind": "PARENT_USER",
  "supportInboxId": "support_yosemitecrew",
  "supportLifecycleStatus": "OPEN",
  "members": ["parent_abc", "support_yosemitecrew"],
  "status": "ACTIVE"
}
```

### 3. Ensure mobile org-support session

`POST /v1/chat/mobile/support/org/sessions/ensure`

Request:

```json
{
  "organisationId": "org_123",
  "organisationName": "Happy Tails Vet"
}
```

Response same shape, with `requesterKind: "PARENT_USER"`.

### 4. Open support session

`POST /v1/chat/{pms|mobile|superadmin}/support/{company|org}/sessions/:sessionId/open`

Response:

```json
{
  "channelId": "support_a1b2c3d4e5f6",
  "channelType": "team",
  "token": "stream_jwt",
  "expiresAt": 1760000000000
}
```

### 5. Superadmin company-support queue list

`GET /v1/chat/superadmin/support/sessions?supportScope=COMPANY&supportLifecycleStatus=RESOLVED&page=1&limit=25`

Response:

```json
{
  "items": [
    {
      "id": "session_uuid",
      "channelId": "support_a1b2c3d4e5f6",
      "channelType": "team",
      "organisationId": "org_123",
      "organisationName": "Happy Tails Vet",
      "requesterUserId": "user_abc",
      "requesterKind": "PMS_USER",
      "supportLifecycleStatus": "RESOLVED",
      "status": "ACTIVE",
      "updatedAt": "2026-03-26T09:00:00.000Z"
    }
  ],
  "page": 1,
  "limit": 25,
  "total": 1
}
```

## Auth and Authorization

- PMS routes: keep `authorizeCognito`.
- Mobile routes: keep `authorizeCognitoMobile`.
- Superadmin routes: require superadmin-only middleware.

Access policy:

- Requester can ensure/list/open only their own support sessions.
- PMS org staff can list/open/resolve/reopen only `supportScope=ORG` sessions for their own organization.
- Superadmin can list/open/resolve/reopen `supportScope=COMPANY` sessions (and hard-close only for archival operations).
- Non-superadmin users must never query org-wide support queue.

Resolve/reopen policy:

- Superadmin can resolve/reopen support sessions.
- PMS org staff can resolve/reopen org support sessions.
- Requester cannot directly set lifecycle status but can trigger auto-reopen by sending a new message after resolution.

Link validation requirements:

- For mobile org-support ensure/open, backend must verify parent user is linked to target organization/business.
- Reject with `403` when requester tries org-support against unlinked organization.

## Error Handling

- Return `404` when session not found.
- Return `403` for cross-user session access.
- Return `400` for invalid payload.
- Keep existing `ChatServiceError` pattern.
- For hard-close archival operations, follow existing design: DB state is source of truth, log Stream error and continue.
- On Stream failures for support lifecycle updates, DB remains source of truth; retry channel metadata sync asynchronously.

## Logging

Use structured Winston logs for:

- support session ensure start/success/failure
- support open start/success/failure
- superadmin queue query
- support resolve/reopen
- support auto-reopen webhook handling

Include fields:

- `sessionId`
- `organisationId`
- `requesterUserId`
- `actorUserId`
- `chatType`

Avoid logging tokens or sensitive message content.

## Transactional Email Delivery (Required, No Central Notification System)

Use existing email infrastructure only:

- Sender utility: `apps/backend/src/utils/email.ts` (`sendEmailTemplate`)
- Template registry: `apps/backend/src/utils/email-templates.ts`

Scope:

- Implement direct email sends inside support chat service/controller flows.
- Do not introduce a centralized notification orchestration layer in this phase.

### Email triggers

Send emails for support chat lifecycle events:

1. Support chat/ticket opened
2. Support chat marked resolved
3. Support chat reopened (manual or auto-reopen)
4. Support chat ended/closed (if archival close is used)

### Recipients by scope

- `supportScope=COMPANY`:
- requester (pet parent or PMS service provider who opened chat)
- Yosemite support mailbox/operator list as configured

- `supportScope=ORG`:
- requester (pet parent)
- org support recipients (role-based users in target org)

### Minimum payload required in templates

- Recipient display name
- Scope label (`Company Support` or `Organization Support`)
- Organization name (for org support)
- Ticket/session id
- Current lifecycle status (`OPEN`/`RESOLVED`/`CLOSED`)
- Deep link CTA to open relevant chat destination

### Template work in this phase

- Reuse current email setup and add/update template ids for support emails.
- Only update inner content and CTA/redirection links as requested.
- Keep subject lines action-oriented and event-specific.

### Redirection links

Include channel/session deep links:

- Pet parent link -> mobile support chat route (company or org mode)
- PMS provider link -> PMS support section route
- Superadmin/company operator link -> Superadmin support queue/thread route

Use environment-driven base URLs; avoid hardcoded domains in template code.

### Reliability rules

- Email send should be non-blocking for chat API success (best-effort with logging).
- Log failures with actor/session/scope context.
- Prevent duplicate sends on repeated ensure calls by sending “opened” email only on newly created session, not on fetch of existing session.

## Backward Compatibility Rules

- No behavior changes to appointment chat activation windows.
- No behavior changes to org direct/group APIs.
- Keep existing token generation routes unchanged.

## Rollout Plan

1. Deploy schema/model updates + service/controller/router support endpoints behind feature flag.
2. Deploy PMS/mobile clients that call new endpoints.
3. Deploy Superadmin app.
4. Deploy webhook handler for `message.new` auto-reopen.
5. Enable feature flag org-by-org.

## Validation and Tests

### Backend unit tests

Add tests for:

- ensure support session idempotency for same requester+org.
- creation of separate sessions for same requester across different orgs.
- requester access denial for another requester's session.
- superadmin queue filter behavior.
- mobile company-support ensure/open path.
- mobile org-support linkage authorization path.

### Backend integration tests

Add tests for flow:

- company ensure -> open -> resolve -> requester message -> auto-reopen.
- org ensure -> open -> resolve -> requester message -> auto-reopen.
- resolved session remains readable and writable for requester.
- closed session (if used) remains queryable in superadmin view.

### Command checklist

Run only relevant backend checks used in this repo for touched backend files.

## Risks and Mitigations

- Risk: duplicate support sessions during concurrent requests.
- Mitigation: deterministic channel id + transactional upsert/find-first logic.

- Risk: org context drift if org name changes.
- Mitigation: store `organisationName` as display snapshot and refresh on ensure.

- Risk: mixed Mongo/Prisma read modes.
- Mitigation: implement both code paths for support methods, matching current dual-write/read-switch approach.

## Production Readiness Checklist

- Existing appointment/direct/group chat API behavior verified unchanged.
- `listMySessions` backward-compatible filtering confirmed.
- Support scope routing (`COMPANY`/`ORG`) covered by unit + integration tests.
- Lifecycle transitions (`OPEN/RESOLVED/REOPEN`) tested for both scopes.
- Email triggers verified for open/resolve/reopen/close with duplicate-send protection.
- Audit/log fields present for support scope, organisation, requester, actor, session.
- Feature flags in place for incremental rollout.

## Source References

- Tokens and authentication:
- https://getstream.io/chat/docs/node/tokens_and_authentication/
- Creating channels:
- https://getstream.io/chat/docs/node/creating_channels/
- Query channels:
- https://getstream.io/chat/docs/node/query_channels/
- Multi-tenant and teams:
- https://getstream.io/chat/docs/node/multi_tenant_chat/
- API errors (created_by_id requirement):
- https://getstream.io/chat/docs/node/api_errors_response/
- Webhooks overview:
- https://getstream.io/chat/docs/node/webhooks_overview/
- Webhook events:
- https://getstream.io/chat/docs/node/webhook_events/
