const unsubscribeMarketingEmail = jest.fn();
let InvalidTokenError: new () => Error;
let ConfigError: new () => Error;

jest.mock("../../../src/services/marketing-unsubscribe.service", () => {
  class InvalidMarketingUnsubscribeTokenError extends Error {}
  class MarketingUnsubscribeConfigError extends Error {}
  InvalidTokenError = InvalidMarketingUnsubscribeTokenError;
  ConfigError = MarketingUnsubscribeConfigError;
  return {
    unsubscribeMarketingEmail,
    InvalidMarketingUnsubscribeTokenError,
    MarketingUnsubscribeConfigError,
  };
});

import { MarketingUnsubscribeController } from "../../../src/controllers/app/marketing-unsubscribe.controller";

const response = () => {
  const res: any = {};
  res.status = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

describe("MarketingUnsubscribeController", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns an HTML confirmation for email links", async () => {
    const res = response();
    await MarketingUnsubscribeController.unsubscribe(
      { method: "GET", query: { token: "signed-token" } } as any,
      res,
    );

    expect(unsubscribeMarketingEmail).toHaveBeenCalledWith("signed-token");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("unsubscribed"),
    );
  });

  it("supports one-click POST requests", async () => {
    const res = response();
    await MarketingUnsubscribeController.unsubscribe(
      { method: "POST", query: { token: "signed-token" } } as any,
      res,
    );

    expect(res.json).toHaveBeenCalledWith({
      message: "Successfully unsubscribed.",
    });
  });

  it("rejects requests without a token", async () => {
    const res = response();
    await MarketingUnsubscribeController.unsubscribe(
      { method: "GET", query: {} } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("rejects an invalid signed token", async () => {
    unsubscribeMarketingEmail.mockRejectedValueOnce(new InvalidTokenError());
    const res = response();

    await MarketingUnsubscribeController.unsubscribe(
      { method: "GET", query: { token: "bad-token" } } as any,
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it.each([new ConfigError(), new Error("SES unavailable")])(
    "returns 500 when SES unsubscribe fails",
    async (error) => {
      unsubscribeMarketingEmail.mockRejectedValueOnce(error);
      const res = response();

      await MarketingUnsubscribeController.unsubscribe(
        { method: "POST", query: { token: "signed-token" } } as any,
        res,
      );

      expect(res.status).toHaveBeenCalledWith(500);
    },
  );
});
