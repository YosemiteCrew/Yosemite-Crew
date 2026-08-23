const unsubscribeFromCareReminders = jest.fn();
const readCareReminderOptOutToken = jest.fn();
let InvalidTokenError: new () => Error;
let ConfigError: new (m: string) => Error;

jest.mock("src/services/care-reminder-opt-out.service", () => {
  class InvalidCareReminderOptOutTokenError extends Error {}
  class CareReminderOptOutConfigError extends Error {}
  InvalidTokenError = InvalidCareReminderOptOutTokenError;
  ConfigError = CareReminderOptOutConfigError;
  return {
    unsubscribeFromCareReminders,
    readCareReminderOptOutToken,
    InvalidCareReminderOptOutTokenError,
    CareReminderOptOutConfigError,
  };
});

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

import type { Request, Response } from "express";
import { CareReminderOptOutController } from "src/controllers/app/care-reminder-opt-out.controller";

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

describe("CareReminderOptOutController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    readCareReminderOptOutToken.mockReturnValue({
      organisationId: "org-1",
      email: "person@example.com",
    });
    unsubscribeFromCareReminders.mockResolvedValue({
      organisationId: "org-1",
      email: "person@example.com",
    });
  });

  describe("GET (confirm)", () => {
    it("renders a confirmation and records nothing", async () => {
      // The whole point of the split: mail providers and link scanners fetch
      // every URL in a delivered message, so a mutating GET would let delivery
      // alone unsubscribe the recipient.
      const res = response();
      await CareReminderOptOutController.confirm(
        asReq({ method: "GET", query: { token: "tok" } }),
        asRes(res),
      );

      expect(unsubscribeFromCareReminders).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      const html = res.send.mock.calls[0][0] as string;
      expect(html).toContain('<form method="POST">');
      expect(html).toContain("Stop receiving care reminders?");
    });

    it("validates the token so a broken link fails before the click", async () => {
      readCareReminderOptOutToken.mockImplementation(() => {
        throw new InvalidTokenError();
      });
      const res = response();
      await CareReminderOptOutController.confirm(
        asReq({ method: "GET", query: { token: "bad" } }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("rejects a missing token", async () => {
      const res = response();
      await CareReminderOptOutController.confirm(
        asReq({ method: "GET", query: {} }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(400);
      expect(unsubscribeFromCareReminders).not.toHaveBeenCalled();
    });
  });

  describe("POST (unsubscribe)", () => {
    it("records the opt-out from the form body and returns HTML to a browser", async () => {
      const res = response();
      await CareReminderOptOutController.unsubscribe(
        asReq({
          method: "POST",
          body: { token: "tok" },
          query: {},
          accepts: () => "html",
        }),
        asRes(res),
      );

      expect(unsubscribeFromCareReminders).toHaveBeenCalledWith("tok");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.send.mock.calls[0][0]).toContain("You have been unsubscribed");
    });

    it("accepts the token from the query string for a direct API call", async () => {
      const res = response();
      await CareReminderOptOutController.unsubscribe(
        asReq({
          method: "POST",
          body: {},
          query: { token: "tok" },
          accepts: () => "json",
        }),
        asRes(res),
      );

      expect(unsubscribeFromCareReminders).toHaveBeenCalledWith("tok");
      expect(res.json).toHaveBeenCalledWith({
        message: "Successfully unsubscribed.",
      });
    });

    it("returns 400 for an invalid token", async () => {
      unsubscribeFromCareReminders.mockRejectedValue(new InvalidTokenError());
      const res = response();
      await CareReminderOptOutController.unsubscribe(
        asReq({
          method: "POST",
          body: { token: "bad" },
          query: {},
          accepts: () => "json",
        }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it("returns 500 for a server misconfiguration rather than blaming the link", async () => {
      unsubscribeFromCareReminders.mockRejectedValue(new ConfigError("nope"));
      const res = response();
      await CareReminderOptOutController.unsubscribe(
        asReq({
          method: "POST",
          body: { token: "tok" },
          query: {},
          accepts: () => "json",
        }),
        asRes(res),
      );
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
});
