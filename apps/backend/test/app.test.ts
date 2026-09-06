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
import {
  EXPECTED_CONTROLS,
  getControlReports,
  hasFailedControl,
  resetControlsForTest,
} from "../src/config/startup-controls";

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

// #2750: a missing auth variable disabled the whole SuperTokens stack with no
// log line, no throw and no control report - so "somebody turned auth off" and
// "a deploy lost a variable" were the same observable process from outside.
describe("createApp reports the authentication control", () => {
  const authEnv = {
    SUPERTOKENS_CONNECTION_URI: "https://core.example.test",
    AUTH_API_DOMAIN: "https://api.example.test",
    AUTH_WEBSITE_DOMAIN: "https://web.example.test",
  };
  const envKeys = [
    "SUPERTOKENS_DISABLED",
    "SUPERTOKENS_CONNECTION_URI",
    "AUTH_API_DOMAIN",
    "AUTH_WEBSITE_DOMAIN",
  ];
  const saved: Record<string, string | undefined> = {};

  const authControl = () =>
    getControlReports().find((report) => report.name === "authentication");

  beforeEach(() => {
    jest.clearAllMocks();
    resetControlsForTest();
    for (const key of envKeys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    resetControlsForTest();
    for (const key of envKeys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it("records applied when the auth env is complete", () => {
    Object.assign(process.env, authEnv);

    createApp();

    expect(authControl()).toMatchObject({ state: "applied" });
    expect(authControl()).not.toHaveProperty("detail");
    expect(hasFailedControl()).toBe(false);
  });

  it("records skipped, not failed, when auth is deliberately turned off", () => {
    Object.assign(process.env, authEnv);
    process.env.SUPERTOKENS_DISABLED = "true";

    createApp();

    expect(authControl()).toMatchObject({
      state: "skipped",
      detail: "disabled by configuration",
    });
    // A kill switch somebody threw is a deployment fact, not an incident: if it
    // paged, people would learn to ignore this endpoint.
    expect(hasFailedControl()).toBe(false);
  });

  it("records failed when the auth env is incomplete", () => {
    Object.assign(process.env, authEnv);
    delete process.env.AUTH_WEBSITE_DOMAIN;

    createApp();

    expect(authControl()).toMatchObject({
      state: "failed",
      detail: "auth env incomplete",
    });
    expect(hasFailedControl()).toBe(true);
  });

  // The distinction the issue is about: the two unmounted boots must not read
  // the same. Both skip the SuperTokens wiring; only one of them is a fault.
  it("distinguishes the deliberate boot from the accidental one", () => {
    Object.assign(process.env, authEnv);
    process.env.SUPERTOKENS_DISABLED = "1";
    createApp();
    const deliberate = authControl()?.state;

    resetControlsForTest();
    jest.clearAllMocks();
    delete process.env.SUPERTOKENS_DISABLED;
    delete process.env.AUTH_API_DOMAIN;
    createApp();
    const accidental = authControl()?.state;

    expect(mockRegisterSuperTokensBeforeRoutes).not.toHaveBeenCalled();
    expect(deliberate).toBe("skipped");
    expect(accidental).toBe("failed");
    expect(deliberate).not.toBe(accidental);
  });

  // Precedence, and it is the case that could mask an accident: the kill switch
  // wins over an incomplete env, so a boot that is BOTH still reports the
  // deliberate state. That is the right way round - somebody asked for this
  // process - but it is worth pinning rather than leaving to the read order.
  it("reports skipped when auth is switched off and the env is incomplete too", () => {
    process.env.SUPERTOKENS_DISABLED = "true";

    createApp();

    expect(authControl()).toMatchObject({
      state: "skipped",
      detail: "disabled by configuration",
    });
    expect(hasFailedControl()).toBe(false);
  });

  // /health/controls is unauthenticated by design, so the detail must never say
  // which variable is missing - that is a map of the deployment to anyone.
  it("never names the missing variable in the reported detail", () => {
    Object.assign(process.env, authEnv);
    delete process.env.SUPERTOKENS_CONNECTION_URI;

    createApp();

    const detail = authControl()?.detail ?? "";
    for (const key of envKeys) {
      expect(detail).not.toContain(key);
    }
    expect(detail).toBe("auth env incomplete");
  });

  it("degrades /health/controls but not /health when auth did not mount", async () => {
    Object.assign(process.env, authEnv);
    delete process.env.AUTH_WEBSITE_DOMAIN;

    const app = createApp();

    const liveness = await request(app, { path: "/health" });
    const controls = await request(app, { path: "/health/controls" });
    const body = JSON.parse(controls.body) as {
      status: string;
      controls: Array<{ name: string; state: string; detail?: string }>;
      expected: string[];
    };

    // Liveness is unchanged on purpose: the process is up, the control is not.
    expect(liveness.statusCode).toBe(200);
    expect(controls.statusCode).toBe(503);
    expect(body.status).toBe("degraded");
    // Sent on the degraded response too: a reader comparing the two lists needs
    // it most exactly when something is wrong.
    expect(body.expected).toEqual([...EXPECTED_CONTROLS]);
    expect(body.controls).toContainEqual(
      expect.objectContaining({
        name: "authentication",
        state: "failed",
        detail: "auth env incomplete",
      }),
    );
  });

  it("keeps /health/controls green when auth mounted", async () => {
    Object.assign(process.env, authEnv);

    const app = createApp();

    const controls = await request(app, { path: "/health/controls" });
    const body = JSON.parse(controls.body) as {
      status: string;
      controls: Array<{ name: string; state: string }>;
      expected: string[];
    };

    expect(controls.statusCode).toBe(200);
    expect(body.status).toBe("ok");
    expect(body.controls).toContainEqual(
      expect.objectContaining({ name: "authentication", state: "applied" }),
    );
    expect(body.expected).toEqual([...EXPECTED_CONTROLS]);
  });

  // #2758: the deploy gate ships when a named control is absent, because a
  // rollback deploys a bundle that never recorded it. This key is what lets the
  // gate tell that apart from a bundle that should have recorded it and did
  // not - so its ABSENCE is the version marker, and it must not be conditional
  // on state, on configuration, or on anything else.
  it("declares the controls it registers on every boot, including an auth-less one", async () => {
    const app = createApp();

    const controls = await request(app, { path: "/health/controls" });
    const body = JSON.parse(controls.body) as { expected: string[] };

    expect(body.expected).toEqual([...EXPECTED_CONTROLS]);
    expect(body.expected).toContain("authentication");
  });
});
