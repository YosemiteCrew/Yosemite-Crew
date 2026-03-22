# Companion History Frontend Guide

## Objective

Implement a new reusable `History` experience for companion medical history in two places:

1. Appointment modal: `Appointments -> View Appointment -> Info -> History`
2. Companion modal: `Companions -> View Companion -> Records -> History`

The new history should present a unified clinical timeline and replace the current appointment-only list.

## Locked Product Decisions

### Keep

1. Appointment `Finance` section and invoice flow as a separate tab
2. Existing document add/upload flow
3. Existing appointment prescription documents tab
4. Existing SOAP submit flow
5. Existing labs tab

### Change

1. Both History surfaces switch from appointment-only cards to unified timeline
2. Companion `Records -> Documents` subtab is removed
3. Documents now also appear inside History

### Display behavior

1. Layout: unified chronological timeline
2. Default window: latest `50` entries
3. Pagination: `Load more`
4. Labs: included
5. Row action: open source record in-place using current flows where possible

## Current Frontend State

### Existing History implementation

Both views just render [AppointmentHistoryList.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/appointments/components/AppointmentHistoryList.tsx).

Wrappers:

1. [History.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/History.tsx)
2. [History.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/companions/components/Sections/History.tsx)

### Existing companion documents tab

Companion modal tabs are defined in [CompanionInfo.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/companions/components/CompanionInfo.tsx).

Current `Records` sublabels:

1. `History`
2. `Documents`

## Recommended Frontend Design

## New reusable feature

Create a dedicated history feature rather than extending `AppointmentHistoryList`.

Suggested new frontend area:

1. `/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/companionHistory/`

Suggested files:

1. `components/CompanionHistoryTimeline.tsx`
2. `components/HistoryEntryCard.tsx`
3. `components/HistoryFilters.tsx`
4. `components/HistoryEmptyState.tsx`
5. `services/companionHistoryService.ts`
6. `types/history.ts`
7. `utils/historyFormatters.ts`

## Data contract

Match backend normalized response directly.

Suggested frontend types:

```ts
export type HistoryEntryType =
  | 'APPOINTMENT'
  | 'TASK'
  | 'FORM_SUBMISSION'
  | 'DOCUMENT'
  | 'LAB_RESULT'
  | 'INVOICE';

export type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  occurredAt: string;
  status?: string;
  title: string;
  subtitle?: string;
  summary?: string;
  actor?: {
    id?: string;
    name?: string;
    role?: 'VET' | 'STAFF' | 'PARENT' | 'SYSTEM';
  };
  tags?: string[];
  link: {
    kind: string;
    id: string;
    appointmentId?: string;
    companionId: string;
  };
  source: string;
  payload: Record<string, unknown>;
};

export type CompanionHistoryResponse = {
  entries: HistoryEntry[];
  nextCursor: string | null;
  summary: {
    totalReturned: number;
    countsByType: Record<string, number>;
  };
};
```

## UI structure

### Timeline shell

Render in this order:

1. header / intro row
2. quick filters
3. history timeline list
4. load more button
5. inline empty state

### Quick filters

Inside the history surface, add quick chips for:

1. `All`
2. `Appointments`
3. `Tasks`
4. `SOAP / Forms`
5. `Documents`
6. `Labs`
7. `Finance`

These are local filters on already-fetched entries unless backend type filtering is needed later.

### Entry card layout

Each row should show:

1. type badge
2. occurred date/time
3. title
4. subtitle
5. summary/details preview
6. actor name if relevant
7. small metadata chips
8. primary action

Design direction:

1. clean medical timeline, not generic table
2. high information density but still readable
3. mobile-safe stacked layout
4. use current design system components first

## Type-specific rendering rules

### Appointment rows

Show:

1. service name
2. concern / reason
3. lead vet
4. room
5. status
6. date/time

Primary action:

1. open appointment in existing appointment modal context if possible

### Task rows

Show:

1. task name
2. audience
3. due/completed status
4. description
5. medication summary when present

Primary action:

1. open task details if existing in-place flow is available
2. otherwise show read-only inline details

### SOAP / form submission rows

Show:

1. form name
2. category
3. SOAP subtype tag if applicable
4. submission date
5. signed / pending signature state if present

Primary action:

1. open related appointment modal and switch to relevant form / prescription context when possible
2. otherwise show read-only detail drawer later

### Document rows

Show:

1. title
2. category / subcategory
3. issue date
4. issuer
5. source chip like `PMS`, `Synced`, `Manual`

Primary action:

1. open file using existing document download/open flow

### Lab result rows

Show:

1. lab provider badge, e.g. `IDEXX`
2. result status
3. accession/order identifier if present
4. short abnormality preview if available

Primary action:

1. open result PDF or existing lab result view

### Invoice rows

Show:

1. invoice status
2. total amount and currency
3. payment collection method
4. paid date if paid

Primary action:

