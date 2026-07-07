import type { Request, Response } from "express";
import { DeveloperFhirController } from "../../../src/controllers/web/developer-fhir.controller";
import { DeveloperFhirService } from "../../../src/services/developer-fhir.service";
import { InvalidCursorError } from "../../../src/utils/cursor-pagination";

jest.mock("src/services/developer-fhir.service", () => ({
  DeveloperFhirService: {
    buildCapabilityStatement: jest.fn(),
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

jest.mock("src/utils/logger", () => ({ error: jest.fn(), info: jest.fn() }));

const mockService = DeveloperFhirService as unknown as Record<
  string,
  jest.Mock
>;

type MockRes = Response & {
  status: jest.Mock;
  type: jest.Mock;
  json: jest.Mock;
};

const buildRes = (): MockRes => {
  const res = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
  return res as unknown as MockRes;
};

const buildReq = (input: {
  organisationId?: string;
  query?: Record<string, unknown>;
  params?: Record<string, string>;
  originalUrl?: string;
}): Request =>
  ({
    organisationId: input.organisationId,
    query: input.query ?? {},
    params: input.params ?? {},
    originalUrl: input.originalUrl ?? "/v1/developer/fhir/Appointment",
  }) as unknown as Request;

const jsonBody = (res: MockRes): Record<string, unknown> =>
  res.json.mock.calls[0][0] as Record<string, unknown>;

const expectOutcome = (
  res: MockRes,
  status: number,
  issueCode: string,
  apiCode: string,
): void => {
  expect(res.status).toHaveBeenCalledWith(status);
  expect(res.type).toHaveBeenCalledWith("application/fhir+json");
  const body = jsonBody(res) as {
    resourceType: string;
    issue: Array<{
      code: string;
      details: { coding: Array<{ code: string; system: string }> };
    }>;
  };
  expect(body.resourceType).toBe("OperationOutcome");
  expect(body.issue[0].code).toBe(issueCode);
  expect(body.issue[0].details.coding[0].code).toBe(apiCode);
};

const fhirPage = (resources: unknown[], nextCursor: string | null = null) => ({
  resources,
  pagination: { nextCursor, hasMore: Boolean(nextCursor), limit: 50 },
});

describe("DeveloperFhirController.metadata", () => {
  beforeEach(() => jest.clearAllMocks());

  it("serves the capability statement as fhir+json", () => {
    const capability = { resourceType: "CapabilityStatement" };
    mockService.buildCapabilityStatement.mockReturnValue(capability);
    const res = buildRes();
    DeveloperFhirController.metadata(buildReq({}), res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.type).toHaveBeenCalledWith("application/fhir+json");
    expect(res.json).toHaveBeenCalledWith(capability);
  });
});

describe("DeveloperFhirController search bundles", () => {
  beforeEach(() => jest.clearAllMocks());

  it("400s (invalid) without organisation context", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(buildReq({}), res);
    expectOutcome(res, 400, "invalid", "invalid_request");
  });

  it("wraps results in a searchset Bundle with match entries and fullUrl", async () => {
    mockService.listAppointments.mockResolvedValue(
      fhirPage([{ resourceType: "Appointment", id: "apt-1" }]),
    );
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({
        organisationId: "org-1",
        originalUrl: "/v1/developer/fhir/Appointment?status=UPCOMING",
        query: { status: "UPCOMING" },
      }),
      res,
    );

    expect(mockService.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        status: "UPCOMING",
        limit: 50,
      }),
    );
    const bundle = jsonBody(res) as {
      resourceType: string;
      type: string;
      link: Array<{ relation: string; url: string }>;
      entry: Array<{
        fullUrl?: string;
        search?: { mode: string };
        resource: { id: string };
      }>;
    };
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("searchset");
    expect(bundle.link).toEqual([
      {
        relation: "self",
        url: "/v1/developer/fhir/Appointment?status=UPCOMING",
      },
    ]);
    expect(bundle.entry[0].search).toEqual({ mode: "match" });
    expect(bundle.entry[0].fullUrl).toBe(
      "/v1/developer/fhir/Appointment/apt-1",
    );
    expect(bundle).not.toHaveProperty("total");
  });

  it("carries the opaque cursor in the next link, preserving other params", async () => {
    mockService.listAppointments.mockResolvedValue(
      fhirPage([{ resourceType: "Appointment", id: "apt-1" }], "cur-2"),
    );
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({
        organisationId: "org-1",
        originalUrl:
          "/v1/developer/fhir/Appointment?status=UPCOMING&_count=1&_cursor=cur-1",
        query: { status: "UPCOMING", _count: "1", _cursor: "cur-1" },
      }),
      res,
    );
    const bundle = jsonBody(res) as {
      link: Array<{ relation: string; url: string }>;
    };
    const next = bundle.link.find((link) => link.relation === "next");
    expect(next?.url).toBe(
      "/v1/developer/fhir/Appointment?status=UPCOMING&_count=1&_cursor=cur-2",
    );
    expect(mockService.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 1, cursor: "cur-1" }),
    );
  });

  it("maps ge/le date prefixes onto dateFrom/dateTo", async () => {
    mockService.listAppointments.mockResolvedValue(fhirPage([]));
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({
        organisationId: "org-1",
        query: { date: ["ge2026-07-01", "le2026-07-31"] },
      }),
      res,
    );
    expect(mockService.listAppointments).toHaveBeenCalledWith(
      expect.objectContaining({
        dateFrom: new Date("2026-07-01").toISOString(),
        dateTo: new Date("2026-07-31").toISOString(),
      }),
    );
  });

  it("rejects unsupported search parameters with not-supported, never ignoring them", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({ organisationId: "org-1", query: { practitioner: "x" } }),
      res,
    );
    expectOutcome(res, 400, "not-supported", "invalid_request");
    expect(mockService.listAppointments).not.toHaveBeenCalled();
  });

  it("rejects unsupported date prefixes with not-supported", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({ organisationId: "org-1", query: { date: "eq2026-07-01" } }),
      res,
    );
    expectOutcome(res, 400, "not-supported", "invalid_request");
  });

  it("rejects malformed date values with invalid", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({ organisationId: "org-1", query: { date: "genot-a-date" } }),
      res,
    );
    expectOutcome(res, 400, "invalid", "invalid_request");
  });

  it("rejects unknown status tokens with invalid", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({ organisationId: "org-1", query: { status: "booked" } }),
      res,
    );
    expectOutcome(res, 400, "invalid", "invalid_request");
  });

  it("maps an invalid cursor to invalid_request", async () => {
    mockService.listAppointments.mockRejectedValue(new InvalidCursorError());
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({ organisationId: "org-1", query: { _cursor: "bogus" } }),
      res,
    );
    expectOutcome(res, 400, "invalid", "invalid_request");
  });

  it("maps unexpected failures to an exception OperationOutcome", async () => {
    mockService.listAppointments.mockRejectedValue(new Error("boom"));
    const res = buildRes();
    await DeveloperFhirController.searchAppointments(
      buildReq({ organisationId: "org-1" }),
      res,
    );
    expectOutcome(res, 500, "exception", "internal_error");
  });
});

