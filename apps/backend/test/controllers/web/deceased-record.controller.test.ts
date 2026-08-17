import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { deceasedRecordController } from "../../../src/controllers/web/deceased-record.controller";
import { DeceasedRecordService } from "../../../src/services/deceased-record.service";

jest.mock("../../../src/services/deceased-record.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/deceased-record.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    DeceasedRecordService: {
      create: jest.fn(),
      get: jest.fn(),
      getByPatient: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
    },
  };
});

const service = jest.mocked(DeceasedRecordService);

const buildResponse = () => {
  const json = jest.fn();
  const send = jest.fn();
  const status = jest.fn(() => ({ json, send }));
  return { json, send, status } as unknown as Response & {
    json: jest.Mock;
    send: jest.Mock;
    status: jest.Mock;
  };
};

const ORG = "org-1";
const RECORD_ID = "record-1";
const USER_ID = "user-1";

const buildRequest = (
  overrides: Partial<{
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: unknown;
  }> = {},
): Request =>
  ({
    params: { organisationId: ORG, ...(overrides.params ?? {}) },
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    userId: USER_ID,
  }) as unknown as Request;

/** The service throws plain errors carrying a statusCode, not a class. */
const serviceError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("deceasedRecordController.create", () => {
  it("coerces both timestamps, stamps the session user and answers 201", async () => {
    const stored = { id: RECORD_ID };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await deceasedRecordController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          deceasedAt: "2026-03-30T18:00:00.000Z",
          causeOfDeathType: "EUTHANASIA",
          causeOfDeathDetail: "End-stage renal failure",
          bodyWeightKg: 4.2,
          bodyConditionScore: 3,
          bodyDisposition: "PRIVATE_CREMATION",
          ownerNotifiedAt: "2026-03-30T18:30:00.000Z",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      causeOfDeathType: "EUTHANASIA",
      causeOfDeathDetail: "End-stage renal failure",
      bodyWeightKg: 4.2,
      bodyConditionScore: 3,
      bodyDisposition: "PRIVATE_CREMATION",
      deceasedAt: new Date("2026-03-30T18:00:00.000Z"),
      ownerNotifiedAt: new Date("2026-03-30T18:30:00.000Z"),
      recordedBy: USER_ID,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves the notification time undefined when the owner has not been told", async () => {
    service.create.mockResolvedValue({ id: RECORD_ID } as never);
    const res = buildResponse();

    await deceasedRecordController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          deceasedAt: "2026-03-30T18:00:00.000Z",
          causeOfDeathType: "NATURAL_DEATH",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith(
      expect.objectContaining({ ownerNotifiedAt: undefined }),
    );
  });

  it("rejects a body condition score outside 1-9 and never calls the service", async () => {
    const res = buildResponse();

    await deceasedRecordController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          deceasedAt: "2026-03-30T18:00:00.000Z",
          causeOfDeathType: "NATURAL_DEATH",
          bodyConditionScore: 12,
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("uses the status the service error carries", async () => {
    service.create.mockRejectedValue(
      serviceError("Patient already has a deceased record.", 409) as never,
    );
    const res = buildResponse();

    await deceasedRecordController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          deceasedAt: "2026-03-30T18:00:00.000Z",
          causeOfDeathType: "UNKNOWN",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Patient already has a deceased record.",
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await deceasedRecordController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          deceasedAt: "2026-03-30T18:00:00.000Z",
          causeOfDeathType: "UNKNOWN",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("deceasedRecordController.get", () => {
  it("looks the record up inside the organisation", async () => {
    const stored = { id: RECORD_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await deceasedRecordController.get(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(RECORD_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      serviceError("Deceased record not found.", 404) as never,
    );
    const res = buildResponse();

    await deceasedRecordController.get(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Deceased record not found.",
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.get.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await deceasedRecordController.get(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("deceasedRecordController.getByPatient", () => {
  it("looks the record up by patient", async () => {
    const stored = { id: RECORD_ID };
    service.getByPatient.mockResolvedValue(stored as never);
    const res = buildResponse();

    await deceasedRecordController.getByPatient(
      buildRequest({ params: { patientId: "pat-1" } }),
      res,
    );

    expect(service.getByPatient).toHaveBeenCalledWith("pat-1", ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("falls back to 500 for an error with no status", async () => {
    service.getByPatient.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await deceasedRecordController.getByPatient(
      buildRequest({ params: { patientId: "pat-1" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("deceasedRecordController.list", () => {
  it("forwards a recognised cause of death", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await deceasedRecordController.list(
      buildRequest({ query: { causeOfDeathType: "SURGICAL_COMPLICATION" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      causeOfDeathType: "SURGICAL_COMPLICATION",
    });
  });

  it("drops an unrecognised cause instead of rejecting the request", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await deceasedRecordController.list(
      buildRequest({ query: { causeOfDeathType: "OLD_AGE" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      causeOfDeathType: undefined,
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await deceasedRecordController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("deceasedRecordController.update", () => {
  it("coerces both timestamps when they are supplied", async () => {
    const stored = { id: RECORD_ID };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await deceasedRecordController.update(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: {
          deceasedAt: "2026-03-30T17:00:00.000Z",
          ownerNotifiedAt: "2026-03-30T19:00:00.000Z",
          bodyDisposition: "OWNER_COLLECTED",
        },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(RECORD_ID, ORG, {
      bodyDisposition: "OWNER_COLLECTED",
      deceasedAt: new Date("2026-03-30T17:00:00.000Z"),
      ownerNotifiedAt: new Date("2026-03-30T19:00:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves both timestamps undefined when neither is supplied", async () => {
    service.update.mockResolvedValue({ id: RECORD_ID } as never);
    const res = buildResponse();

    await deceasedRecordController.update(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { necropsyRequested: true },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(RECORD_ID, ORG, {
      necropsyRequested: true,
      deceasedAt: undefined,
      ownerNotifiedAt: undefined,
    });
  });

  it("rejects a non-positive body weight with 400", async () => {
    const res = buildResponse();

    await deceasedRecordController.update(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { bodyWeightKg: 0 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("passes a 404 through", async () => {
    service.update.mockRejectedValue(
      serviceError("Deceased record not found.", 404) as never,
    );
    const res = buildResponse();

    await deceasedRecordController.update(
      buildRequest({ params: { recordId: RECORD_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Deceased record not found.",
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.update.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await deceasedRecordController.update(
      buildRequest({ params: { recordId: RECORD_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});
