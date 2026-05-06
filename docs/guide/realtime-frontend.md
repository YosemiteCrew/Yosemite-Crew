# Real-Time Sync — Frontend Implementation Guide

> **Stack:** Socket.IO client · Zustand notification store · In-app notification bell
>
> **Assigned to:** Frontend Engineer
> **Dependencies already installed:** `socket.io-client`

---

## Architecture Overview

```
Socket.IO server emits "org:event" to room "org:{orgId}"
         │
         ▼
useRealtimeSync hook (lives in SessionInitializer)
         │
         ├──► HANDLERS map → triggers force-reload of the right store
         │         APPOINTMENT_CREATED  → loadAppointmentsForPrimaryOrg({ force, silent })
         │         TASK_UPDATED         → loadTasksForPrimaryOrg({ force, silent })
         │         INVOICE_CREATED      → loadInvoicesForOrgPrimaryOrg({ force })
         │         ...
         │
         └──► notificationStore.addNotification()
                   │
                   └──► NotificationBell badge increments, dropdown shows event
```

**Result:** Every tab open in the same org updates its store automatically within ~100–200ms of any mutation, with no full page reload and no polling.

---

## Phase 1 — Shared Event Type

> Do this first. Both sides need to agree on the contract before anything else.

### Option A (recommended): Add to `packages/types`

**New file:** `packages/types/src/realtime.ts`

```typescript
export type OrgEventType =
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_UPDATED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_STATUS_CHANGED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'TEAM_MEMBER_UPDATED'
  | 'COMPANION_UPDATED';

export interface OrgEvent {
  type: OrgEventType;
  orgId: string;
  payload: Record<string, unknown>; // the mutated object (full or partial)
  actorId: string; // userId who triggered the change
  timestamp: string; // ISO 8601
}
```

Then export it from `packages/types/src/index.ts`:

```typescript
export * from './realtime';
```

Both backend and frontend import from `@yosemite-crew/types` — single source of truth, compiler enforces parity.

### Option B: Local type file

If adding to the shared package is blocked, create locally:

**New file:** `apps/frontend/src/app/types/realtime.ts`

```typescript
// Mirror of packages/types/src/realtime.ts — keep in sync manually
export type OrgEventType =
  | 'APPOINTMENT_CREATED'
  | 'APPOINTMENT_UPDATED'
  | 'APPOINTMENT_CANCELLED'
  | 'APPOINTMENT_STATUS_CHANGED'
  | 'TASK_CREATED'
  | 'TASK_UPDATED'
  | 'TASK_DELETED'
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'TEAM_MEMBER_UPDATED'
  | 'COMPANION_UPDATED';

export interface OrgEvent {
  type: OrgEventType;
  orgId: string;
  payload: Record<string, unknown>;
  actorId: string;
  timestamp: string;
}
```

---

## Phase 2 — Socket Singleton

**New file:** `apps/frontend/src/app/services/socket.ts`

```typescript
import { io, Socket } from 'socket.io-client';

// One socket instance per browser session.
// Replaced entirely on disconnectSocket() to allow clean reconnect after logout.
let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_BACKEND_WS_URL ?? 'http://localhost:3000', {
      autoConnect: false, // We connect manually after auth
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
      reconnectionAttempts: Infinity,
    });
  }
  return socket;
};

export const connectSocket = (jwtToken: string): void => {
  const s = getSocket();
  s.auth = { token: jwtToken };
  if (!s.connected) s.connect();
};

export const disconnectSocket = (): void => {
  socket?.disconnect();
  socket = null; // Reset so the next connectSocket() gets a clean instance
};
```

Add to `.env.local` (development) and deployment env vars (production):

```env
NEXT_PUBLIC_BACKEND_WS_URL=https://api.yosemitecrew.com
```

For local development:

```env
NEXT_PUBLIC_BACKEND_WS_URL=http://localhost:3000
```

---

## Phase 3 — Notification Store

**New file:** `apps/frontend/src/app/stores/notificationStore.ts`