describe("DeveloperFhirController patients", () => {
  beforeEach(() => jest.clearAllMocks());

  it("maps active=true/false to the record status filter", async () => {
    mockService.listPatients.mockResolvedValue(fhirPage([]));
    const res = buildRes();
    await DeveloperFhirController.searchPatients(
      buildReq({ organisationId: "org-1", query: { active: "false" } }),
      res,
    );
    expect(mockService.listPatients).toHaveBeenCalledWith(
      expect.objectContaining({ status: "archived" }),
    );

    await DeveloperFhirController.searchPatients(
      buildReq({ organisationId: "org-1", query: { active: "true" } }),
      buildRes(),
    );
    expect(mockService.listPatients).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: "active" }),
    );
  });

  it("rejects non-boolean active tokens with invalid", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchPatients(
      buildReq({ organisationId: "org-1", query: { active: "maybe" } }),
      res,
    );
    expectOutcome(res, 400, "invalid", "invalid_request");
  });

  it("read returns the bare resource or a not-found OperationOutcome", async () => {
    mockService.getPatient.mockResolvedValue({
      resourceType: "Patient",
      id: "pat-1",
    });
    const okRes = buildRes();
    await DeveloperFhirController.readPatient(
      buildReq({ organisationId: "org-1", params: { id: "pat-1" } }),
      okRes,
    );
    expect(okRes.status).toHaveBeenCalledWith(200);
    expect(okRes.type).toHaveBeenCalledWith("application/fhir+json");
    expect(jsonBody(okRes)).toEqual({ resourceType: "Patient", id: "pat-1" });

    mockService.getPatient.mockResolvedValue(null);
    const missingRes = buildRes();
    await DeveloperFhirController.readPatient(
      buildReq({ organisationId: "org-1", params: { id: "other" } }),
      missingRes,
    );
    expectOutcome(missingRes, 404, "not-found", "not_found");
  });
});

