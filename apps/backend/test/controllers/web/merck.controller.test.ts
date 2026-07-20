import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Response } from "express";
import { MerckController } from "../../../src/controllers/web/merck.controller";
import { MerckService } from "../../../src/services/merck.service";
import {
  handleMerckError,
  sendMerckSuccess,
} from "../../../src/controllers/merck/merck-response";
import { prisma } from "../../../src/config/prisma";

jest.mock("../../../src/services/merck.service", () => ({
  MerckService: {
    search: jest.fn(),
  },
}));

// merck-response is excluded from coverage collection, so mocking it is safe.
// The mock mirrors the real success/error shapes so we can assert status codes
// and payloads while still verifying the delegation arguments.
jest.mock("../../../src/controllers/merck/merck-response", () => ({
  sendMerckSuccess: jest.fn((res: any, result: any, requestId: string) =>
    res.status(200).json({
      ...result,
      meta: { ...(result?.meta ?? {}), requestId },
    }),
  ),
  handleMerckError: jest.fn((res: any, _error: unknown, requestId: string) =>
    res.status(500).json({
      message: "Merck search failed.",
      code: "MERCK_SEARCH_FAILED",
      requestId,
    }),
  ),
}));

jest.mock("../../../src/config/prisma", () => ({
  prisma: {
    userProfile: {
      findFirst: jest.fn(),
    },
  },
}));

const mockedSearch = MerckService.search as unknown as jest.Mock<any>;
const mockedSendSuccess = sendMerckSuccess as unknown as jest.Mock<any>;
const mockedHandleError = handleMerckError as unknown as jest.Mock<any>;
const mockedFindFirst = prisma.userProfile
  .findFirst as unknown as jest.Mock<any>;

const createResponse = () => {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as Response & { status: jest.Mock; json: jest.Mock };
};

type FakeReq = {
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  organisationId?: unknown;
  userId?: unknown;
};

const buildReq = (req: FakeReq) =>
  ({
    params: {},
    query: {},
    ...req,
  }) as any;

describe("MerckController.searchManuals (web)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 400 when organisationId is missing", async () => {
    const res = createResponse();

    await MerckController.searchManuals(buildReq({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "organisationId is required.",
      code: "MERCK_SEARCH_FAILED",
      requestId: expect.any(String),
    });
    expect(mockedSearch).not.toHaveBeenCalled();
    expect(mockedSendSuccess).not.toHaveBeenCalled();
  });

  it("returns 400 when organisationId is a blank string", async () => {
    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({ params: { organisationId: "   " } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ code: "MERCK_SEARCH_FAILED" }),
    );
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("returns 400 when organisationId is not a string", async () => {
    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({ organisationId: 12345 }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedSearch).not.toHaveBeenCalled();
  });

  it("resolves the timezone from the user profile when userId is set and no timezone query", async () => {
    mockedFindFirst.mockResolvedValueOnce({
      personalDetails: { timezone: "America/New_York" },
    });
    mockedSearch.mockResolvedValueOnce({
      entries: [{ id: "m1" }],
      meta: { total: 1 },
    });

    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({
        organisationId: "org-1",
        userId: "user-1",
        query: { q: "rabies" },
      }),
      res,
    );

    expect(mockedFindFirst).toHaveBeenCalledWith({
      where: { userId: "user-1", organizationId: "org-1" },
      select: { personalDetails: true },
    });
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        query: "rabies",
        timezone: "America/New_York",
        requestId: expect.any(String),
      }),
    );
    expect(mockedSendSuccess).toHaveBeenCalledWith(
      res,
      { entries: [{ id: "m1" }], meta: { total: 1 } },
      expect.any(String),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        entries: [{ id: "m1" }],
        meta: expect.objectContaining({
          total: 1,
          requestId: expect.any(String),
        }),
      }),
    );
  });

  it("uses the params organisationId and the query timezone without a profile lookup", async () => {
    mockedSearch.mockResolvedValueOnce({ entries: [], meta: { total: 0 } });

    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({
        params: { organisationId: "org-2" },
        query: {
          q: "dog",
          timezone: "Europe/London",
          audience: "PROV",
          language: "en",
          media: "hybrid",
        },
      }),
      res,
    );

    expect(mockedFindFirst).not.toHaveBeenCalled();
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-2",
        query: "dog",
        timezone: "Europe/London",
        audience: "PROV",
        language: "en",
        media: "hybrid",
      }),
    );
    expect(mockedSendSuccess).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("skips the profile lookup when no userId is present", async () => {
    mockedSearch.mockResolvedValueOnce({ entries: [], meta: {} });

    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({ params: { organisationId: "org-6" }, query: { q: "fish" } }),
      res,
    );

    expect(mockedFindFirst).not.toHaveBeenCalled();
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: "fish", timezone: undefined }),
    );
  });

  it("leaves the timezone undefined and defaults the query when the profile is null", async () => {
    mockedFindFirst.mockResolvedValueOnce(null);
    mockedSearch.mockResolvedValueOnce({ entries: [], meta: {} });

    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({ organisationId: "org-3", userId: "user-3", query: {} }),
      res,
    );

    expect(mockedFindFirst).toHaveBeenCalledTimes(1);
    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ query: "", timezone: undefined }),
    );
  });

  it("leaves the timezone undefined when the profile has no timezone", async () => {
    mockedFindFirst.mockResolvedValueOnce({ personalDetails: {} });
    mockedSearch.mockResolvedValueOnce({ entries: [], meta: {} });

    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({ organisationId: "org-4", userId: "user-4", query: {} }),
      res,
    );

    expect(mockedSearch).toHaveBeenCalledWith(
      expect.objectContaining({ timezone: undefined }),
    );
  });

  it("delegates to handleMerckError when the search throws", async () => {
    const failure = new Error("upstream down");
    mockedSearch.mockRejectedValueOnce(failure);

    const res = createResponse();

    await MerckController.searchManuals(
      buildReq({
        organisationId: "org-5",
        query: { q: "cat", timezone: "UTC" },
      }),
      res,
    );

    expect(mockedHandleError).toHaveBeenCalledWith(
      res,
      failure,
      expect.any(String),
      "Merck search failed",
    );
    expect(mockedSendSuccess).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Merck search failed.",
        code: "MERCK_SEARCH_FAILED",
      }),
    );
  });
});