```typescript
import { create } from 'zustand';
import { OrgEventType } from '@yosemite-crew/types'; // or from '@/app/types/realtime'

export interface AppNotification {
  id: string;
  type: OrgEventType | 'GENERAL';
  message: string;
  timestamp: string;
  read: boolean;
}

type NotificationState = {
  notifications: AppNotification[];
  unreadCount: number;

  addNotification: (n: AppNotification) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  clearAll: () => void;
};

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  addNotification: (n) =>
    set((s) => ({
      // Prepend new notification, cap list at 50 to prevent memory growth
      notifications: [n, ...s.notifications].slice(0, 50),
      unreadCount: s.unreadCount + 1,
    })),

  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),

  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  clearAll: () => set({ notifications: [], unreadCount: 0 }),
}));
```

Also add `clearAll` to `apps/frontend/src/app/lib/resetSessionStores.ts` so notifications are wiped on logout:

```typescript
// Add this import:
import { useNotificationStore } from '@/app/stores/notificationStore';

// Add this line inside clearSessionScopedStores():
useNotificationStore.getState().clearAll();
```

---

## Phase 4 — `useRealtimeSync` Hook

**New file:** `apps/frontend/src/app/hooks/useRealtimeSync.ts`

```typescript
import { useEffect } from 'react';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { connectSocket, disconnectSocket, getSocket } from '@/app/services/socket';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { loadTasksForPrimaryOrg } from '@/app/features/tasks/services/taskService';
import { loadInvoicesForOrgPrimaryOrg } from '@/app/features/billing/services/invoiceService';
import { loadTeam } from '@/app/features/organization/services/teamService';
import { useNotificationStore } from '@/app/stores/notificationStore';
import { OrgEvent, OrgEventType } from '@yosemite-crew/types'; // or '@/app/types/realtime'

// Maps every event type to the store reload it triggers.
// Extend this map as the backend adds more event types.
const HANDLERS: Record<OrgEventType, (event: OrgEvent) => void> = {
  APPOINTMENT_CREATED: () => void loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
  APPOINTMENT_UPDATED: () => void loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
  APPOINTMENT_CANCELLED: () => void loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
  APPOINTMENT_STATUS_CHANGED: () =>
    void loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
  TASK_CREATED: () => void loadTasksForPrimaryOrg({ force: true, silent: true }),
  TASK_UPDATED: () => void loadTasksForPrimaryOrg({ force: true, silent: true }),
  TASK_DELETED: () => void loadTasksForPrimaryOrg({ force: true, silent: true }),
  INVOICE_CREATED: () => void loadInvoicesForOrgPrimaryOrg({ force: true }),
  INVOICE_UPDATED: () => void loadInvoicesForOrgPrimaryOrg({ force: true }),
  TEAM_MEMBER_UPDATED: () => void loadTeam({ force: true, silent: true }),
  COMPANION_UPDATED: () => {}, // extend when companion real-time is needed
};

const buildNotificationMessage = (event: OrgEvent): string => {
  switch (event.type) {
    case 'APPOINTMENT_CREATED':
      return 'New appointment booked';
    case 'APPOINTMENT_UPDATED':
      return 'Appointment updated';
    case 'APPOINTMENT_CANCELLED':
      return 'An appointment was cancelled';
    case 'APPOINTMENT_STATUS_CHANGED':
      return 'Appointment status changed';
    case 'TASK_CREATED':
      return 'New task assigned';
    case 'TASK_UPDATED':
      return 'A task was updated';
    case 'TASK_DELETED':
      return 'A task was removed';
    case 'INVOICE_CREATED':
      return 'New invoice created';
    case 'INVOICE_UPDATED':
      return 'Invoice updated';
    case 'TEAM_MEMBER_UPDATED':
      return 'Team member updated';
    default:
      return 'Something was updated';
  }
};

export const useRealtimeSync = () => {
  const primaryOrgId = useOrgStore((s) => s.primaryOrgId);
  const addNotification = useNotificationStore((s) => s.addNotification);

  // 1. Connect socket on mount with current Cognito JWT. Disconnect on unmount.
  useEffect(() => {
    let cancelled = false;

    const connect = async () => {
      try {
        const session = await useAuthStore.getState().getValidSession();
        if (!session || cancelled) return;
        const token = session.getIdToken().getJwtToken();
        connectSocket(token);
      } catch {
        // Auth failure — OrgGuard will redirect the user
      }
    };

    void connect();
    return () => {
      cancelled = true;
      disconnectSocket();
    };
  }, []); // Intentionally only on mount/unmount

  // 2. Join/leave org room when primaryOrgId changes
  useEffect(() => {
    if (!primaryOrgId) return;
    const socket = getSocket();
    socket.emit('join:org', primaryOrgId);
    return () => {
      socket.emit('leave:org', primaryOrgId);
    };
  }, [primaryOrgId]);

  // 3. Listen for events and dispatch to the right store reload
  useEffect(() => {
    const socket = getSocket();

    const handleOrgEvent = (event: OrgEvent) => {
      // Optional: skip events we ourselves triggered to avoid double-reload
      // const myUserId = useAuthStore.getState().user?.getUsername();
      // if (event.actorId === myUserId) return;

      // Show in-app notification for appointment and task events
      if (
        event.type.startsWith('APPOINTMENT_') ||
        event.type.startsWith('TASK_') ||
        event.type.startsWith('INVOICE_')
      ) {
        addNotification({
          id: `${event.type}-${event.timestamp}`,
          type: event.type,
          message: buildNotificationMessage(event),
          timestamp: event.timestamp,
          read: false,
        });
      }

      HANDLERS[event.type]?.(event);
    };

    socket.on('org:event', handleOrgEvent);
    return () => {
      socket.off('org:event', handleOrgEvent);
    };
  }, [addNotification]);
};
```

