import { EventEmitter } from "node:events";
import type { Request, Response } from "express";
import {
  DeveloperEventsController,
  MAX_CONNECTIONS_PER_ORG,
  resetDeveloperEventConnections,
} from "../../src/controllers/web/developer-events.controller";
import { emitDeveloperEvent } from "../../src/utils/developer-events";

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

type MockRes = Response & {
  status: jest.Mock;
  setHeader: jest.Mock;
  flushHeaders: jest.Mock;
  write: jest.Mock;
  json: jest.Mock;
  end: jest.Mock;
};

const buildReq = (organisationId?: string): Request => {
  const req = new EventEmitter() as unknown as Request;
  (req as unknown as { organisationId?: string }).organisationId =
    organisationId;
  return req;
};

const buildRes = (): MockRes => {
  const res = new EventEmitter() as unknown as MockRes;
  res.status = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn();
  res.flushHeaders = jest.fn();
  res.write = jest.fn();
  res.json = jest.fn().mockReturnValue(res);
  res.end = jest.fn();
  return res;
};

const openStream = (orgId: string): { req: Request; res: MockRes } => {
  const req = buildReq(orgId);
  const res = buildRes();
  DeveloperEventsController.stream(req, res);
  return { req, res };
};

describe("DeveloperEventsController.stream", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    resetDeveloperEventConnections();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it("400s without organisation context", () => {
    const res = buildRes();
    DeveloperEventsController.stream(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "invalid_request" }),
    );
  });

  it("sets SSE headers and writes the connected comment", () => {
    const { req, res } = openStream("org-1");
    expect(res.setHeader).toHaveBeenCalledWith(
      "Content-Type",
      "text/event-stream",
    );
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");
    expect(res.flushHeaders).toHaveBeenCalled();
    expect(res.write).toHaveBeenCalledWith(": connected\n\n");
    req.emit("close");
  });

  it("streams events for the connection's org only", () => {
    const { req, res } = openStream("org-1");
    res.write.mockClear();

    emitDeveloperEvent("api_key.created", "org-1", { keyId: "key-1" });
    emitDeveloperEvent("api_key.created", "org-OTHER", { keyId: "key-2" });

    expect(res.write).toHaveBeenCalledTimes(1);
    const frame = res.write.mock.calls[0][0] as string;
    expect(frame).toContain("event: api_key.created\n");
    expect(frame).toContain('"organisationId":"org-1"');
    expect(frame).not.toContain("key-2");
    req.emit("close");
  });

  it("sends heartbeat comments on the interval", () => {
    const { req, res } = openStream("org-1");
    res.write.mockClear();

    jest.advanceTimersByTime(25_000);
    expect(res.write).toHaveBeenCalledWith(": keep-alive\n\n");
    req.emit("close");
  });

  it("caps concurrent connections per org at the limit with 503 stream_limit", () => {
    const streams = Array.from({ length: MAX_CONNECTIONS_PER_ORG }, () =>
      openStream("org-cap"),
    );
    const res = buildRes();
    DeveloperEventsController.stream(buildReq("org-cap"), res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "stream_limit" }),
    );
    for (const stream of streams) {
      stream.req.emit("close");
    }
  });

  it("does not count other orgs toward the cap", () => {
    const streams = Array.from({ length: MAX_CONNECTIONS_PER_ORG }, () =>
      openStream("org-a"),
    );
    const { res } = openStream("org-b");
    expect(res.status).toHaveBeenCalledWith(200);
    for (const stream of streams) {
      stream.req.emit("close");
    }
  });

  it("tears down on close: stops heartbeats, unsubscribes, frees the slot", () => {
    const { req, res } = openStream("org-td");
    req.emit("close");

    expect(res.end).toHaveBeenCalledTimes(1);
    res.write.mockClear();
    jest.advanceTimersByTime(60_000);
    emitDeveloperEvent("export.completed", "org-td", { exportJobId: "j1" });
    expect(res.write).not.toHaveBeenCalled();

    // The freed slot admits a new connection.
    const reopened = openStream("org-td");
    expect(reopened.res.status).toHaveBeenCalledWith(200);
    reopened.req.emit("close");
  });

  it("teardown is idempotent across req and res close", () => {
    const { req, res } = openStream("org-dup");
    req.emit("close");
    res.emit("close");
    expect(res.end).toHaveBeenCalledTimes(1);
  });
});
