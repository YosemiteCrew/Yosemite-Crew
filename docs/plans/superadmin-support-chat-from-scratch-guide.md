# Superadmin Support Chat From-Scratch Guide

## Objective

Build a separate Superadmin application (outside current monorepo) that uses the same Stream Chat app and backend chat APIs to handle support conversations from PMS and mobile users.

This guide defines an implementation where every support conversation is scoped by requester + organization and is visible in a support queue.

## Final Product Requirements

- Superadmin app can sign in superadmin users.
- Superadmin app can connect to Stream using backend-issued token.
- Superadmin app shows support queue with organization context.
- Superadmin user can open, reply, resolve, and reopen support conversations.
- Same requester in two organizations appears as two separate support threads.

Lifecycle requirement:

- Agent marks chat as `Resolved` (not hard closed) when issue is done.
- User can type again in the same thread to reopen support.
- Queue should reflect `OPEN` vs `RESOLVED` states clearly.

Support scope coverage:

- Required: manage `COMPANY` support conversations.
- Optional (ops mode): read-only or full visibility into `ORG` support conversations via `supportScope` filter when enabled by policy.

## High-Level Architecture

- Frontend: separate Superadmin app (recommended Next.js + TypeScript).
- Chat SDKs:
- `stream-chat`
- `stream-chat-react`
- Auth:
- your Superadmin identity provider
- backend endpoint to mint Stream token for superadmin user
- Data source split:
- Queue metadata from backend support sessions API
- Message stream from Stream Chat channel watch/query

## Production-Grade Reuse Strategy (Superadmin)

Reuse-first rules:

- Reuse Stream SDK primitives for realtime chat behavior.
- Reuse existing backend support session APIs as queue/source-of-truth; do not invent a parallel indexing layer.
- Reuse one unified support session domain model (`supportScope`, lifecycle, org context) across queue and thread panes.

Duplication controls:

- One API client module for support endpoints (list/open/resolve/reopen/token).
- One shared mapper from API session DTO -> UI queue model.
- One shared thread metadata component used across company/org scopes.

## Existing Yosemite Flow Awareness

Your existing Yosemite clients already run distinct chat modes:

- PMS web: `clients`, `colleagues`, `groups`
- Mobile: provider appointment chat

Superadmin app must only manage `SUPPORT` sessions and must not depend on legacy colleague/group matching behavior from PMS.

Channel ownership boundary:

- Mobile account support threads are parent -> company support (Superadmin).
- Mobile business-surface support threads are parent -> linked PIMS organization support (`supportScope=ORG`).
- By default, superadmin queue focuses on `COMPANY`; org-support visibility is policy controlled.

## Required Environment Variables

- `NEXT_PUBLIC_STREAM_API_KEY`
- `NEXT_PUBLIC_API_BASE_URL`
- `SUPERADMIN_AUTH_*` variables for your provider

Optional:

- `NEXT_PUBLIC_SUPPORT_DEFAULT_QUEUE_PAGE_SIZE`

## Recommended Folder Structure

- `src/features/support-chat/api` for backend API clients
- `src/features/support-chat/components` for queue + thread UI
- `src/features/support-chat/hooks` for state and orchestration
- `src/features/support-chat/types` for DTOs and domain models
- `src/features/support-chat/screens` or routes for support workspace

## Backend APIs To Integrate

Expect backend endpoints:

- `POST /v1/chat/superadmin/token`
- `GET /v1/chat/superadmin/support/sessions`
- `POST /v1/chat/superadmin/support/sessions/:sessionId/open`
- `POST /v1/chat/superadmin/support/sessions/:sessionId/resolve`
- `POST /v1/chat/superadmin/support/sessions/:sessionId/reopen`

Required list filters:

- `organisationId`
- `supportLifecycleStatus`
- `supportScope` (`COMPANY` | `ORG`)
- `requesterUserId`
- `page`
- `limit`

Compatibility requirement:

- Queue list endpoint should return `type=SUPPORT` sessions only.
- Superadmin app should not query generic `/pms/sessions` style endpoints to avoid mixing direct/group/appointment chats.

## Authentication and Stream Connection Flow

1. Superadmin user logs in via normal app auth.
2. App calls `POST /v1/chat/superadmin/token` with auth header.
3. App receives Stream token.
4. App calls `client.connectUser({id, name, image}, token)`.
5. App loads queue with `GET /v1/chat/superadmin/support/sessions`.
6. On selecting a row, app calls `open` endpoint and watches channel.

Critical rule:

- Never generate Stream tokens in frontend.

## Queue UX Specification

Queue must render:

- `organisationName`
- `organisationId`
- `requesterUserId`
- `requesterKind`
- `status`
- `supportLifecycleStatus`
- `updatedAt`
- unread indicator
- latest message preview

Default sorting:

- `updatedAt DESC`

Recommended filters in top bar:

- Scope chips: `Company`, `Organization`
- Organization dropdown/search
- Lifecycle chips: `OPEN`, `RESOLVED`
- Text search on requester id/name

## Superadmin Design-System Constraints

- Build support workspace using the Superadmin project's existing custom components/tokens (cards, tables, filters, buttons, badges).
- Do not ship raw default Stream styles as final UI; wrap Stream chat primitives inside project design-system layout components.
- Keep scope/lifecycle badges, queue rows, and thread metadata cards consistent with existing Superadmin visual language.

## Conversation Panel UX Specification

Show persistent metadata panel at top of thread:

- Organization name and id
- Requester identity
- Requester kind (`PMS_USER` or `PARENT_USER`)
- Session status

Actions in panel:

- Mark Resolved
- Reopen
- Copy identifiers (session id, channel id)

Messaging area:

- Reuse Stream components (`Channel`, `MessageList`, `MessageInput`, `Thread`).
- Keep message input visible for requester side behavior parity (same thread resume model).
- For superadmin side, optionally show helper banner when session is resolved: `Waiting for user follow-up`.

## Data Contracts (Frontend Types)

### SupportQueueItem

```ts
export type SupportQueueItem = {
  id: string;
  channelId: string;
  channelType: string;
  supportScope: 'COMPANY' | 'ORG';
  organisationId?: string;
  organisationName?: string;
  requesterUserId: string;
  requesterKind: 'PMS_USER' | 'PARENT_USER';
  supportInboxId: string;
  status: 'ACTIVE' | 'CLOSED';
  supportLifecycleStatus: 'OPEN' | 'RESOLVED' | 'CLOSED';
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  updatedAt: string;
  createdAt?: string;
};
```

### OpenSessionResponse

```ts
export type OpenSessionResponse = {
  channelId: string;
  channelType: string;
  token: string;
  expiresAt: number;
};
```

## Query Strategy

Recommended behavior:

- Use backend list endpoint as queue source-of-truth.
- Use Stream query/watch for message timeline in active thread.
- Avoid deriving queue solely from Stream channels because backend session metadata is authoritative for status and organization linkage.

Current-platform alignment:

- PMS currently relies on channel metadata categorization for scope rendering.
- Superadmin should trust backend session metadata first and use Stream only for live message state.

## Channel Open Logic

On queue row click:

1. call backend open endpoint with `sessionId`.
2. resolve Stream channel with returned `channelType` + `channelId`.
3. `await channel.watch()`.
4. set active channel in UI.
5. mark read if desired.

Handle failure states:

- 403: show permission error and clear selection.
- 404: queue entry stale; refresh queue.
- 401: force re-auth.

## Resolve/Reopen Session Logic

Resolve flow:

1. show confirmation modal.
2. call backend resolve endpoint.
3. optimistically update selected queue item lifecycle status to `RESOLVED`.
4. refresh queue.
5. show informational system card: `Marked resolved. New user message will reopen this chat.`

Email expectation:

- Resolve/reopen actions trigger backend transactional emails to requester and relevant support recipients.
- Superadmin frontend should not send emails directly.

Reopen flow:

1. click Reopen on resolved thread.
2. call backend reopen endpoint.
3. update lifecycle status to `OPEN`.
4. refresh queue and keep thread selected.

## Handling Multi-Org Requesters

Support threads are per requester + org.

Implications:

- Same requester id may appear multiple times with different organizations.
- Queue row key must be session id, not requester id.
- UI must always show org badge to avoid confusion.

## Resume-in-same-thread behavior (industry-standard support pattern)

- Keep channel history continuous; do not spawn new channel for follow-up questions.
- Reopen trigger:
- Superadmin manual reopen action.
- Automatic reopen when requester sends a new message after `RESOLVED`.
- Implement queue highlighting for auto-reopened conversations (optional: `recentlyReopened` badge).

## Permission Model

- Superadmin routes are superadmin-only.
- No PMS/mobile tokens allowed in superadmin app.
- Do not expose Stream API secret in this app.

## Security Guidelines

- Do not log Stream tokens.
- Do not log full message bodies in application logs.
- Sanitize PII in client-side error telemetry.

## Real-Time Update Strategy

Use one of these:

- Poll queue endpoint every 20-30s.
- Or subscribe to Stream events and trigger queue refresh on:
- `message.new`
- `notification.message_new`
- `channel.updated`

Recommended initial approach:

- Polling + refresh on active thread send/receive events.

## Suggested Implementation Steps

1. Scaffold support workspace route/page.
2. Add superadmin auth guard.
3. Build API client for queue/open/resolve/reopen/token endpoints.
4. Initialize Stream client and connect superadmin user.
5. Implement queue list with filters.
6. Implement thread panel and resolve/reopen actions.
7. Add loading/error/empty states.
8. Add analytics and operational logging.

## QA Checklist

- New support thread from PMS appears in queue with correct org.
- New support thread from mobile appears in queue with requester kind `PARENT_USER`.
- Same requester in two orgs appears as two queue rows.
- Resolving session keeps same thread available for requester follow-up.
- New requester message after resolve moves queue item back to `OPEN`.
- Manual reopen from superadmin updates queue and thread state.
- Unauthorized user cannot access superadmin queue endpoints.
- Company and org support entries are clearly separated by `supportScope` in queue filters and badges.

## Operational Checklist

- Verify API CORS for Superadmin domain.
- Verify token expiry handling and reconnect.
- Verify pagination for large queue volume.
- Add monitoring alerts on queue API failures.

## Production Readiness Checklist

- Queue strictly filtered to `type=SUPPORT` with explicit `supportScope` controls.
- Company/org scope separation visible in UI and filters.
- Resolve/reopen actions reflect immediately in queue + thread metadata.
- Auto-reopen by requester follow-up verified in realtime.
- Email side effects triggered by backend and reflected in operator workflow expectations.
- All support workspace surfaces use project design-system components and tokens.

## Non-Goals For V1

- Agent assignment automation.
- SLA auto-escalation.
- AI auto-replies.

These can be added later without changing core session model.

## Source References

- Tokens and authentication:
- https://getstream.io/chat/docs/node/tokens_and_authentication/
- Creating channels:
- https://getstream.io/chat/docs/node/creating_channels/
- Query channels:
- https://getstream.io/chat/docs/node/query_channels/
- Multi-tenant and teams:
- https://getstream.io/chat/docs/node/multi_tenant_chat/
- API errors:
- https://getstream.io/chat/docs/node/api_errors_response/
