import { Server } from "node:http";
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

async function listen(app: ReturnType<typeof createApp>): Promise<Server> {
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve(server));
  });
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

function serverUrl(server: Server): string {
  const address = server.address();

  if (!address || typeof address === "string") {
    throw new Error("Expected server to listen on a TCP port");
  }

  return `http://127.0.0.1:${address.port}`;
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
    const server = await listen(app);

    try {
      const response = await fetch(`${serverUrl(server)}/health`);
      const body = await response.json();

      expect(body).toEqual({ status: "ok" });
      expect(response.status).toBe(200);
      expect(response.headers.get("x-powered-by")).toBeNull();
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("x-frame-options")).toBe("SAMEORIGIN");
      expect(response.headers.get("ratelimit-limit")).toBe("500");
      expect(mockRegisterRoutes).toHaveBeenCalledWith(app);
      expect(mockInitSuperTokens).not.toHaveBeenCalled();
      expect(mockRegisterSuperTokensBeforeRoutes).not.toHaveBeenCalled();
      expect(mockRegisterSuperTokensErrorHandler).not.toHaveBeenCalled();
    } finally {
      await close(server);
    }
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
    const server = await listen(app);

    try {
      const response = await fetch(`${serverUrl(server)}/health`, {
        headers: {
          Origin: "http://localhost:3000",
        },
      });

      expect(response.status).toBe(200);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:3000",
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    } finally {
      await close(server);
    }
  });
});
