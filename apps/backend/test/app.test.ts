import { IncomingMessage, ServerResponse } from "node:http";
import type { Socket } from "node:net";
import { PassThrough } from "node:stream";
import type { RequestHandler } from "express";

const mockRegisterRoutes = jest.fn();
const mockStripeWebhook = jest.fn();
const mockStripeConnectWebhook = jest.fn();
const mockDocumensoWebhook = jest.fn();
const mockFinanceWebhook = jest.fn();
const mockChatWebhook = jest.fn();
const mockInitSuperTokens = jest.fn();
const mockRegisterSuperTokensBeforeRoutes = jest.fn();
const mockRegisterSuperTokensErrorHandler = jest.fn();

jest.mock("@yosemite-crew/auth", () => ({
  initSuperTokens: mockInitSuperTokens,
  registerSuperTokensBeforeRoutes: mockRegisterSuperTokensBeforeRoutes,
  registerSuperTokensErrorHandler: mockRegisterSuperTokensErrorHandler,
}));

jest.mock("../src/routers", () => ({
  registerRoutes: mockRegisterRoutes,
}));

jest.mock("../src/controllers/web/stripe.controller", () => ({
  StripeController: {
    webhook: mockStripeWebhook,
    connectWebhook: mockStripeConnectWebhook,
  },
}));

jest.mock("../src/controllers/web/documenso.controller", () => ({
  DocumensoWebhookController: {
    handle: mockDocumensoWebhook,
  },
}));

jest.mock("../src/controllers/app/finance.controller", () => ({
  FinanceController: {
    webhook: mockFinanceWebhook,
  },
}));

jest.mock("../src/controllers/app/chatWebhook.controller", () => ({
  ChatWebhookController: {
    handleStreamEvent: mockChatWebhook,
  },
}));

const mockSetAuthService = jest.fn();
const mockValidateAuthConfig = jest.fn();

class MockAuthService {
  constructor(public readonly provider: unknown) {}
}

jest.mock("@yosemite-crew/auth", () => ({
  AuthService: MockAuthService,
  createAuthProvider: jest.fn(() => ({ name: "supertokens" })),
  readAuthConfig: jest.fn(() => ({ provider: "supertokens" })),
  initSuperTokens: mockInitSuperTokens,
  registerSuperTokensBeforeRoutes: mockRegisterSuperTokensBeforeRoutes,
  registerSuperTokensErrorHandler: mockRegisterSuperTokensErrorHandler,
  setAuthService: mockSetAuthService,
  validateAuthConfig: mockValidateAuthConfig,
}));

jest.mock("../src/config/auth-hooks", () => ({
  authHooks: { onUserCreated: jest.fn() },
}));

import { createApp } from "../src/app";

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: RequestHandler }>;
  };
  name?: string;
  handle?: RequestHandler & { name?: string };
};

const originalEnv = { ...process.env };

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  getHeader: (name: string) => string | undefined;
};

async function request(
  app: ReturnType<typeof createApp>,
  {
    method = "GET",
    path,
    headers = {},
  }: {
    method?: string;
    path: string;
    headers?: Record<string, string>;
  },
): Promise<MockResponse> {
  const socket = new PassThrough();
  (socket as PassThrough & { remoteAddress?: string }).remoteAddress =
    "127.0.0.1";
  const requestSocket = socket as unknown as Socket;

  const req = new IncomingMessage(requestSocket);
  req.method = method;
  req.url = path;
  req.headers = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  req.socket = requestSocket;
  req.connection = requestSocket;

  const res = new ServerResponse(req);
  res.assignSocket(requestSocket);

  const rawChunks: Buffer[] = [];
  socket.on("data", (chunk) => {
    rawChunks.push(Buffer.from(chunk));
  });

  await new Promise<void>((resolve) => {
    res.on("finish", resolve);
    (
      app as unknown as {
        handle: (request: IncomingMessage, response: ServerResponse) => void;
      }
    ).handle(req, res);
  });

  const raw = Buffer.concat(rawChunks).toString("utf8");
  const separator = "\r\n\r\n";
  const splitIndex = raw.indexOf(separator);
  const headerText = splitIndex >= 0 ? raw.slice(0, splitIndex) : raw;
  const body = splitIndex >= 0 ? raw.slice(splitIndex + separator.length) : "";
  const headerLines = headerText.split("\r\n");
  const headersMap: Record<string, string> = {};

  for (const line of headerLines.slice(1)) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) continue;
    const name = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headersMap[name] = value;
  }

  return {
    statusCode: res.statusCode,
    headers: headersMap,
    body,
    getHeader: (name: string) => headersMap[name.toLowerCase()],
  };
}

