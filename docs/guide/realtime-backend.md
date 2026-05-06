# Real-Time Sync — Backend Implementation Guide

> **Stack:** Redis Pub/Sub as event bus · Socket.IO for browser push · Firebase FCM for mobile (already live)
>
> **Assigned to:** Backend Engineer
> **Dependencies already installed:** `ioredis`, `@socket.io/redis-adapter`

---

## Architecture Overview

```
Any mutation (appointment, task, invoice, team...)
         │
         ▼
  Backend service calls EventBus.publish()
         │
         ├──► Redis channel "org:{orgId}:events"
         │         │
         │         └──► Socket.IO server (psubscribe to org:*:events)
         │                   │
         │                   └──► io.to("org:{orgId}").emit("org:event", event)
         │                             │
         │                             ├── Staff A browser updates store
         │                             ├── Staff B browser updates store
         │                             └── Staff C browser updates store
         │
         └──► FCM NotificationService (already exists — mobile push)
```

**Why Redis as the bus, not direct Socket.IO emit?**
When scaled to multiple backend instances behind a load balancer, each instance only knows its own Socket.IO connections. Redis pub/sub broadcasts to all instances simultaneously — the `@socket.io/redis-adapter` handles this automatically. Without it, Staff B on Instance 2 never hears events from Instance 1.

---

## Files to Create

### 1. `src/types/realtime.ts` — Shared event contract

> **Important:** Also add this type to `packages/types/src/realtime.ts` so the frontend can import it from `@yosemite-crew/types` instead of duplicating it.

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

---

### 2. `src/services/eventBus.service.ts` — Redis pub/sub publisher

```typescript
import Redis from 'ioredis';
import { OrgEvent } from 'src/types/realtime';
import logger from 'src/utils/logger';

// Separate publisher client — a Redis client in subscribe mode cannot
// send other commands (ioredis rule). Keep this client publish-only.
let publisher: Redis | null = null;

const getPublisher = (): Redis => {
  if (!publisher) {
    publisher = new Redis({
      host: process.env.REDIS_HOST ?? '127.0.0.1',
      port: Number(process.env.REDIS_PORT ?? 6379),
      password: process.env.REDIS_PASSWORD ?? undefined,
      lazyConnect: true,
    });
    publisher.on('error', (err) => logger.error('EventBus Redis error:', err));
  }
  return publisher;
};

export const EventBus = {
  async publish(event: OrgEvent): Promise<void> {
    const channel = `org:${event.orgId}:events`;
    try {
      await getPublisher().publish(channel, JSON.stringify(event));
    } catch (err) {
      // Never let pub/sub failure crash a mutation. Log and continue.
      logger.error('EventBus publish failed:', err);
    }
  },
};
```

**Key rules:**

- `publish()` must never throw — a Redis failure must not fail the HTTP response
- This is a separate Redis client from the BullMQ connection and the Socket.IO adapter clients (ioredis clients are not reusable across subscribe/publish modes)
- `lazyConnect: true` prevents startup failure if Redis is briefly unavailable

---

### 3. `src/realtime/socket.ts` — Socket.IO server with Redis adapter + Cognito auth

```typescript
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import logger from 'src/utils/logger';
import { OrgEvent } from 'src/types/realtime';

const { COGNITO_REGION, COGNITO_USER_POOL_ID, FRONTEND_URL } = process.env;

const issuer = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}`;

// Reuse the same JWKS pattern already in middlewares/auth.ts
const jwks = jwksClient({
  jwksUri: `${issuer}/.well-known/jwks.json`,
  cache: true,
  cacheMaxEntries: 20,
  cacheMaxAge: 10 * 60 * 1000,
});

