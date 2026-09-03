import type { Request, Response } from "express";

const listOrganizations = jest.fn();
const listAppointments = jest.fn();
const getAppointment = jest.fn();
jest.mock("src/services/developer-data.service", () => ({
  clampPageSize: jest.requireActual("src/services/developer-data.service")
    .clampPageSize,
  DeveloperDataService: { listOrganizations, listAppointments, getAppointment },
}));

const getUsage = jest.fn();
jest.mock("src/services/developer-usage.service", () => ({
  DeveloperUsageService: { getUsage },
}));

const errorLog = jest.fn();
const warnLog = jest.fn();
jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: { info: jest.fn(), warn: warnLog, error: errorLog },
}));

import { DeveloperDataController } from "src/controllers/web/developer-data.controller";

const buildRes = () => {
  const res = {} as Response & { body?: unknown; code?: number };
  res.status = jest.fn().mockImplementation((status: number) => {
    res.code = status;
    return res;
  });
  res.json = jest.fn().mockImplementation((body: unknown) => {
    res.body = body;
    return res;
  });
  return res;
};

const buildReq = (over: Partial<Request> = {}) =>
  ({
    query: {},
    params: {},
    userId: "owner-1",
    organisationId: "org-a",
    ...over,
  }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe("listOrganizations", () => {
  it("401s with the published envelope when no identity was bound", async () => {
    const res = buildRes();
    await DeveloperDataController.listOrganizations(
      buildReq({ userId: undefined } as never),
      res,
    );
    expect(res.code).toBe(401);
    expect(res.body).toEqual({
      message: "API key required",
      code: "missing_api_key",
    });
  });

  it("returns the service result under a data key", async () => {
    listOrganizations.mockResolvedValue([{ id: "org-a" }]);
    const res = buildRes();
    await DeveloperDataController.listOrganizations(buildReq(), res);
    expect(res.body).toEqual({ data: [{ id: "org-a" }] });
  });

  it("500s without leaking the underlying error", async () => {
    listOrganizations.mockRejectedValue(
      new Error("connection string: postgres://u:p@h/db"),
    );
    const res = buildRes();
    await DeveloperDataController.listOrganizations(buildReq(), res);
    expect(res.code).toBe(500);
    expect(JSON.stringify(res.body)).not.toContain("postgres://");
  });
});

describe("getUsage", () => {
  it("reads the caller's own usage", async () => {
    getUsage.mockResolvedValue({ callCount: 3 });
    const res = buildRes();
    await DeveloperDataController.getUsage(buildReq(), res);
    expect(getUsage).toHaveBeenCalledWith("owner-1");
    expect(res.body).toEqual({ data: { callCount: 3 } });
  });
});

describe("listAppointments", () => {
  it("400s when no organisation was resolved", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: undefined } as never),
      res,
    );
    expect(res.code).toBe(400);
    expect(res.body).toMatchObject({ code: "invalid_request" });
  });

  it.each(["from", "to"])("400s on an unparseable %s", async (field) => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ query: { [field]: "not-a-date" } } as never),
      res,
    );
    expect(res.code).toBe(400);
    expect(listAppointments).not.toHaveBeenCalled();
  });

  it("400s on an unknown status and names the accepted values", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ query: { status: "TELEPORTED" } } as never),
      res,
    );
    expect(res.code).toBe(400);
    expect(String((res.body as { message: string }).message)).toContain(
      "CANCELLED",
    );
  });

  it("accepts a lowercase status", async () => {
    listAppointments.mockResolvedValue({ items: [], nextCursor: null });
    await DeveloperDataController.listAppointments(
      buildReq({ query: { status: "completed" } } as never),
      buildRes(),
    );
    expect(listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
  });

  it("clamps an oversized limit and reports what it used", async () => {
    listAppointments.mockResolvedValue({ items: [], nextCursor: "n" });
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ query: { limit: "9999" } } as never),
      res,
    );
    expect(res.body).toEqual({
      data: [],
      pagination: { limit: 100, nextCursor: "n" },
    });
  });

  it("rejects a malformed cursor before it reaches the query", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ query: { cursor: "bogus" } } as never),
      res,
    );
    expect(res.code).toBe(400);
    expect(res.body).toMatchObject({ code: "invalid_request" });
    expect(listAppointments).not.toHaveBeenCalled();
  });

  it("accepts a well-formed cursor", async () => {
    listAppointments.mockResolvedValue({ items: [], nextCursor: null });
    const cursor = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
    await DeveloperDataController.listAppointments(
      buildReq({ query: { cursor } } as never),
      buildRes(),
    );
    expect(listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ cursor }),
    );
  });

  /*
   * The regression Aikido caught on #2676. The catch block used to answer 400
   * "Unknown or malformed cursor" for ANY throw whenever a cursor was present,
   * so a database outage mid-pagination told the caller their cursor was bad.
   * Cursor validity is decided before the query now, which is what lets every
   * failure from the query itself be reported honestly as a 500.
   */
  it("500s when the query fails even though the cursor was valid", async () => {
    listAppointments.mockRejectedValue(new Error("db down"));
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({
        query: { cursor: "3f2504e0-4f89-41d3-9a0c-0305e82c3301" },
      } as never),
      res,
    );
    expect(res.code).toBe(500);
    expect(res.body).toMatchObject({ code: "internal_error" });
  });

  /*
   * A cursor is caller-controlled and reaches the log. Without the CR/LF
   * barrier a crafted value forges a second log line, which is how a reader is
   * misled about what the server did.
   */
  it("strips CR/LF from a rejected cursor before it reaches the log", async () => {
    await DeveloperDataController.listAppointments(
      buildReq({
        query: { cursor: "abc\nINFO: admin login succeeded" },
      } as never),
      buildRes(),
    );
    const logged = String(warnLog.mock.calls[0][0]);
    expect(logged).not.toContain("\n");
    expect(logged).toContain("abcINFO: admin login succeeded");
  });

  it("500s on a query failure with no cursor at all", async () => {
    listAppointments.mockRejectedValue(new Error("db down"));
    const res = buildRes();
    await DeveloperDataController.listAppointments(buildReq(), res);
    expect(res.code).toBe(500);
  });
});

describe("getAppointment", () => {
  it("404s rather than 200-with-null when the row is not the caller's", async () => {
    getAppointment.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq({ params: { appointmentId: "b1" } } as never),
      res,
    );
    expect(res.code).toBe(404);
    expect(res.body).toEqual({
      message: "Appointment not found",
      code: "not_found",
    });
  });

  it("returns the row when it resolves", async () => {
    getAppointment.mockResolvedValue({ id: "a1" });
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq({ params: { appointmentId: "a1" } } as never),
      res,
    );
    expect(res.body).toEqual({ data: { id: "a1" } });
  });

  it("400s when the id is missing", async () => {
    const res = buildRes();
    await DeveloperDataController.getAppointment(buildReq(), res);
    expect(res.code).toBe(400);
  });
});
