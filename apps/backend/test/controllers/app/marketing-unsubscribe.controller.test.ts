const unsubscribeMarketingEmail = jest.fn();
const readMarketingUnsubscribeToken = jest.fn();
let InvalidTokenError: new () => Error;
let ConfigError: new () => Error;

jest.mock("../../../src/services/marketing-unsubscribe.service", () => {
  class InvalidMarketingUnsubscribeTokenError extends Error {}
  class MarketingUnsubscribeConfigError extends Error {}
  InvalidTokenError = InvalidMarketingUnsubscribeTokenError;
  ConfigError = MarketingUnsubscribeConfigError;
  return {
    unsubscribeMarketingEmail,
    readMarketingUnsubscribeToken,
    InvalidMarketingUnsubscribeTokenError,
    MarketingUnsubscribeConfigError,
  };
});

import type { Request, Response } from "express";
import { MarketingUnsubscribeController } from "../../../src/controllers/app/marketing-unsubscribe.controller";

type MockResponse = {
  status: jest.Mock;
  set: jest.Mock;
  json: jest.Mock;
  send: jest.Mock;
};

const response = () => {
  const res = {} as MockResponse;
  res.status = jest.fn(() => res);
  res.set = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  return res;
};

// The controller only touches the four methods stubbed above, so the mocks are
// cast at the call site rather than reconstructing all of Express's types.
const asRes = (r: MockResponse) => r as unknown as Response;
const asReq = (o: Record<string, unknown>) => o as unknown as Request;

describe("MarketingUnsubscribeController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readMarketingUnsubscribeToken.mockReturnValue("person@example.com");
    unsubscribeMarketingEmail.mockResolvedValue(undefined);
  });

  describe("GET (confirm)", () => {
    it("renders a confirmation and unsubscribes nobody", () => {
      // Mail providers and link scanners fetch every URL in a delivered message.
      // While GET performed the unsubscribe, delivery alone could set
      // UnsubscribeAll on the recipient's contact.
      const res = response();
      MarketingUnsubscribeController.confirm(
        asReq({ method: "GET", query: { token: "signed-token" } }),
        asRes(res),
      );

      expect(unsubscribeMarketingEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('<form method="POST">');
      expect(html).toContain("Unsubscribe from marketing emails?");
    });

    it("rejects a request without a token", () => {
      const res = response();
      MarketingUnsubscribeController.confirm(
        asReq({ method: "GET", query: {} }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(unsubscribeMarketingEmail).not.toHaveBeenCalled();
    });

    it("rejects an invalid signed token before the recipient clicks", () => {
      readMarketingUnsubscribeToken.mockImplementation(() => {
        throw new InvalidTokenError();
      });
      const res = response();
      MarketingUnsubscribeController.confirm(
        asReq({ method: "GET", query: { token: "bad-token" } }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe("POST (unsubscribe)", () => {
    it("unsubscribes from the form body and returns HTML to a browser", async () => {
      const res = response();
      await MarketingUnsubscribeController.unsubscribe(
        asReq({
          method: "POST",
          body: { token: "signed-token" },
          query: {},
          accepts: () => "html",
        }),
        asRes(res),
      );

      expect(unsubscribeMarketingEmail).toHaveBeenCalledWith("signed-token");
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining("unsubscribed"),
      );
    });

    it("supports one-click POST with the token in the query string", async () => {
      const res = response();
      await MarketingUnsubscribeController.unsubscribe(
        asReq({
          method: "POST",
          body: {},
          query: { token: "signed-token" },
          accepts: () => "json",
        }),
        asRes(res),
      );

      expect(unsubscribeMarketingEmail).toHaveBeenCalledWith("signed-token");
      expect(res.json).toHaveBeenCalledWith({
        message: "Successfully unsubscribed.",
      });
    });

    it("rejects an invalid signed token", async () => {
      unsubscribeMarketingEmail.mockRejectedValueOnce(new InvalidTokenError());
      const res = response();
      await MarketingUnsubscribeController.unsubscribe(
        asReq({
          method: "POST",
          body: { token: "bad-token" },
          query: {},
          accepts: () => "json",
        }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it.each([new ConfigError(), new Error("SES unavailable")])(
      "returns 500 when SES unsubscribe fails",
      async (error) => {
        unsubscribeMarketingEmail.mockRejectedValueOnce(error);
        const res = response();
        await MarketingUnsubscribeController.unsubscribe(
          asReq({
            method: "POST",
            body: { token: "signed-token" },
            query: {},
            accepts: () => "json",
          }),
          asRes(res),
        );
        expect(res.status).toHaveBeenCalledWith(500);
      },
    );
  });
});
