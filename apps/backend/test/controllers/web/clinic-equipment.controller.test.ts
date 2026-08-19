import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { ClinicEquipmentController } from "src/controllers/web/clinic-equipment.controller";
import {
  ClinicEquipmentService,
  ClinicEquipmentError,
} from "src/services/clinic-equipment.service";

jest.mock("src/services/clinic-equipment.service", () => {
  const actual = jest.requireActual(
    "src/services/clinic-equipment.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    ClinicEquipmentService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      addMaintenanceLog: jest.fn(),
      listMaintenanceLogs: jest.fn(),
    },
  };
});

const service = jest.mocked(ClinicEquipmentService);

type MockResponse = Response & {
  json: jest.Mock;
  send: jest.Mock;
  status: jest.Mock;
};

const buildResponse = (): MockResponse => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { json, send, status } as unknown as MockResponse;
};

const ORG = "org-equipment-1";
const EQUIPMENT_ID = "equipment-1";

const buildRequest = (
  overrides: {
    params?: Record<string, string>;
    query?: Record<string, unknown>;
    body?: unknown;
  } = {},
): Request =>
  ({
    params: { organisationId: ORG, ...(overrides.params ?? {}) },
    query: overrides.query ?? {},
    body: overrides.body ?? {},
  }) as unknown as Request;