const verifyToken = (token: string): Promise<jwt.JwtPayload> =>
  new Promise((resolve, reject) => {
    jwt.verify(
      token,
      (header, callback) => {
        jwks.getSigningKey(header.kid!, (err, key) => {
          if (err) return callback(err);
          callback(null, key!.getPublicKey());
        });
      },
      { algorithms: ['RS256'], issuer },
      (err, decoded) => {
        if (err || !decoded) return reject(err ?? new Error('Invalid token'));
        resolve(decoded as jwt.JwtPayload);
      }
    );
  });

export function attachSocketIO(httpServer: HttpServer): SocketIOServer {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: FRONTEND_URL ?? 'http://localhost:3000',
      credentials: true,
    },
    // Prefer WebSocket, fall back to long-polling automatically
    transports: ['websocket', 'polling'],
  });

  // Redis adapter — makes pub/sub work across multiple backend instances
  const pubClient = new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? undefined,
  });
  const subClient = pubClient.duplicate();
  io.adapter(createAdapter(pubClient, subClient));

  // Auth middleware — validates Cognito JWT on every Socket.IO connection
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error('UNAUTHORIZED'));
      const payload = await verifyToken(token);
      socket.data.userId = payload.sub;
      next();
    } catch {
      next(new Error('UNAUTHORIZED'));
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id} user: ${socket.data.userId}`);

    // Client sends the orgId it wants to listen to
    socket.on('join:org', (orgId: string) => {
      if (typeof orgId !== 'string' || !orgId) return;
      socket.join(`org:${orgId}`);
      logger.info(`Socket ${socket.id} joined room org:${orgId}`);
    });

    socket.on('leave:org', (orgId: string) => {
      socket.leave(`org:${orgId}`);
    });

    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  // Subscribe to all org channels via Redis pattern matching
  const subscriber = new Redis({
    host: process.env.REDIS_HOST ?? '127.0.0.1',
    port: Number(process.env.REDIS_PORT ?? 6379),
    password: process.env.REDIS_PASSWORD ?? undefined,
  });

  subscriber.psubscribe('org:*:events', (err) => {
    if (err) logger.error('Redis psubscribe failed:', err);
    else logger.info('Socket.IO subscribed to Redis org:*:events');
  });

  subscriber.on('pmessage', (_pattern, _channel, message) => {
    try {
      const event: OrgEvent = JSON.parse(message);
      io.to(`org:${event.orgId}`).emit('org:event', event);
    } catch (err) {
      logger.error('Failed to parse org event from Redis:', err);
    }
  });

  return io;
}
```

**Key design decisions:**

- JWT verified on WebSocket handshake — same Cognito auth as HTTP, no new auth surface
- Room pattern `org:{orgId}` — staff only receive events for their org; admins with access to multiple orgs can join multiple rooms
- Pattern subscribe `org:*:events` — one subscriber handles all orgs, no per-org subscription management needed
- The Redis subscriber is separate from the adapter clients (ioredis subscribed clients are read-only)

---

## Files to Modify

### 4. `src/main.ts` — Attach Socket.IO to the HTTP server

Replace `app.listen()` with an explicit HTTP server so Socket.IO shares port 3000:

```typescript
import { createServer } from 'http';
import { createApp } from './app';
import { connectDB } from './config/db';
import { initQueues } from './queues';
import { attachSocketIO } from './realtime/socket';
import logger from './utils/logger';
import './workers';

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectDB();
    await initQueues();
    const app = createApp();

    // Raw HTTP server so Socket.IO shares the same port as Express
    const httpServer = createServer(app);
    attachSocketIO(httpServer);

    httpServer.listen(PORT, () => {
      logger.info(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

void startServer();
```

**The only change from current code:** `app.listen()` → `createServer(app)` + `httpServer.listen()`. No new port, no proxy needed.

---

### 5. `src/app.ts` — Update CORS to allow production frontend

Replace the existing cors block:

