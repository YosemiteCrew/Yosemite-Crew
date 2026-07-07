import type { Request, Response } from "express";

const transportInstances: Array<{
  options: Record<string, unknown>;
  handleRequest: jest.Mock;
  close: jest.Mock;
}> = [];

jest.mock("@modelcontextprotocol/sdk/server/streamableHttp.js", () => ({
  StreamableHTTPServerTransport: class {
    options: Record<string, unknown>;
    handleRequest = jest.fn().mockResolvedValue(undefined);
    close = jest.fn().mockResolvedValue(undefined);
    constructor(options: Record<string, unknown>) {
      this.options = options;
      transportInstances.push(
        this as unknown as (typeof transportInstances)[number],
      );
    }
  },
}));

const builtServer = {
  connect: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock("src/services/developer-mcp.service", () => ({
  DeveloperMcpService: { buildServer: jest.fn(() => builtServer) },
}));

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

import { DeveloperMcpController } from "../../src/controllers/web/developer-mcp.controller";
import { DeveloperMcpService } from "../../src/services/developer-mcp.service";

const mockBuildServer = DeveloperMcpService.buildServer as jest.Mock;

type CloseListener = () => void;

const buildRes = () => {
  const listeners: Record<string, CloseListener> = {};
  const res: Record<string, unknown> = {
    status: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    headersSent: false,
  };
  res.on = jest.fn((event: string, listener: CloseListener) => {
    listeners[event] = listener;
    return res;
  });
  return { res: res as unknown as Response, listeners };
};

const buildReq = (apiKey?: unknown): Request =>
  ({
    body: { jsonrpc: "2.0", method: "tools/list", id: 1 },
    apiKey,
  }) as unknown as Request;

describe("DeveloperMcpController.handlePost", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transportInstances.length = 0;
  });

  it("builds a per-request stateless transport bound to the key's org and scopes", async () => {
    const req = buildReq({
      id: "key-1",
      organisationId: "org-1",
      scopes: ["appointments:read"],
      environment: "live",
    });
    const { res } = buildRes();

    await DeveloperMcpController.handlePost(req, res);

    expect(mockBuildServer).toHaveBeenCalledWith({
      organisationId: "org-1",
      scopes: ["appointments:read"],
    });
    expect(transportInstances).toHaveLength(1);
    // Stateless mode: no session id generator, plain JSON responses.
    expect(transportInstances[0].options).toEqual({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    expect(builtServer.connect).toHaveBeenCalledWith(transportInstances[0]);
    expect(transportInstances[0].handleRequest).toHaveBeenCalledWith(
      req,
      res,
      req.body,
    );
  });

  it("tears the transport and server down when the response closes", async () => {
    const req = buildReq({
      id: "key-1",
      organisationId: "org-1",
      scopes: [],
      environment: "live",
    });
    const { res, listeners } = buildRes();

    await DeveloperMcpController.handlePost(req, res);
    listeners.close();

    expect(transportInstances[0].close).toHaveBeenCalled();
    expect(builtServer.close).toHaveBeenCalled();
  });

  it("rejects a JSON-RPC batch array before it reaches the transport (quota bypass)", async () => {
    const req = {
      body: [
        { jsonrpc: "2.0", method: "tools/call", id: 1 },
        { jsonrpc: "2.0", method: "tools/call", id: 2 },
      ],
      apiKey: {
        id: "key-1",
        organisationId: "org-1",
        scopes: ["appointments:read"],
        environment: "live",
      },
    } as unknown as Request;
    const { res } = buildRes();

    await DeveloperMcpController.handlePost(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      error: {
        code: -32600,
        message: "JSON-RPC batch requests are not supported.",
      },
      id: null,
    });
    expect(mockBuildServer).not.toHaveBeenCalled();
    expect(transportInstances).toHaveLength(0);
  });

  it("500s without touching MCP when the auth middleware did not run", async () => {
    const req = buildReq(undefined);
    const { res } = buildRes();

    await DeveloperMcpController.handlePost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
      code: "internal_error",
    });
    expect(mockBuildServer).not.toHaveBeenCalled();
  });

  it("500s with the error envelope when the transport fails before headers", async () => {
    builtServer.connect.mockRejectedValueOnce(new Error("boom"));
    const req = buildReq({
      id: "key-1",
      organisationId: "org-1",
      scopes: [],
      environment: "live",
    });
    const { res } = buildRes();

    await DeveloperMcpController.handlePost(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Internal server error",
      code: "internal_error",
    });
  });

  it("does not double-respond when the failure happens after headers were sent", async () => {
    builtServer.connect.mockRejectedValueOnce(new Error("boom"));
    const req = buildReq({
      id: "key-1",
      organisationId: "org-1",
      scopes: [],
      environment: "live",
    });
    const { res } = buildRes();
    (res as unknown as { headersSent: boolean }).headersSent = true;

    await DeveloperMcpController.handlePost(req, res);

    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("DeveloperMcpController.methodNotAllowed", () => {
  it("returns the stateless-mode 405 JSON-RPC error with an Allow header", () => {
    const { res } = buildRes();

    DeveloperMcpController.methodNotAllowed({} as Request, res);

    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.set).toHaveBeenCalledWith("Allow", "POST");
    expect(res.json).toHaveBeenCalledWith({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });
});