const issuePaths = (res: MockResponse): string[][] => {
  const payload = res.json.mock.calls[0]?.[0] as {
    error: { path: (string | number)[] }[];
  };
  return payload.error.map((issue) => issue.path.map(String));
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("ClinicEquipmentController.create", () => {
  it("coerces both ISO timestamps to Date, scopes to the route organisation and answers 201", async () => {
    const stored = { id: EQUIPMENT_ID };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await ClinicEquipmentController.create(
      buildRequest({
        body: {
          name: "Anaesthesia machine",
          model: "AM-200",
          serialNumber: "SN-9931",
          manufacturer: "Vetronix",
          purchasedAt: "2025-02-01T00:00:00.000Z",
          warrantyExpiry: "2028-02-01T00:00:00.000Z",
          status: "OPERATIONAL",
          locationNotes: "Theatre 2",
          notes: "Serviced annually",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      name: "Anaesthesia machine",
      model: "AM-200",
      serialNumber: "SN-9931",
      manufacturer: "Vetronix",
      purchasedAt: new Date("2025-02-01T00:00:00.000Z"),
      warrantyExpiry: new Date("2028-02-01T00:00:00.000Z"),
      status: "OPERATIONAL",
      locationNotes: "Theatre 2",
      notes: "Serviced annually",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("omits the optional keys entirely when only a name is supplied", async () => {
    service.create.mockResolvedValue({ id: EQUIPMENT_ID } as never);

    await ClinicEquipmentController.create(
      buildRequest({ body: { name: "Centrifuge" } }),
      buildResponse(),
    );

    const [args] = service.create.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(args).toEqual({ organisationId: ORG, name: "Centrifuge" });
    expect(Object.keys(args)).toEqual(["organisationId", "name"]);
  });

  it("rejects a create with no name", async () => {
    const res = buildResponse();

    await ClinicEquipmentController.create(
      buildRequest({ body: { model: "AM-200" } }),
      res,
    );

    expect(service.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["name"]]);
  });

  // A plain date string would silently become an Invalid Date once coerced, so
  // the schema demands a full ISO datetime before the transform runs.
  it("rejects a date-only purchasedAt and an unknown status together", async () => {
    const res = buildResponse();

    await ClinicEquipmentController.create(
      buildRequest({
        body: {
          name: "Autoclave",
          purchasedAt: "2025-02-01",
          status: "BROKEN",
        },
      }),
      res,
    );

    expect(service.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["purchasedAt"], ["status"]]);
  });
});

describe("ClinicEquipmentController.get", () => {
  it("reads the equipment by id within the route organisation", async () => {
    const equipment = { id: EQUIPMENT_ID };
    service.get.mockResolvedValue(equipment as never);
    const res = buildResponse();

    await ClinicEquipmentController.get(
      buildRequest({ params: { equipmentId: EQUIPMENT_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(EQUIPMENT_ID, ORG);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(equipment);
  });

  it("lets the not-found error propagate instead of answering", async () => {
    service.get.mockRejectedValue(
      new ClinicEquipmentError("Equipment not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      ClinicEquipmentController.get(
        buildRequest({ params: { equipmentId: "other-org-equipment" } }),
        res,
      ),
    ).rejects.toMatchObject({
      message: "Equipment not found.",
      statusCode: 404,
    });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("ClinicEquipmentController.list", () => {
  it("forwards the status and search filters", async () => {
    const results = [{ id: EQUIPMENT_ID }];
    service.list.mockResolvedValue(results as never);
    const res = buildResponse();

    await ClinicEquipmentController.list(
      buildRequest({
        query: { status: "AWAITING_REPAIR", search: "autoclave" },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      status: "AWAITING_REPAIR",
      search: "autoclave",
    });
    expect(res.json).toHaveBeenCalledWith(results);
  });

  it("omits both filter keys when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);

    await ClinicEquipmentController.list(buildRequest(), buildResponse());

    const [args] = service.list.mock.calls[0] as unknown as [
      Record<string, unknown>,
    ];
    expect(args).toEqual({ organisationId: ORG });
    expect(Object.keys(args)).toEqual(["organisationId"]);
  });

  it("rejects an unknown status filter", async () => {
    const res = buildResponse();

    await ClinicEquipmentController.list(
      buildRequest({ query: { status: "RETIRED" } }),
      res,
    );

    expect(service.list).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["status"]]);
  });
});

describe("ClinicEquipmentController.update", () => {
  it("accepts a partial payload and still coerces the supplied timestamp", async () => {
    const updated = { id: EQUIPMENT_ID, status: "UNDER_MAINTENANCE" };
    service.update.mockResolvedValue(updated as never);
    const res = buildResponse();

    await ClinicEquipmentController.update(
      buildRequest({
        params: { equipmentId: EQUIPMENT_ID },
        body: {
          status: "UNDER_MAINTENANCE",
          warrantyExpiry: "2027-12-31T00:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(EQUIPMENT_ID, ORG, {
      status: "UNDER_MAINTENANCE",
      warrantyExpiry: new Date("2027-12-31T00:00:00.000Z"),
    });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  // `.partial()` makes name optional, so an empty body is valid input that must
  // still reach the service as an empty patch rather than being rejected.
  it("passes an empty patch through when the body is empty", async () => {
    service.update.mockResolvedValue({ id: EQUIPMENT_ID } as never);

    await ClinicEquipmentController.update(
      buildRequest({ params: { equipmentId: EQUIPMENT_ID } }),
      buildResponse(),
    );

    expect(service.update).toHaveBeenCalledWith(EQUIPMENT_ID, ORG, {});
  });

  it("rejects an update that sets a non-string name", async () => {
    const res = buildResponse();

    await ClinicEquipmentController.update(
      buildRequest({
        params: { equipmentId: EQUIPMENT_ID },
        body: { name: 42 },
      }),
      res,
    );

    expect(service.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["name"]]);
  });
});

describe("ClinicEquipmentController.delete", () => {
  it("answers 204 with an empty body", async () => {
    service.delete.mockResolvedValue(undefined as never);
    const res = buildResponse();

    await ClinicEquipmentController.delete(
      buildRequest({ params: { equipmentId: EQUIPMENT_ID } }),
      res,
    );

    expect(service.delete).toHaveBeenCalledWith(EQUIPMENT_ID, ORG);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
    expect(res.json).not.toHaveBeenCalled();
  });

  // The service refuses to delete equipment that still has maintenance history;
  // that conflict must not be swallowed into a 204.
  it("lets a delete conflict propagate without answering 204", async () => {
    service.delete.mockRejectedValue(
      new ClinicEquipmentError(
        "Equipment has maintenance logs and cannot be deleted.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      ClinicEquipmentController.delete(
        buildRequest({ params: { equipmentId: EQUIPMENT_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.status).not.toHaveBeenCalled();
    expect(res.send).not.toHaveBeenCalled();
  });
});

describe("ClinicEquipmentController.addMaintenanceLog", () => {
  it("coerces every timestamp and answers 201 with the stored log", async () => {
    const log = { id: "log-1" };
    service.addMaintenanceLog.mockResolvedValue(log as never);
    const res = buildResponse();

    await ClinicEquipmentController.addMaintenanceLog(
      buildRequest({
        params: { equipmentId: EQUIPMENT_ID },
        body: {
          maintenanceType: "CALIBRATION",
          performedBy: "tech-1",
          vendor: "Vetronix Service",
          scheduledAt: "2026-01-05T09:00:00.000Z",
          performedAt: "2026-01-06T10:30:00.000Z",
          nextDueAt: "2027-01-06T10:30:00.000Z",
          cost: 249.5,
          currency: "GBP",
          passed: true,
          notes: "Within tolerance",
        },
      }),
      res,
    );

    expect(service.addMaintenanceLog).toHaveBeenCalledWith(EQUIPMENT_ID, ORG, {
      maintenanceType: "CALIBRATION",
      performedBy: "tech-1",
      vendor: "Vetronix Service",
      scheduledAt: new Date("2026-01-05T09:00:00.000Z"),
      performedAt: new Date("2026-01-06T10:30:00.000Z"),
      nextDueAt: new Date("2027-01-06T10:30:00.000Z"),
      cost: 249.5,
      currency: "GBP",
      passed: true,
      notes: "Within tolerance",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(log);
  });

  // performedAt is the only required timestamp: a log without it would claim
  // maintenance happened at an unknown time.
  it("rejects a log with no performedAt", async () => {
    const res = buildResponse();

    await ClinicEquipmentController.addMaintenanceLog(
      buildRequest({
        params: { equipmentId: EQUIPMENT_ID },
        body: { maintenanceType: "REPAIR" },
      }),
      res,
    );

    expect(service.addMaintenanceLog).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["performedAt"]]);
  });

  it("rejects an unknown maintenance type and a non-positive cost", async () => {
    const res = buildResponse();

    await ClinicEquipmentController.addMaintenanceLog(
      buildRequest({
        params: { equipmentId: EQUIPMENT_ID },
        body: {
          maintenanceType: "POLISHING",
          performedAt: "2026-01-06T10:30:00.000Z",
          cost: 0,
        },
      }),
      res,
    );

    expect(service.addMaintenanceLog).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(issuePaths(res)).toEqual([["maintenanceType"], ["cost"]]);
  });
});

describe("ClinicEquipmentController.listMaintenanceLogs", () => {
  it("lists the logs for the equipment within the route organisation", async () => {
    const logs = [{ id: "log-1" }, { id: "log-2" }];
    service.listMaintenanceLogs.mockResolvedValue(logs as never);
    const res = buildResponse();

    await ClinicEquipmentController.listMaintenanceLogs(
      buildRequest({ params: { equipmentId: EQUIPMENT_ID } }),
      res,
    );

    expect(service.listMaintenanceLogs).toHaveBeenCalledWith(EQUIPMENT_ID, ORG);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(logs);
  });

  it("lets the not-found error propagate for equipment in another organisation", async () => {
    service.listMaintenanceLogs.mockRejectedValue(
      new ClinicEquipmentError("Equipment not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      ClinicEquipmentController.listMaintenanceLogs(
        buildRequest({ params: { equipmentId: "other-org-equipment" } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(res.json).not.toHaveBeenCalled();
  });
});
