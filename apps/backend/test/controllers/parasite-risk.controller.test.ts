jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: { getByProviderUserId: jest.fn() },
}));

jest.mock("../../src/services/parasite-risk.service", () => ({
  getCellRisk: jest.fn(),
  listSubscriptions: jest.fn(),
  upsertSubscription: jest.fn(),
  deleteSubscription: jest.fn(),
  ParasiteRiskServiceError: class ParasiteRiskServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
    }
  },
}));

import type { Request, Response } from "express";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { ParasiteRiskController } from "../../src/controllers/app/parasite-risk.controller";
import {
  deleteSubscription,
  getCellRisk,
  listSubscriptions,
  upsertSubscription,
} from "../../src/services/parasite-risk.service";

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// `userId` is what the session middleware stamps on the request: the auth
// provider's user id, not the AuthUserMobile row id and not the parent id.
const request = (overrides: Partial<Request> = {}) =>
  ({
    query: {},
    body: {},
    params: {},
    userId: "provider-user-1",
    ...overrides,
  }) as unknown as Request;

const mockAuthUser = (parentId: string | null) =>
  (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
    id: "auth-user-1",
    parentId,
  });

const mockNoAuthUser = () =>
  (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue(
    null,
  );

describe("ParasiteRiskController.getRiskForCell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getCellRisk as jest.Mock).mockResolvedValue({ overallTier: "HIGH" });
  });

  it("parses coordinates from the query string", async () => {
    const res = mockResponse();

    await ParasiteRiskController.getRiskForCell(
      request({ query: { lat: "-27.375", lon: "153.125", countryCode: "au" } }),
      res,
    );

    expect(getCellRisk).toHaveBeenCalledWith(-27.375, 153.125, "AU");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("works without a country code, for the current-location path", async () => {
    const res = mockResponse();

    await ParasiteRiskController.getRiskForCell(
      request({ query: { lat: "41.875", lon: "12.375" } }),
      res,
    );

    expect(getCellRisk).toHaveBeenCalledWith(41.875, 12.375, null);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("rejects missing or out-of-range coordinates", async () => {
    for (const query of [
      {},
      { lat: "abc", lon: "10" },
      { lat: "120", lon: "10" },
      { lat: "10", lon: "250" },
    ]) {
      const res = mockResponse();
      await ParasiteRiskController.getRiskForCell(request({ query }), res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  });

  it("passes a service error's status code through", async () => {
    const { ParasiteRiskServiceError } = jest.requireMock(
      "../../src/services/parasite-risk.service",
    ) as {
      ParasiteRiskServiceError: new (m: string, s?: number) => Error;
    };
    (getCellRisk as jest.Mock).mockRejectedValue(
      new ParasiteRiskServiceError("not published here", 404),
    );

    const res = mockResponse();
    await ParasiteRiskController.getRiskForCell(
      request({ query: { lat: "0", lon: "-30" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("ParasiteRiskController.createSubscription", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser("parent-1");
    (upsertSubscription as jest.Mock).mockResolvedValue({ id: "sub-1" });
  });

  it("resolves the parent through the caller's mobile auth user", async () => {
    // The session id is not stored on Parent.linkedUserId (that holds the
    // AuthUserMobile row id), so the parent has to be reached through the
    // AuthUserMobile record keyed by provider user id.
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: { lat: 0, lon: 0, label: "Somewhere" } }),
      res,
    );

    expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
      "provider-user-1",
    );
    expect(upsertSubscription).toHaveBeenCalledWith(
      "parent-1",
      expect.anything(),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("accepts numeric coordinates from a JSON body", async () => {
    // JSON bodies deliver numbers, not strings; a string-only parser would
    // have rejected every valid request here.
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({
        body: {
          lat: -27.375,
          lon: 153.125,
          label: "Brisbane",
          countryCode: "AU",
        },
      }),
      res,
    );

    expect(upsertSubscription).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({
        lat: -27.375,
        lon: 153.125,
        label: "Brisbane",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("still accepts string coordinates", async () => {
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({
        body: {
          lat: "41.875",
          lon: "12.375",
          label: "Rome",
          countryCode: "IT",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects an unrecognised alert tier", async () => {
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({
        body: {
          lat: 0,
          lon: 0,
          label: "Somewhere",
          alertTier: "CATASTROPHIC",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("rejects a null body", async () => {
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: null }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(upsertSubscription).not.toHaveBeenCalled();
  });

  it("rejects a body with no coordinates", async () => {
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: { label: "Nowhere" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("requires a parent record for the signed-in user", async () => {
    mockAuthUser(null);
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: { lat: 0, lon: 0, label: "Somewhere" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("requires a mobile auth user for the signed-in session", async () => {
    mockNoAuthUser();
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: { lat: 0, lon: 0, label: "Somewhere" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("passes the followed-location cap through as a 409", async () => {
    const { ParasiteRiskServiceError } = jest.requireMock(
      "../../src/services/parasite-risk.service",
    ) as {
      ParasiteRiskServiceError: new (m: string, s?: number) => Error;
    };
    (upsertSubscription as jest.Mock).mockRejectedValue(
      new ParasiteRiskServiceError("You can follow at most 5 locations", 409),
    );
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: { lat: 0, lon: 0, label: "Somewhere" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("ParasiteRiskController subscription list and delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthUser("parent-1");
  });

  it("returns the parent's followed locations", async () => {
    (listSubscriptions as jest.Mock).mockResolvedValue([{ id: "sub-1" }]);
    const res = mockResponse();

    await ParasiteRiskController.listSubscriptions(request(), res);

    expect(listSubscriptions).toHaveBeenCalledWith("parent-1");
    expect(res.json).toHaveBeenCalledWith([{ id: "sub-1" }]);
  });

  it("rejects an unauthenticated list request", async () => {
    mockNoAuthUser();
    const res = mockResponse();

    await ParasiteRiskController.listSubscriptions(request(), res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns no content after a successful delete", async () => {
    (deleteSubscription as jest.Mock).mockResolvedValue(undefined);
    const res = mockResponse();

    await ParasiteRiskController.deleteSubscription(
      request({ params: { subscriptionId: "sub-1" } }),
      res,
    );

    expect(deleteSubscription).toHaveBeenCalledWith("parent-1", "sub-1");
    expect(res.status).toHaveBeenCalledWith(204);
  });

  it("passes an unknown location through as a 404", async () => {
    const { ParasiteRiskServiceError } = jest.requireMock(
      "../../src/services/parasite-risk.service",
    ) as {
      ParasiteRiskServiceError: new (m: string, s?: number) => Error;
    };
    (deleteSubscription as jest.Mock).mockRejectedValue(
      new ParasiteRiskServiceError("Location not found", 404),
    );
    const res = mockResponse();

    await ParasiteRiskController.deleteSubscription(
      request({ params: { subscriptionId: "sub-9" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("rejects an unauthenticated delete request", async () => {
    mockNoAuthUser();
    const res = mockResponse();

    await ParasiteRiskController.deleteSubscription(
      request({ params: { subscriptionId: "sub-1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("surfaces a 500 for an unexpected failure", async () => {
    (listSubscriptions as jest.Mock).mockRejectedValue(new Error("boom"));
    const res = mockResponse();

    await ParasiteRiskController.listSubscriptions(request(), res);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("treats a blank auth user id as unauthenticated", async () => {
    const res = mockResponse();

    await ParasiteRiskController.listSubscriptions(
      request({ userId: "   " } as never),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });
});
