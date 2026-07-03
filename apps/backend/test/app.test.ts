import type { RequestHandler } from "express";

const mockRegisterRoutes = jest.fn();
const mockStripeWebhook = jest.fn();
const mockDocumensoWebhook = jest.fn();
const mockFinanceWebhook = jest.fn();

jest.mock("../src/routers", () => ({
  registerRoutes: mockRegisterRoutes,
}));

jest.mock("../src/controllers/web/stripe.controller", () => ({
  StripeController: {
    webhook: mockStripeWebhook,
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

const mockInitSuperTokens = jest.fn();
const mockRegisterBeforeRoutes = jest.fn();
const mockRegisterErrorHandler = jest.fn();
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
  registerSuperTokensBeforeRoutes: mockRegisterBeforeRoutes,
  registerSuperTokensErrorHandler: mockRegisterErrorHandler,
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

describe("createApp", () => {
  const originalSuperTokensDisabled = process.env.SUPERTOKENS_DISABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.SUPERTOKENS_DISABLED = "1";
  });

  afterAll(() => {
    process.env.SUPERTOKENS_DISABLED = originalSuperTokensDisabled;
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
    expect(mockRegisterBeforeRoutes).toHaveBeenCalledTimes(1);
    expect(mockRegisterErrorHandler).toHaveBeenCalledTimes(1);
  });

  it("clears the auth service and skips wiring when the env is absent", () => {
    createApp();

    expect(mockInitSuperTokens).not.toHaveBeenCalled();
    expect(mockSetAuthService).toHaveBeenCalledWith(null);
    expect(mockRegisterBeforeRoutes).not.toHaveBeenCalled();
  });

  it("honors SUPERTOKENS_DISABLED as a kill switch even with full env", () => {
    Object.assign(process.env, authEnv);
    process.env.SUPERTOKENS_DISABLED = "1";

    createApp();

    expect(mockInitSuperTokens).not.toHaveBeenCalled();
    expect(mockSetAuthService).toHaveBeenCalledWith(null);
  });
});
