import type { Request, Response } from "express";
import type { OrgRequest } from "src/middlewares/rbac";
import {
  subscribeToDeveloperEvents,
  type DeveloperEvent,
} from "src/utils/developer-events";
import logger from "src/utils/logger";

// GET /v1/developer/events - Server-Sent Events stream of developer platform
// events (api_key.*, usage.threshold_crossed, export.*, sandbox.*,
// template_pack.installed), scoped to the verified key's organisation ONLY.
//
// This is the backend's first SSE endpoint, so everything SSE-specific is
// self-contained here. Auth is authorizeApiKeyVerifyOnly: the key is verified
// once at connect and the connection consumes NO monthly quota - a long-lived
// stream must not be billed per event, and metering the connect would let a
// dead stream eat quota (same carve-out as /v1/developer/usage).
//
// Delivery model matches the bus (src/utils/developer-events.ts): in-process
// only, best-effort, replaced by webhooks for durable delivery.

const HEARTBEAT_INTERVAL_MS = 25_000;
export const MAX_CONNECTIONS_PER_ORG = 5;

// Per-process connection accounting (the bus is per-process too).
const connectionsByOrg = new Map<string, number>();

const getOrgId = (req: Request): string | undefined =>
  (req as OrgRequest).organisationId;

const writeEvent = (res: Response, event: DeveloperEvent): void => {
  res.write(
    `event: ${event.type}\ndata: ${JSON.stringify({
      organisationId: event.organisationId,
      occurredAt: event.occurredAt,
      data: event.data,
    })}\n\n`,
  );
};

export const DeveloperEventsController = {
  stream: (req: Request, res: Response): void => {
    const organisationId = getOrgId(req);
    if (!organisationId) {
      res.status(400).json({
        message: "Missing organisation context",
        code: "invalid_request",
      });
      return;
    }

    const active = connectionsByOrg.get(organisationId) ?? 0;
    if (active >= MAX_CONNECTIONS_PER_ORG) {
      res.status(503).json({
        message: "Too many concurrent event streams for this organisation",
        code: "stream_limit",
      });
      return;
    }
    connectionsByOrg.set(organisationId, active + 1);

    res.status(200);
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    // Nginx and friends must not buffer the stream.
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();
    // Opening comment confirms the stream to the client immediately.
    res.write(": connected\n\n");

    // Heartbeat comments keep intermediaries from idling the connection out.
    const heartbeat = setInterval(() => {
      res.write(": keep-alive\n\n");
    }, HEARTBEAT_INTERVAL_MS);

    // One listener per connection; events for other orgs are dropped here so
    // a key only ever sees its own org's stream.
    const unsubscribe = subscribeToDeveloperEvents((event) => {
      if (event.organisationId !== organisationId) {
        return;
      }
      try {
        writeEvent(res, event);
      } catch (error) {
        logger.error("DeveloperEvents write failed", { error });
      }
    });

    let closed = false;
    const teardown = (): void => {
      if (closed) {
        return;
      }
      closed = true;
      clearInterval(heartbeat);
      unsubscribe();
      const current = connectionsByOrg.get(organisationId) ?? 1;
      if (current <= 1) {
        connectionsByOrg.delete(organisationId);
      } else {
        connectionsByOrg.set(organisationId, current - 1);
      }
      res.end();
    };

    req.on("close", teardown);
    res.on("close", teardown);
  },
};

// Test-only escape hatch: connection counts are per-process module state.
export const resetDeveloperEventConnections = (): void => {
  connectionsByOrg.clear();
};