describe("createApp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SUPERTOKENS_DISABLED;
    delete process.env.SUPERTOKENS_CONNECTION_URI;
    delete process.env.AUTH_API_DOMAIN;
    delete process.env.AUTH_WEBSITE_DOMAIN;
    delete process.env.LOCAL_DEVELOPMENT;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("registers the finance webhook before json parsing", () => {
    const app = createApp();
    const stack = ((app as unknown as { _router: { stack: Layer[] } })._router
      .stack ?? []) as Layer[];

    const financeWebhookIndex = stack.findIndex(
      (layer) => layer.route?.path === "/v1/finance/webhooks/:provider",
    );
    const jsonParserIndex = stack.findIndex(
      (layer) =>
        layer.name === "jsonParser" || layer.handle?.name === "jsonParser",
    );

    expect(mockRegisterRoutes).toHaveBeenCalledTimes(1);
    expect(financeWebhookIndex).toBeGreaterThanOrEqual(0);
    expect(jsonParserIndex).toBeGreaterThanOrEqual(0);
    expect(financeWebhookIndex).toBeLessThan(jsonParserIndex);
  });

  it("registers core middleware and emits security headers on health responses", async () => {
    const app = createApp();

    const response = await request(app, { path: "/health" });
    const body = JSON.parse(response.body) as { status: string };

    expect(body).toEqual({ status: "ok" });
    expect(response.statusCode).toBe(200);
    expect(response.getHeader("x-powered-by")).toBeUndefined();
    expect(response.getHeader("x-content-type-options")).toBe("nosniff");
    expect(response.getHeader("x-frame-options")).toBe("SAMEORIGIN");
    expect(response.getHeader("ratelimit-limit")).toBe("500");
    // API responses are tenant-scoped and served from stable URLs, so nothing
    // between the server and the user may store them: a shared browser or an
    // intermediary cache would otherwise hand one user's invoices or records to
    // the next.
    expect(response.getHeader("cache-control")).toBe("no-store");
    expect(mockRegisterRoutes).toHaveBeenCalledWith(app);
    expect(mockInitSuperTokens).not.toHaveBeenCalled();
    expect(mockRegisterSuperTokensBeforeRoutes).not.toHaveBeenCalled();
    expect(mockRegisterSuperTokensErrorHandler).not.toHaveBeenCalled();
  });

  it("registers SuperTokens middleware only when all auth domains are configured", () => {
    process.env.SUPERTOKENS_CONNECTION_URI = "https://auth.example.test";
    process.env.AUTH_API_DOMAIN = "https://api.example.test";
    process.env.AUTH_WEBSITE_DOMAIN = "https://app.example.test";

    const app = createApp();

    expect(mockInitSuperTokens).toHaveBeenCalledTimes(1);
    expect(mockRegisterSuperTokensBeforeRoutes).toHaveBeenCalledWith(app);
    expect(mockRegisterSuperTokensErrorHandler).toHaveBeenCalledWith(app);
  });

  it("does not register SuperTokens when explicitly disabled", () => {
    process.env.SUPERTOKENS_DISABLED = "1";
    process.env.SUPERTOKENS_CONNECTION_URI = "https://auth.example.test";
    process.env.AUTH_API_DOMAIN = "https://api.example.test";
    process.env.AUTH_WEBSITE_DOMAIN = "https://app.example.test";

    createApp();

    expect(mockInitSuperTokens).not.toHaveBeenCalled();
    expect(mockRegisterSuperTokensBeforeRoutes).not.toHaveBeenCalled();
    expect(mockRegisterSuperTokensErrorHandler).not.toHaveBeenCalled();
  });

  it("allows configured local-development origins through CORS", async () => {
    process.env.LOCAL_DEVELOPMENT = "true";

    const app = createApp();

    const response = await request(app, {
      path: "/health",
      headers: {
        Origin: "http://localhost:3000",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.getHeader("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    expect(response.getHeader("access-control-allow-credentials")).toBe("true");
  });
});

describe("createApp auth wiring", () => {
  const authEnv = {
    SUPERTOKENS_CONNECTION_URI: "https://core.example.test",
    AUTH_API_DOMAIN: "https://api.example.test",
    AUTH_WEBSITE_DOMAIN: "https://web.example.test",
  };
  const saved: Record<string, string | undefined> = {};
  const envKeys = [
    "SUPERTOKENS_DISABLED",
    "SUPERTOKENS_CONNECTION_URI",
    "AUTH_API_DOMAIN",
    "AUTH_WEBSITE_DOMAIN",
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    for (const k of envKeys) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of envKeys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("validates config and registers the provider when the env is present", () => {
    Object.assign(process.env, authEnv);

    createApp();

    expect(mockValidateAuthConfig).toHaveBeenCalledTimes(1);
    expect(mockInitSuperTokens).toHaveBeenCalledTimes(1);
    expect(mockSetAuthService.mock.calls[0][0]).toBeInstanceOf(MockAuthService);
    expect(mockRegisterSuperTokensBeforeRoutes).toHaveBeenCalledTimes(1);
    expect(mockRegisterSuperTokensErrorHandler).toHaveBeenCalledTimes(1);
  });

  it("clears the auth service and skips wiring when the env is absent", () => {
    createApp();

    expect(mockInitSuperTokens).not.toHaveBeenCalled();
    expect(mockSetAuthService).toHaveBeenCalledWith(null);
    expect(mockRegisterSuperTokensBeforeRoutes).not.toHaveBeenCalled();
  });

  it("honors SUPERTOKENS_DISABLED as a kill switch even with full env", () => {
    Object.assign(process.env, authEnv);
    process.env.SUPERTOKENS_DISABLED = "1";

    createApp();

    expect(mockInitSuperTokens).not.toHaveBeenCalled();
    expect(mockSetAuthService).toHaveBeenCalledWith(null);
  });
});