1. in appointment flow, switch to existing finance tab for linked appointment if `appointmentId` exists
2. in companion flow, open invoice detail context if available, otherwise read-only preview

## Integration Points

### 1. Appointment modal history

Replace current history wrapper in:

1. [History.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Info/History.tsx)

New wrapper should pass:

1. `companionId`
2. optional `activeAppointmentId`
3. handlers for deep-link actions back into the appointment modal

### 2. Companion modal history

Replace current history wrapper in:

1. [History.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/companions/components/Sections/History.tsx)

### 3. Companion modal tab structure

Update:

1. [CompanionInfo.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/features/companions/components/CompanionInfo.tsx)

Changes:

1. remove `documents` from `Records`
2. keep `history`
3. remove obsolete mapping for companion records documents section

Do not touch appointment modal navigation for finance.

## Service layer

Add new service:

1. `companionHistoryService.ts`

Suggested API:

```ts
export const fetchCompanionHistory = async (params: {
  organisationId: string;
  companionId: string;
  limit?: number;
  cursor?: string | null;
  types?: string[];
}): Promise<CompanionHistoryResponse> => { ... }
```

Prefer direct fetch-on-open in component state for v1 instead of introducing a new Zustand store unless reuse expands beyond these two surfaces.

Reason:

1. history is modal-scoped
2. pagination state is local
3. avoids unnecessary global cache complexity

## State management

Inside `CompanionHistoryTimeline` maintain:

1. `entries`
2. `loading`
3. `error`
4. `activeFilter`
5. `nextCursor`
6. `loadingMore`

Behavior:

1. fetch when modal tab mounts or companion changes
2. reset local state when companion changes
3. append on `Load more`

## Row actions and deep linking

### Appointment flow

If a history entry has `appointmentId`:

1. use existing appointment modal navigation state where possible
2. switch labels intelligently:
   - `INVOICE` -> `finance / summary`
   - `LAB_RESULT` -> `labs / idexx-labs`
   - `FORM_SUBMISSION` -> `prescription / forms` when appropriate

### Companion flow

If entry links to an appointment:

1. either open that appointment in appointment modal if shared machinery is available
2. or open read-only entry detail in-place

For v1, simplest acceptable behavior:

1. document rows open file
2. lab rows open PDF
3. appointment-linked finance / forms rows open appointment flow when technically feasible

## Backward Compatibility Requirements

Do not remove:

1. appointment finance summary/details tabs
2. prescription documents tab
3. companion document upload functionality

Recommended UI treatment for companion document upload:

1. move upload accordion into History page near top or as a secondary CTA
2. keep using existing `CompanionDocumentsSection` internals only where reusable

If reusing the full old component is too heavy, extract only the upload behavior into a smaller reusable block and keep the document display portion in timeline.

## Recommended Refactor Shape

### Avoid

1. stuffing all new logic into `AppointmentHistoryList`
2. bolting timeline logic into appointment modal index file
3. duplicating history UI separately for appointment and companion flows

### Prefer

1. one shared timeline component
2. thin wrappers in each flow
3. one service file
4. one history type module

## Suggested Implementation Order

1. create `types/history.ts`
2. create `services/companionHistoryService.ts`
3. create base timeline component with loading / empty states
4. create entry card renderer with type-specific presentation
5. wire appointment history wrapper
6. wire companion history wrapper
7. remove companion records documents subtab
8. add doc upload CTA / block inside history
9. connect deep-link actions
10. add tests

## Test Plan

### Component tests

Cover:

1. timeline renders mixed entries
2. filter chips narrow by type
3. load-more appends entries
4. empty state
5. error state
6. type-specific card rendering

### Integration tests

Update or add tests for:

1. [index.test.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/__tests__/pages/Appointments/Sections/AppointmentInfo/index.test.tsx)
2. [index.test.tsx](/Users/harshitwandhare/Desktop/Yosemite-Crew/apps/frontend/src/app/__tests__/components/CompanionInfo/index.test.tsx)

New expectations:

1. appointment history renders shared timeline
2. companion records only shows `History`
3. appointment finance tab still exists unchanged
4. document open action still works

### Validation commands

Required before checkpoint:

1. `pnpm --filter frontend run lint`
2. `npx tsc --noemit` from `apps/frontend/`
3. targeted tests only, e.g. `pnpm --filter frontend run test -- --testPathPattern="CompanionInfo|AppointmentInfo|CompanionHistory"`

## UX Acceptance Criteria

Frontend is complete when:

1. both history surfaces show unified medical timeline
2. appointments, tasks, forms, docs, labs, and finance appear in one stream
3. appointment finance tab still works independently
4. companion documents upload flow still exists
5. companion records documents subtab is removed
6. load-more pagination works
7. row actions open existing flows where applicable

## Non-Goals

Do not do in this refactor:

1. redesign finance tab
2. redesign IDEXX workspace
3. replace document backend flows
4. add cross-org history
5. create a separate dedicated full-page history screen
