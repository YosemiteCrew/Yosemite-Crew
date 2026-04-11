# PMS Web + Mobile Support Chat Update Guide

## Objective

Add a Support Chat experience in both:

- PMS web chat module
- Mobile account/settings area

The implementation must reuse existing Stream chat infrastructure and preserve design-system conventions.

## Required Product Behavior

- PMS users can open a support chat scoped to their current organization.
- Mobile users can open support chat from account/settings.
- Support sessions are per requester + organization when org context exists.
- Organization context is visible in thread list and thread header.
- Existing appointment/colleague/group chat flows continue unchanged.
- Support resolution uses pause/resume model:
- Superadmin marks support as resolved.
- User can send a new message in the same thread to request more help.
- New user message reopens support lifecycle to active/open.

## Audience Boundaries (Explicit)

- Mobile app users are pet parents.
- PMS users are service providers/organizations.
- Superadmin users are Yosemite Crew company operators.

Support channels to implement:

- `Company Support`: pet parent/service provider -> Yosemite Crew support.
- `Org Support`: pet parent -> linked PIMS organization support team.

Entry-point policy:

- Mobile Account screen: `Company Support`.
- Mobile View Business + Business List cards: `Org Support` for that business/org.
- PMS web support section: org support inbox for current organization (and optional company-support subtab if desired).

## Current Reuse Points

### PMS web

Existing files to extend:

- `apps/frontend/src/app/(routes)/(app)/chat/page.tsx`
- `apps/frontend/src/app/features/chat/components/ChatContainer.tsx`
- `apps/frontend/src/app/features/chat/services/chatService.ts`
- `apps/frontend/src/app/features/chat/services/streamChatService.ts`
- `apps/frontend/src/app/features/chat/types/chat.ts`

Existing PMS behavior to preserve:

- `ChatScope` currently supports `clients | colleagues | groups`.
- `resolveChannelScope` fallback defaults to `colleagues` when category is missing.
- colleague/group creation flows depend on `listOrgChatSessions` and currently match only `ORG_DIRECT`/`ORG_GROUP`.

### Mobile

Existing files to extend:

- `apps/mobileAppYC/src/features/account/screens/AccountScreen.tsx`
- `apps/mobileAppYC/src/features/chat/services/chatBackendService.ts`
- `apps/mobileAppYC/src/features/chat/services/streamChatService.ts`
- `apps/mobileAppYC/src/features/chat/screens/ChatChannelScreen.tsx`
- `apps/mobileAppYC/src/navigation/types.ts`
- `apps/mobileAppYC/src/navigation/AppointmentStackNavigator.tsx`

Existing mobile behavior to preserve:

- `ChatChannelScreen` is currently appointment/provider oriented and expects appointment params.
- `streamChatService.getAppointmentChannel` currently contains appointment-specific fallback behavior.
- appointment navigation from `MyAppointmentsScreen` and `HomeScreen` must remain untouched.

## Do-Not-Break Guardrails (Mandatory)

- Do not route support conversations through existing appointment APIs.
- Do not remove or alter existing colleague/group matching logic used for team chats.
- Do not let support channels fall into colleagues scope due to missing category metadata.
- Do not weaken appointment route types in a way that breaks existing screen callers.

## Production-Grade Reuse Strategy (Web + Mobile)

Reuse-first implementation:

- Reuse existing chat containers/screens and service layers.
- Add scoped support wrappers; do not clone appointment chat UIs.
- Keep appointment/provider chat and colleagues/groups logic intact and isolated.

Duplication controls:

- PMS: add support-specific methods in existing `chatService.ts` instead of new duplicate API clients.
- Mobile: add support-specific methods in existing `chatBackendService.ts`/`streamChatService.ts`; avoid new parallel services.
- Share support route param types and session DTOs via single source files per app.
- Centralize support badge/lifecycle rendering in reusable UI fragments, not repeated inline JSX.

## PMS Web Implementation

### 1. Add support scope in chat route

Update `chat/page.tsx`:

- Extend `chatScopes` with:
- `key: "support"`
- label and hint aligned to current visual tone.
- Keep appointment query behavior only for `clients` scope.

Inside support scope, add sub-sections:

- `Org Support Inbox` (required): parent -> org support requests for current org.
- `Company Support` (optional): org staff -> Yosemite Crew support.

### 2. Extend ChatScope type and resolution

Update `ChatContainer.tsx`:

- Add `support` to `ChatScope` union.
- Update `resolveChannelScope` to map:
- `chatCategory === "support"` to `support`.
- Keep fallback logic for existing categories unchanged.

