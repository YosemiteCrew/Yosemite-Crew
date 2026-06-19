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
