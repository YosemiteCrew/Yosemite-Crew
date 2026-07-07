import type { Request, Response } from "express";
import { DeveloperDataController } from "../../../src/controllers/web/developer-data.controller";
import { DeveloperDataService } from "../../../src/services/developer-data.service";
import { DeveloperUsageService } from "../../../src/services/developer-usage.service";
import { InvalidCursorError } from "../../../src/utils/cursor-pagination";

// The controller owns validation, envelopes, and status codes; all Prisma
// access lives in DeveloperDataService, so these tests mock the service
// (mirroring the developer-api-key controller/service split).
jest.mock("../../../src/services/developer-data.service", () => ({
  DeveloperDataService: {
    listAppointments: jest.fn(),
    getAppointment: jest.fn(),
    listPatients: jest.fn(),
    getPatient: jest.fn(),
    listEncounters: jest.fn(),
    getEncounter: jest.fn(),
    listInvoices: jest.fn(),
    getInvoice: jest.fn(),
    getOrganization: jest.fn(),
  },
}));

jest.mock("../../../src/services/developer-usage.service", () => ({
  DeveloperUsageService: { getUsage: jest.fn() },
}));

jest.mock("../../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn() },
}));

const svc = DeveloperDataService as unknown as {
  listAppointments: jest.Mock;
  getAppointment: jest.Mock;
  listPatients: jest.Mock;
  getPatient: jest.Mock;
  listEncounters: jest.Mock;
  getEncounter: jest.Mock;
  listInvoices: jest.Mock;
  getInvoice: jest.Mock;
  getOrganization: jest.Mock;
};

const mockGetUsage = DeveloperUsageService.getUsage as jest.Mock;

const buildRes = (): Response => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};

const buildReq = (
  over: {
    organisationId?: string;
    query?: Record<string, string>;
    params?: Record<string, string>;
  } = {},
): Request =>
  ({
    query: over.query ?? {},
    params: over.params ?? {},
    organisationId: over.organisationId,
  }) as unknown as Request;

const jsonBody = (res: Response) => (res.json as jest.Mock).mock.calls[0][0];

const page = (items: unknown[], hasMore = false, limit = 50) => ({
  items,
  pagination: { nextCursor: hasMore ? "tok" : null, hasMore, limit },
});