### 3. Add support list filtering

In `channelRenderFilterFn` logic:

- include support channels only when `scope === "support"`.
- require either:
- `channel.data.chatCategory === "support"`
- or `channel.data.type === "SUPPORT"` for compatibility.

Critical with current implementation:

- Because `resolveChannelScope` defaults unknown channels to `colleagues`, backend must always set `chatCategory: "support"` on support channels.
- Otherwise support channels will leak into existing colleague UI.

### 4. Add Support scope header actions

In chat list header area:

- Add scoped CTA actions:
- `Open Org Support Inbox` (required for PMS support-team flow)
- `Contact Yosemite Support` (optional but recommended)
- On click:
- call scope-specific ensure API
- query/watch returned channel
- select it in UI

Show session metadata near header/list item:

- organization name
- support lifecycle status (`OPEN` / `RESOLVED`)

### 5. Add PMS service methods

Update `chatService.ts` with:

- `ensurePmsOrgSupportSession(payload)`
- `listPmsOrgSupportSessions(organisationId)`
- `openPmsOrgSupportSession(sessionId)`
- `resolvePmsOrgSupportSession(sessionId)`
- `reopenPmsOrgSupportSession(sessionId)`
- `ensurePmsCompanySupportSession(payload)` (optional)

Use endpoints:

- `POST /v1/chat/pms/support/org/sessions/ensure`
- `GET /v1/chat/pms/support/org/sessions/:organisationId`
- `POST /v1/chat/pms/support/org/sessions/:sessionId/open`
- `POST /v1/chat/pms/support/org/sessions/:sessionId/resolve`
- `POST /v1/chat/pms/support/org/sessions/:sessionId/reopen`
- `POST /v1/chat/pms/support/company/sessions/ensure` (optional)

Compatibility note:

- Keep `listOrgChatSessions` usage for colleague/group management as-is.
- Support scope should call support-specific list APIs, not `listOrgChatSessions`.

### 6. Add PMS type definitions

Update `types/chat.ts`:

- `SupportSession`
- `SupportSessionStatus`
- `SupportLifecycleStatus` (`OPEN | RESOLVED | CLOSED`)
- request/response shapes for ensure/open/list

### 7. PMS design-system constraints

- Reuse existing components and tokenized classes already present in chat module.
- Keep `font-satoshi` and existing color token usage.
- Do not introduce external UI libraries.
- Do not hardcode colors when token exists.

### 8. Mobile design-system constraints

- Reuse existing shared components (`Header`, `LiquidGlassHeaderScreen`, existing button/card primitives) for support entry points and chat wrappers.
- Keep typography/color usage aligned with current theme tokens/hooks.
- No new UI library introduction for support surfaces.
- Keep support CTAs in Account/View Business/Business List visually consistent with existing card action patterns.

## Mobile Implementation

### 1. Add Company Support entry in account screen

Update `AccountScreen.tsx` menu items:

- Add item id `company-support-chat`
- Label `Contact Yosemite Support`
- Navigate to chat screen in support mode routed to company support inbox.

### 2. Add Org Support entry points in business surfaces

Update:

- `apps/mobileAppYC/src/features/appointments/screens/ViewAppointmentScreen.tsx` or View Business screen equivalent
- `apps/mobileAppYC/src/features/appointments/screens/BusinessesListScreen.tsx` card actions

Add CTA:

- `Contact Business Support`
- Pass selected `organisationId` + `organisationName` to support chat route in org-support mode.

### 3. Navigation type updates

Update `navigation/types.ts`:

- Replace existing single-shape `ChatChannel` params with discriminated union to preserve appointment type safety:

```ts
ChatChannel: {
  mode: 'appointment';
  appointmentId: string;
  vetId: string;
  appointmentTime: string;
  doctorName: string;
  petName?: string;
} | {
  mode: 'support-company';
} | {
  mode: 'support-org';
  organisationId?: string;
  organisationName?: string;
};
```

Backward compatibility:

- appointment flow keeps current required fields unchanged.
- company support flow passes `mode: "support-company"`.
- org support flow passes `mode: "support-org"` with required org context.

### 4. Chat backend service updates

Add methods in `chatBackendService.ts`:

- `ensureMobileCompanySupportSession()`
- `listMobileCompanySupportSessions()`
- `openMobileCompanySupportSession(sessionId)`
- `ensureMobileOrgSupportSession({ organisationId, organisationName })`
- `listMobileOrgSupportSessions(organisationId?)`
- `openMobileOrgSupportSession(sessionId)`

Endpoints:

- `POST /v1/chat/mobile/support/company/sessions/ensure`
- `GET /v1/chat/mobile/support/company/sessions`
- `POST /v1/chat/mobile/support/company/sessions/:sessionId/open`
- `POST /v1/chat/mobile/support/org/sessions/ensure`
- `GET /v1/chat/mobile/support/org/sessions`
- `POST /v1/chat/mobile/support/org/sessions/:sessionId/open`

### 5. Stream service support resolver

In `streamChatService.ts`:

- Add scoped channel getters:
- `getCompanySupportChannel()`
- `getOrgSupportChannel({ organisationId, organisationName })`

Flow:

1. ensure support session via backend
2. open support session (retrieve token/channel info if needed)
3. initialize/watch channel
4. return channel + metadata

Resolved handling:

- If session is `RESOLVED`, keep composer enabled.
- Show banner: `Marked resolved. Send a message to continue support.`

Current mobile service compatibility:

- Keep `getAppointmentChannel` behavior unchanged for appointment mode.
- Add dedicated company/org support getters; do not overload appointment method with support branching.

### 6. Screen-level support mode

Update `ChatChannelScreen.tsx`:

- Detect route `mode`.
- If `mode === "support-company"`:
- use company support resolver
- If `mode === "support-org"`:
- use org support resolver
- set header title e.g. `Support Chat`
- show org subtitle when available
- hide appointment-specific assumptions.
- render lifecycle banner for resolved state.

Maintain appointment mode unchanged.

### 7. i18n requirements

All user-visible strings in mobile must be moved to `t()` keys:

- `support_chat`
- `start_support_chat`
- `support_chat_unavailable`
- `support_org_context`
- `contact_yosemite_support`
- `contact_business_support`

No hardcoded new English strings inside components.

## Shared UX and State Rules

- Closed support chats are read-only.
- Users can still view history in closed sessions.
- Org context should be visible in support conversation title/header/subheader.
- Support sessions should not appear under client/colleague/group scopes.
- `RESOLVED` support sessions are not read-only; they are paused and resume in same thread on user message.
- Company support and org support must be visually distinguishable (badge/chip) in UI.

Email expectation (backend-driven):

- On open/resolve/reopen/end events, backend sends transactional emails to relevant participants.
- PMS/mobile clients should not send emails directly.

## Error Handling Requirements

- 401: force auth refresh/logout path.
- 403: show permission error and disable composer.
- 404: session no longer available, prompt to create fresh support thread.
- Network failures: retry action and non-blocking toast/alert.

## Analytics and Logging

Track events:

- `support_chat_open_clicked`
- `support_chat_session_ensured`
- `support_chat_open_failed`
- `support_chat_resolved_viewed`

Never include raw message content in telemetry.

## Testing Plan

### PMS targeted tests

- Add tests for new `support` scope in chat page tabs.
- Add tests for support channel filter behavior.
- Add tests for Start Support Chat action calling service and selecting channel.

Run:

- `pnpm --filter frontend run lint`
- `npx tsc --noemit` from `apps/frontend`
- `pnpm --filter frontend run test -- --testPathPattern="chat"`

### Mobile targeted tests

- Add tests for account menu support entry.
- Add tests for support mode path in `ChatChannelScreen`.
- Add tests for new backend service methods.

Run:

- `pnpm --filter mobileAppYC run lint`
- `pnpm --filter mobileAppYC run test -- --testPathPattern="chat"`

## Rollout Strategy

1. Release backend support endpoints first.
2. Release PMS/mobile support UI behind feature flag.
3. Enable per organization cohort.
4. Monitor failures and channel creation duplication.

## Acceptance Criteria

- PMS user can create/open support thread and sees org context.
- Mobile user can open company support thread from Account.
- Mobile user can open org support thread from View Business and Business List card action.
- Same requester in different organizations gets separate threads.
- Superadmin receives all new support threads in queue with org metadata.
- Resolved support thread shows pause banner and allows same-thread follow-up by user.
- User follow-up after resolution reactivates support lifecycle.
- Existing non-support chat scopes continue to work.

## Production Readiness Checklist

- Web: `clients/colleagues/groups` tabs behave exactly as before.
- Web: support scope and sub-sections route only support sessions.
- Mobile: appointment/provider chat flow unchanged from existing navigation points.
- Mobile: Account opens company support; business surfaces open org support with correct org context.
- Lifecycle banners and pause/resume behavior validated on both web and mobile.
- All new user-facing strings localized (`t()` usage on mobile).
- Existing custom components/design tokens used; no raw SDK-only UI dumps.

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