describe("DeveloperFhirController encounters and invoices", () => {
  beforeEach(() => jest.clearAllMocks());

  it("strips the Patient/ prefix from patient references", async () => {
    mockService.listEncounters.mockResolvedValue(fhirPage([]));
    const res = buildRes();
    await DeveloperFhirController.searchEncounters(
      buildReq({
        organisationId: "org-1",
        query: { patient: "Patient/pat-9" },
      }),
      res,
    );
    expect(mockService.listEncounters).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "pat-9" }),
    );
  });

  it("accepts a bare patient id on invoices", async () => {
    mockService.listInvoices.mockResolvedValue(fhirPage([]));
    const res = buildRes();
    await DeveloperFhirController.searchInvoices(
      buildReq({
        organisationId: "org-1",
        query: { patient: "pat-9", status: "PAID" },
      }),
      res,
    );
    expect(mockService.listInvoices).toHaveBeenCalledWith(
      expect.objectContaining({ patientId: "pat-9", status: "PAID" }),
    );
  });

  it("read handlers 404 with a not-found OperationOutcome", async () => {
    mockService.getEncounter.mockResolvedValue(null);
    const res = buildRes();
    await DeveloperFhirController.readEncounter(
      buildReq({ organisationId: "org-1", params: { id: "enc-x" } }),
      res,
    );
    expectOutcome(res, 404, "not-found", "not_found");

    mockService.getInvoice.mockResolvedValue(null);
    const invoiceRes = buildRes();
    await DeveloperFhirController.readInvoice(
      buildReq({ organisationId: "org-1", params: { id: "inv-x" } }),
      invoiceRes,
    );
    expectOutcome(invoiceRes, 404, "not-found", "not_found");
  });
});

describe("DeveloperFhirController organization", () => {
  beforeEach(() => jest.clearAllMocks());

  it("search returns the key's own org as a one-entry searchset", async () => {
    mockService.getOrganization.mockResolvedValue({
      resourceType: "Organization",
      id: "org-1",
    });
    const res = buildRes();
    await DeveloperFhirController.searchOrganization(
      buildReq({
        organisationId: "org-1",
        originalUrl: "/v1/developer/fhir/Organization",
      }),
      res,
    );
    const bundle = jsonBody(res) as {
      type: string;
      entry: Array<{ resource: { id: string } }>;
      link: Array<{ relation: string }>;
    };
    expect(bundle.type).toBe("searchset");
    expect(bundle.entry).toHaveLength(1);
    expect(bundle.entry[0].resource.id).toBe("org-1");
    expect(bundle.link.map((link) => link.relation)).toEqual(["self"]);
  });

  it("search rejects any parameter (none are supported)", async () => {
    const res = buildRes();
    await DeveloperFhirController.searchOrganization(
      buildReq({ organisationId: "org-1", query: { name: "x" } }),
      res,
    );
    expectOutcome(res, 400, "not-supported", "invalid_request");
  });

  it("read 404s for a foreign org id exactly like a missing one", async () => {
    const res = buildRes();
    await DeveloperFhirController.readOrganization(
      buildReq({ organisationId: "org-1", params: { id: "org-OTHER" } }),
      res,
    );
    expectOutcome(res, 404, "not-found", "not_found");
    expect(mockService.getOrganization).not.toHaveBeenCalled();
  });

  it("read serves the key's own org", async () => {
    mockService.getOrganization.mockResolvedValue({
      resourceType: "Organization",
      id: "org-1",
    });
    const res = buildRes();
    await DeveloperFhirController.readOrganization(
      buildReq({ organisationId: "org-1", params: { id: "org-1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(jsonBody(res)).toEqual({
      resourceType: "Organization",
      id: "org-1",
    });
  });
});