```typescript
const allowedOrigins = new Set(
  [
    process.env.FRONTEND_URL,
    process.env.LOCAL_DEVELOPMENT ? 'http://localhost:3000' : undefined,
    process.env.LOCAL_DEVELOPMENT ? 'http://127.0.0.1:3000' : undefined,
  ].filter(Boolean) as string[]
);

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true); // REST tools (Postman/curl)
      if (allowedOrigins.has(origin)) return callback(null, true);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
```

---

### 6. `src/services/appointment.service.ts` — Publish events after every mutation

Import `EventBus` at the top:

```typescript
import { EventBus } from 'src/services/eventBus.service';
```

Then add one `await EventBus.publish()` call after each successful DB write. Examples:

```typescript
// After createAppointmentFromPms() saves:
await EventBus.publish({
  type: 'APPOINTMENT_CREATED',
  orgId: organisationId,
  payload: { appointment: savedAppointment },
  actorId: createdByUserId,
  timestamp: new Date().toISOString(),
});

// After updateAppointmentPMS() saves:
await EventBus.publish({
  type: 'APPOINTMENT_UPDATED',
  orgId: organisationId,
  payload: { appointment: updatedAppointment },
  actorId: updatedByUserId,
  timestamp: new Date().toISOString(),
});

// After cancelAppointment():
await EventBus.publish({
  type: 'APPOINTMENT_CANCELLED',
  orgId: organisationId,
  payload: { appointmentId, status: 'CANCELLED' },
  actorId: cancelledByUserId,
  timestamp: new Date().toISOString(),
});

// After any status transition (accept, check-in, complete, no-show):
await EventBus.publish({
  type: 'APPOINTMENT_STATUS_CHANGED',
  orgId: organisationId,
  payload: { appointmentId, status: newStatus },
  actorId: changedByUserId,
  timestamp: new Date().toISOString(),
});
```

Apply the same pattern to:

- `src/services/task.service.ts` → `TASK_CREATED`, `TASK_UPDATED`, `TASK_DELETED`
- `src/services/invoice.service.ts` → `INVOICE_CREATED`, `INVOICE_UPDATED`
- `src/services/team.service.ts` (or equivalent) → `TEAM_MEMBER_UPDATED`

**Start with appointments only. Confirm end-to-end works, then add the rest.**

---

## New Environment Variables

Add to `.env` and all deployment configs (ECS task definition, K8s secret, etc.):

```env
FRONTEND_URL=https://app.yosemitecrew.com   # Production frontend origin for CORS
# Redis vars already exist for BullMQ — reuse them:
# REDIS_HOST=...
# REDIS_PORT=...
# REDIS_PASSWORD=...
```

---

## Testing

```bash
# 1. Start the backend
pnpm --filter backend run dev

# 2. Watch Redis events in real time
redis-cli PSUBSCRIBE "org:*:events"

# 3. Create an appointment via the PMS
# Expected: JSON event appears in the redis-cli terminal immediately

# 4. Open the frontend in two browser tabs (same org)
# Expected: Tab B calendar updates within 200ms of Tab A creating an appointment
```

---

## Scaling Notes

| Scenario                     | Behaviour                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Single instance              | Works as-is                                                                                                    |
| Multiple instances (ECS/K8s) | Redis adapter fans out to all instances automatically — no sticky sessions needed                              |
| Redis failure                | `EventBus.publish()` catches and logs, mutation succeeds, clients get slightly stale data until Redis recovers |
| Redis recovery               | Pub/sub resumes automatically via ioredis reconnection                                                         |
| 1000+ concurrent users       | Socket.IO rooms are memory-efficient; Redis handles the fan-out load                                           |

---

## Commit Messages

```
feat(backend): add Redis EventBus service for org-scoped event publishing
feat(backend): add Socket.IO server with Cognito auth and Redis adapter
feat(backend): attach Socket.IO to HTTP server in main.ts
feat(backend): publish realtime events from appointment service
feat(backend): publish realtime events from task, invoice, team services
chore(backend): update CORS to support production frontend URL
```