**Key design decisions:**

- `force: true, silent: true` — bypasses the "already loaded" guard because we know data changed; `silent` means no loading spinner shown to user
- Three separate `useEffect` calls — connect/disconnect, room join/leave, and event handling are independent lifecycles. Merging them causes missed cleanup.
- `HANDLERS` map is the single place to wire new event types — adding a new entity type is one line

---

## Phase 5 — Notification Bell Component

**New file:** `apps/frontend/src/app/ui/layout/Header/NotificationBell.tsx`

```tsx
'use client';
import { useState } from 'react';
import { useNotificationStore } from '@/app/stores/notificationStore';

export const NotificationBell = () => {
  const { notifications, unreadCount, markAllRead } = useNotificationStore();
  const [open, setOpen] = useState(false);

  const handleOpen = () => {
    setOpen((v) => !v);
    if (!open && unreadCount > 0) markAllRead();
  };

  return (
    <div className="relative">
      <button
        type="button"
        className="relative p-2 rounded-full hover:bg-surface-secondary transition-colors"
        onClick={handleOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        {/* Replace with your project's bell icon component */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5 text-text-primary"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002
               6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6
               8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6
               0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-input-border-error text-[10px] font-bold text-white leading-none">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* Backdrop to close on outside click */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />

          <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border border-border-primary bg-surface-primary shadow-lg">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border-primary">
              <span className="text-body-3 font-medium text-text-primary">Notifications</span>
            </div>

            <ul className="max-h-80 overflow-y-auto divide-y divide-border-primary">
              {notifications.length === 0 ? (
                <li className="px-4 py-8 text-center text-body-4 text-text-tertiary">
                  No notifications yet
                </li>
              ) : (
                notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`px-4 py-3 transition-opacity ${n.read ? 'opacity-60' : ''}`}
                  >
                    <p className="text-body-4 text-text-primary">{n.message}</p>
                    <p className="text-caption text-text-tertiary mt-0.5">
                      {new Date(n.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};
```

---

## Phase 6 — Wire Into `SessionInitializer` and `Header`

### `SessionInitializer.tsx`

Two lines added:

```tsx
// 1. Import at top of file:
import { useRealtimeSync } from '@/app/hooks/useRealtimeSync';

// 2. Inside the component body, alongside the other hooks:
useRealtimeSync();
```

