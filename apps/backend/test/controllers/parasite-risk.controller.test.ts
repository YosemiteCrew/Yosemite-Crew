jest.mock("src/config/prisma", () => ({
  prisma: { parent: { findFirst: jest.fn() } },
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
import { prisma } from "src/config/prisma";
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

const request = (overrides: Partial<Request> = {}) =>
  ({
    query: {},
    body: {},
    params: {},
    userId: "user-1",
    ...overrides,
  }) as unknown as Request;

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
    (prisma.parent.findFirst as jest.Mock).mockResolvedValue({
      id: "parent-1",
    });
    (upsertSubscription as jest.Mock).mockResolvedValue({ id: "sub-1" });
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

  it("only forwards a recognised alert tier", async () => {
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

    expect(upsertSubscription).toHaveBeenCalledWith(
      "parent-1",
      expect.objectContaining({ alertTier: undefined }),
    );
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
    (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);
    const res = mockResponse();

    await ParasiteRiskController.createSubscription(
      request({ body: { lat: 0, lon: 0, label: "Somewhere" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(401);
  });
});

describe("ParasiteRiskController subscription list and delete", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.parent.findFirst as jest.Mock).mockResolvedValue({
      id: "parent-1",
    });
  });

  it("returns the parent's followed locations", async () => {
    (listSubscriptions as jest.Mock).mockResolvedValue([{ id: "sub-1" }]);
    const res = mockResponse();

    await ParasiteRiskController.listSubscriptions(request(), res);

    expect(listSubscriptions).toHaveBeenCalledWith("parent-1");
    expect(res.json).toHaveBeenCalledWith([{ id: "sub-1" }]);
  });

  it("rejects an unauthenticated list request", async () => {
    (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);
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

  it("rejects an unauthenticated delete request", async () => {
    (prisma.parent.findFirst as jest.Mock).mockResolvedValue(null);
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
