import { EventEmitter } from "node:events";

// In-process developer event bus feeding GET /v1/developer/events (SSE).
//
// KNOWN LIMITATION (deliberate v1 scope): this is a per-process
// EventEmitter. In a multi-replica deployment each SSE connection only sees
// the events emitted by the replica it happens to be connected to - a
// partial stream. That is acceptable for the v1 "live tail while you
// develop" use case and is explicitly NOT a delivery guarantee; the durable,
// multi-replica change-notification surface is the webhooks design
// (docs/plans/developer-portal-webhooks.md), which replaces this bus when it
// ships. Emits happen AFTER the source of truth commits, are fire-and-forget,
// and must never add a failure mode to the emitting service.

export type DeveloperEventType =
  | "api_key.created"
  | "api_key.revoked"
  | "api_key.rotated"
  | "usage.threshold_crossed"
  | "export.completed"
  | "export.failed"
  | "sandbox.created"
  | "sandbox.deleted"
  | "template_pack.installed";

export type DeveloperEvent = {
  type: DeveloperEventType;
  // The organisation whose stream receives the event. SSE connections filter
  // on this - a key only ever sees its own org's events.
  organisationId: string;
  occurredAt: string;
  data: Record<string, unknown>;
};

// Single channel: every event flows through one listener slot so an SSE
// connection registers exactly one listener and filters by organisationId.
const CHANNEL = "developer-event";

const bus = new EventEmitter();
// One listener per SSE connection; the default 10-listener warning threshold
// is meaningless here (caps are enforced per-org at the endpoint instead).
bus.setMaxListeners(0);

export const emitDeveloperEvent = (
  type: DeveloperEventType,
  organisationId: string,
  data: Record<string, unknown> = {},
): void => {
  bus.emit(CHANNEL, {
    type,
    organisationId,
    occurredAt: new Date().toISOString(),
    data,
  } satisfies DeveloperEvent);
};

export const subscribeToDeveloperEvents = (
  listener: (event: DeveloperEvent) => void,
): (() => void) => {
  bus.on(CHANNEL, listener);
  return () => {
    bus.off(CHANNEL, listener);
  };
};