describe("DeveloperDataController.listAppointments", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400 invalid_request without organisation context", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonBody(res).code).toBe("invalid_request");
    expect(svc.listAppointments).not.toHaveBeenCalled();
  });

  it("400 invalid_request on a bad status value", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: "org-1", query: { status: "BOGUS" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonBody(res).code).toBe("invalid_request");
    expect(svc.listAppointments).not.toHaveBeenCalled();
  });

  it("400 invalid_request on a malformed dateFrom", async () => {
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: "org-1", query: { dateFrom: "yesterday" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("400 invalid_request when the service throws InvalidCursorError", async () => {
    svc.listAppointments.mockRejectedValue(new InvalidCursorError());
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: "org-1", query: { cursor: "forged" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(jsonBody(res)).toEqual({
      message: "Invalid pagination cursor",
      code: "invalid_request",
    });
  });

  it("passes validated filters and the clamped limit to the service", async () => {
    svc.listAppointments.mockResolvedValue(page([]));
    await DeveloperDataController.listAppointments(
      buildReq({
        organisationId: "org-1",
        query: {
          status: "UPCOMING",
          limit: "500",
          cursor: "tok",
          dateFrom: "2026-07-01T00:00:00+00:00",
          dateTo: "2026-07-31T00:00:00+00:00",
        },
      }),
      buildRes(),
    );
    expect(svc.listAppointments).toHaveBeenCalledWith({
      organisationId: "org-1",
      limit: 100,
      cursor: "tok",
      status: "UPCOMING",
      dateFrom: "2026-07-01T00:00:00+00:00",
      dateTo: "2026-07-31T00:00:00+00:00",
    });
  });

  it("defaults the limit to 50", async () => {
    svc.listAppointments.mockResolvedValue(page([]));
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: "org-1" }),
      buildRes(),
    );
    expect(svc.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it("returns the { data, pagination } list envelope", async () => {
    svc.listAppointments.mockResolvedValue(page([{ id: "a-1" }], true, 2));
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: "org-1", query: { limit: "2" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonBody(res)).toEqual({
      data: [{ id: "a-1" }],
      pagination: { nextCursor: "tok", hasMore: true, limit: 2 },
    });
  });

  it("500 internal_error when the service throws", async () => {
    svc.listAppointments.mockRejectedValue(new Error("db down"));
    const res = buildRes();
    await DeveloperDataController.listAppointments(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
    expect(jsonBody(res)).toEqual({
      message: "Internal server error",
      code: "internal_error",
    });
  });
});

describe("DeveloperDataController.getAppointment", () => {
  beforeEach(() => jest.clearAllMocks());

  it("wraps the service row in the data envelope", async () => {
    svc.getAppointment.mockResolvedValue({ id: "a-1" });
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq({ organisationId: "org-1", params: { id: "a-1" } }),
      res,
    );
    expect(svc.getAppointment).toHaveBeenCalledWith("org-1", "a-1");
    expect(jsonBody(res)).toEqual({ data: { id: "a-1" } });
  });

  it("404 not_found when the service returns null (absent or cross-org)", async () => {
    svc.getAppointment.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq({ organisationId: "org-1", params: { id: "other-org-row" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
    expect(jsonBody(res)).toEqual({
      message: "Resource not found",
      code: "not_found",
    });
  });

  it("400 without organisation context", async () => {
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq({ params: { id: "a-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.getAppointment).not.toHaveBeenCalled();
  });

  it("500 on a service failure", async () => {
    svc.getAppointment.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.getAppointment(
      buildReq({ organisationId: "org-1", params: { id: "a-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperDataController.listPatients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes the validated status filter through to the service", async () => {
    svc.listPatients.mockResolvedValue(page([]));
    await DeveloperDataController.listPatients(
      buildReq({ organisationId: "org-1", query: { status: "archived" } }),
      buildRes(),
    );
    expect(svc.listPatients).toHaveBeenCalledWith({
      organisationId: "org-1",
      limit: 50,
      cursor: undefined,
      status: "archived",
    });
  });

  it("400 on a status outside the RecordStatus enum", async () => {
    const res = buildRes();
    await DeveloperDataController.listPatients(
      buildReq({ organisationId: "org-1", query: { status: "ACTIVE" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.listPatients).not.toHaveBeenCalled();
  });

  it("returns the list envelope of mapped patients", async () => {
    svc.listPatients.mockResolvedValue(
      page([{ id: "p-0" }, { id: "p-1" }], true, 2),
    );
    const res = buildRes();
    await DeveloperDataController.listPatients(
      buildReq({ organisationId: "org-1", query: { limit: "2" } }),
      res,
    );
    const body = jsonBody(res);
    expect(body.data).toEqual([{ id: "p-0" }, { id: "p-1" }]);
    expect(body.pagination.hasMore).toBe(true);
  });

  it("400 when the service throws InvalidCursorError", async () => {
    svc.listPatients.mockRejectedValue(new InvalidCursorError());
    const res = buildRes();
    await DeveloperDataController.listPatients(
      buildReq({ organisationId: "org-1", query: { cursor: "bad" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("500 on a service failure", async () => {
    svc.listPatients.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.listPatients(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperDataController.getPatient", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 when there is no ACTIVE link for this org", async () => {
    svc.getPatient.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq({ organisationId: "org-1", params: { id: "p-9" } }),
      res,
    );
    expect(svc.getPatient).toHaveBeenCalledWith("org-1", "p-9");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns the linked patient in the data envelope", async () => {
    svc.getPatient.mockResolvedValue({ id: "p-1", name: "Biscuit" });
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq({ organisationId: "org-1", params: { id: "p-1" } }),
      res,
    );
    expect(jsonBody(res)).toEqual({ data: { id: "p-1", name: "Biscuit" } });
  });

  it("500 on a service failure", async () => {
    svc.getPatient.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.getPatient(
      buildReq({ organisationId: "org-1", params: { id: "p-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperDataController.listEncounters", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes status, patientId, caseId, and the date range to the service", async () => {
    svc.listEncounters.mockResolvedValue(page([]));
    await DeveloperDataController.listEncounters(
      buildReq({
        organisationId: "org-1",
        query: {
          status: "in-progress",
          patientId: "p-1",
          caseId: "c-1",
          dateFrom: "2026-06-01T00:00:00+00:00",
        },
      }),
      buildRes(),
    );
    expect(svc.listEncounters).toHaveBeenCalledWith({
      organisationId: "org-1",
      limit: 50,
      cursor: undefined,
      status: "in-progress",
      patientId: "p-1",
      caseId: "c-1",
      dateFrom: "2026-06-01T00:00:00+00:00",
      dateTo: undefined,
    });
  });

  it("returns the list envelope", async () => {
    svc.listEncounters.mockResolvedValue(page([{ id: "e-1" }]));
    const res = buildRes();
    await DeveloperDataController.listEncounters(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(jsonBody(res)).toEqual({
      data: [{ id: "e-1" }],
      pagination: { nextCursor: null, hasMore: false, limit: 50 },
    });
  });

  it("400 without organisation context", async () => {
    const res = buildRes();
    await DeveloperDataController.listEncounters(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("500 on a service failure", async () => {
    svc.listEncounters.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.listEncounters(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperDataController.getEncounter", () => {
  beforeEach(() => jest.clearAllMocks());

  it("404 for a cross-org encounter", async () => {
    svc.getEncounter.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getEncounter(
      buildReq({ organisationId: "org-1", params: { id: "e-1" } }),
      res,
    );
    expect(svc.getEncounter).toHaveBeenCalledWith("org-1", "e-1");
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("200 with the encounter", async () => {
    svc.getEncounter.mockResolvedValue({ id: "e-1" });
    const res = buildRes();
    await DeveloperDataController.getEncounter(
      buildReq({ organisationId: "org-1", params: { id: "e-1" } }),
      res,
    );
    expect(jsonBody(res)).toEqual({ data: { id: "e-1" } });
  });
});

describe("DeveloperDataController.listInvoices", () => {
  beforeEach(() => jest.clearAllMocks());

  it("passes status, ids, and the date range to the service", async () => {
    svc.listInvoices.mockResolvedValue(page([]));
    await DeveloperDataController.listInvoices(
      buildReq({
        organisationId: "org-1",
        query: {
          status: "PAID",
          patientId: "p-1",
          appointmentId: "a-1",
          dateTo: "2026-07-01T00:00:00+00:00",
        },
      }),
      buildRes(),
    );
    expect(svc.listInvoices).toHaveBeenCalledWith({
      organisationId: "org-1",
      limit: 50,
      cursor: undefined,
      status: "PAID",
      patientId: "p-1",
      appointmentId: "a-1",
      dateFrom: undefined,
      dateTo: "2026-07-01T00:00:00+00:00",
    });
  });

  it("400 on an unknown invoice status", async () => {
    const res = buildRes();
    await DeveloperDataController.listInvoices(
      buildReq({ organisationId: "org-1", query: { status: "SETTLED" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.listInvoices).not.toHaveBeenCalled();
  });

  it("returns the list envelope", async () => {
    svc.listInvoices.mockResolvedValue(page([{ id: "i-1" }], true, 2));
    const res = buildRes();
    await DeveloperDataController.listInvoices(
      buildReq({ organisationId: "org-1", query: { limit: "2" } }),
      res,
    );
    const body = jsonBody(res);
    expect(body.data).toEqual([{ id: "i-1" }]);
    expect(body.pagination.hasMore).toBe(true);
  });

  it("500 on a service failure", async () => {
    svc.listInvoices.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.listInvoices(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperDataController.getInvoice", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the invoice detail in the data envelope", async () => {
    svc.getInvoice.mockResolvedValue({ id: "i-1" });
    const res = buildRes();
    await DeveloperDataController.getInvoice(
      buildReq({ organisationId: "org-1", params: { id: "i-1" } }),
      res,
    );
    expect(svc.getInvoice).toHaveBeenCalledWith("org-1", "i-1");
    expect(jsonBody(res)).toEqual({ data: { id: "i-1" } });
  });

  it("404 for a cross-org invoice", async () => {
    svc.getInvoice.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getInvoice(
      buildReq({ organisationId: "org-1", params: { id: "i-9" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("DeveloperDataController.getOrganization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns the key's own org in the data envelope", async () => {
    svc.getOrganization.mockResolvedValue({
      id: "org-1",
      name: "Clinic",
      address: { city: "Berlin" },
    });
    const res = buildRes();
    await DeveloperDataController.getOrganization(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(svc.getOrganization).toHaveBeenCalledWith("org-1");
    expect(jsonBody(res).data.name).toBe("Clinic");
  });

  it("404 when the org row is gone", async () => {
    svc.getOrganization.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperDataController.getOrganization(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("400 without organisation context", async () => {
    const res = buildRes();
    await DeveloperDataController.getOrganization(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.getOrganization).not.toHaveBeenCalled();
  });

  it("500 on a service failure", async () => {
    svc.getOrganization.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.getOrganization(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("DeveloperDataController.getUsage", () => {
  beforeEach(() => jest.clearAllMocks());

  it("wraps the usage snapshot in the data envelope", async () => {
    mockGetUsage.mockResolvedValue({
      billingPeriod: "2026-07",
      callCount: 412,
      limit: 1000,
    });
    const res = buildRes();
    await DeveloperDataController.getUsage(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(mockGetUsage).toHaveBeenCalledWith("org-1");
    expect(jsonBody(res)).toEqual({
      data: { billingPeriod: "2026-07", callCount: 412, limit: 1000 },
    });
  });

  it("400 without organisation context", async () => {
    const res = buildRes();
    await DeveloperDataController.getUsage(buildReq(), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("500 when the usage service fails", async () => {
    mockGetUsage.mockRejectedValue(new Error("x"));
    const res = buildRes();
    await DeveloperDataController.getUsage(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