### `Header.tsx` (or wherever the header right-side is rendered)

```tsx
// 1. Import:
import { NotificationBell } from './NotificationBell';

// 2. In JSX, alongside the user avatar / org switcher:
<NotificationBell />;
```

---

## Tests to Write

Each new file needs a test. Test file locations follow the existing `src/app/__tests__/` mirror pattern:

| Source file                                     | Test file                                                       |
| ----------------------------------------------- | --------------------------------------------------------------- |
| `src/app/stores/notificationStore.ts`           | `src/app/__tests__/stores/notificationStore.test.ts`            |
| `src/app/hooks/useRealtimeSync.ts`              | `src/app/__tests__/hooks/useRealtimeSync.test.ts`               |
| `src/app/ui/layout/Header/NotificationBell.tsx` | `src/app/__tests__/components/Header/NotificationBell.test.tsx` |

### `notificationStore.test.ts` — what to cover

- `addNotification` adds to front of list and increments `unreadCount`
- `addNotification` caps list at 50 entries
- `markRead` marks one notification read and decrements `unreadCount`
- `markAllRead` marks all read and sets `unreadCount` to 0
- `clearAll` resets to empty state

### `useRealtimeSync.test.ts` — what to cover

- Calls `connectSocket` with the JWT from `getValidSession()` on mount
- Calls `disconnectSocket` on unmount
- Emits `join:org` when `primaryOrgId` is set
- Emits `leave:org` on cleanup when `primaryOrgId` changes
- On `org:event` with `APPOINTMENT_CREATED`, calls `loadAppointmentsForPrimaryOrg`
- On `org:event` with `TASK_CREATED`, calls `loadTasksForPrimaryOrg`
- Calls `addNotification` for appointment events
- Does NOT call `addNotification` for `COMPANION_UPDATED` (not in notification list)

Mock pattern for socket in tests:

```typescript
jest.mock('@/app/services/socket', () => ({
  getSocket: jest.fn(() => ({
    emit: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
    connected: false,
  })),
  connectSocket: jest.fn(),
  disconnectSocket: jest.fn(),
}));
```

### `NotificationBell.test.tsx` — what to cover

- Renders bell icon with no badge when `unreadCount` is 0
- Renders badge with correct count when `unreadCount > 0`
- Badge shows `9+` when `unreadCount > 9`
- Clicking the button opens the dropdown
- Clicking the button calls `markAllRead`
- Renders "No notifications yet" when list is empty
- Renders notification messages and timestamps when list is populated
- Clicking the backdrop closes the dropdown

---

## Commit Messages

```
feat(types): add OrgEvent and OrgEventType to shared types package
feat(frontend): add socket.io singleton with connect/disconnect helpers
feat(frontend): add notificationStore for persistent in-app notifications
feat(frontend): add useRealtimeSync hook wiring socket events to stores
feat(frontend): add NotificationBell component with unread badge
feat(frontend): wire useRealtimeSync into SessionInitializer
feat(frontend): add NotificationBell to Header
test(frontend): add tests for notificationStore, useRealtimeSync, NotificationBell
fix(frontend): clear notificationStore on logout in resetSessionStores
```

---

## Rollout Order

| Step | Task                                      | Blocked by                                |
| ---- | ----------------------------------------- | ----------------------------------------- |
| 1    | Add shared types to `packages/types`      | Nothing                                   |
| 2    | `notificationStore.ts` + tests            | Step 1                                    |
| 3    | `socket.ts` singleton                     | Nothing                                   |
| 4    | `useRealtimeSync.ts` + tests              | Steps 2, 3, backend Socket.IO server live |
| 5    | `NotificationBell.tsx` + tests            | Step 2                                    |
| 6    | Wire into `SessionInitializer` + `Header` | Steps 4, 5                                |
| 7    | Update `resetSessionStores.ts`            | Step 2                                    |

Steps 2, 3, and 5 can be done in parallel. Step 4 requires the backend Socket.IO server to be deployed to test end-to-end, but the hook can be written and unit-tested against mocks before the backend is ready.
