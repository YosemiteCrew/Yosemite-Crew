import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { AnaesthesiaRecordController } from "../../../src/controllers/web/anaesthesia-record.controller";
import {
  AnaesthesiaRecordService,
  AnaesthesiaRecordError,
} from "../../../src/services/anaesthesia-record.service";

jest.mock("../../../src/services/anaesthesia-record.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/anaesthesia-record.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    AnaesthesiaRecordService: {
      plan: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      start: jest.fn(),
      updateIntraOpNotes: jest.fn(),
      complete: jest.fn(),
      abort: jest.fn(),
    },
  };
});

const service = jest.mocked(AnaesthesiaRecordService);

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
const RECORD_ID = "anaes-1";

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
  }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("AnaesthesiaRecordController.plan", () => {
  it("stamps the organisation from the route and answers 201", async () => {
    const stored = { id: RECORD_ID, status: "PLANNED" };
    service.plan.mockResolvedValue(stored as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.plan(
      buildRequest({
        body: {
          patientId: "pat-1",
          encounterId: "enc-1",
          appointmentId: "appt-1",
          surgicalProcedureId: "proc-1",
          anaesthetistId: "vet-1",
          anesthesiaType: "GENERAL",
          inductionAgent: "Propofol",
          maintenanceAgent: "Isoflurane",
          oxygenFlowLpm: 1.5,
          preOpAssessment: "ASA II, hydrated",
          preMedications: { methadone: "0.3 mg/kg IM" },
        },
      }),
      res,
    );

    expect(service.plan).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      encounterId: "enc-1",
      appointmentId: "appt-1",
      surgicalProcedureId: "proc-1",
      anaesthetistId: "vet-1",
      anesthesiaType: "GENERAL",
      inductionAgent: "Propofol",
      maintenanceAgent: "Isoflurane",
      oxygenFlowLpm: 1.5,
      preOpAssessment: "ASA II, hydrated",
      preMedications: { methadone: "0.3 mg/kg IM" },
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("plans with only the patient when every other field is omitted", async () => {
    service.plan.mockResolvedValue({ id: RECORD_ID } as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.plan(
      buildRequest({ body: { patientId: "pat-1" } }),
      res,
    );

    expect(service.plan).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("rejects an unknown anaesthesia type with 400 and never calls the service", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.plan(
      buildRequest({
        body: { patientId: "pat-1", anesthesiaType: "HYPNOSIS" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    expect(service.plan).not.toHaveBeenCalled();
  });

  it("rejects a non-positive oxygen flow with 400", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.plan(
      buildRequest({ body: { patientId: "pat-1", oxygenFlowLpm: 0 } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.plan).not.toHaveBeenCalled();
  });

  it("rejects a missing patient with 400", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.plan(
      buildRequest({ body: { anesthesiaType: "LOCAL" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.plan).not.toHaveBeenCalled();
  });

  it("lets a service failure reach the error middleware instead of answering", async () => {
    service.plan.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await expect(
      AnaesthesiaRecordController.plan(
        buildRequest({ body: { patientId: "pat-1" } }),
        res,
      ),
    ).rejects.toThrow("db down");
    expect(res.json).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});

describe("AnaesthesiaRecordController.get", () => {
  it("looks the record up inside the organisation", async () => {
    const stored = { id: RECORD_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.get(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(RECORD_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the not-found error rather than answering 200", async () => {
    service.get.mockRejectedValue(
      new AnaesthesiaRecordError("Anaesthesia record not found.", 404) as never,
    );
    const res = buildResponse();

    await expect(
      AnaesthesiaRecordController.get(
        buildRequest({ params: { recordId: RECORD_ID } }),
        res,
      ),
    ).rejects.toMatchObject({
      message: "Anaesthesia record not found.",
      statusCode: 404,
    });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("AnaesthesiaRecordController.list", () => {
  it("forwards every recognised filter alongside the organisation", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.list(
      buildRequest({
        query: {
          patientId: "pat-1",
          appointmentId: "appt-1",
          status: "IN_PROGRESS",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      appointmentId: "appt-1",
      status: "IN_PROGRESS",
    });
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("passes only the organisation when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.list(buildRequest(), res);

    expect(service.list).toHaveBeenCalledWith({ organisationId: ORG });
  });

  it("rejects an unknown status with 400 and never calls the service", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.list(
      buildRequest({ query: { status: "RECOVERING" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    expect(service.list).not.toHaveBeenCalled();
  });
});

describe("AnaesthesiaRecordController.start", () => {
  it("starts the record scoped to the organisation", async () => {
    const stored = { id: RECORD_ID, status: "IN_PROGRESS" };
    service.start.mockResolvedValue(stored as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.start(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(service.start).toHaveBeenCalledWith(RECORD_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("propagates the terminal-status conflict", async () => {
    service.start.mockRejectedValue(
      new AnaesthesiaRecordError(
        "Cannot start anaesthesia with status COMPLETED.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      AnaesthesiaRecordController.start(
        buildRequest({ params: { recordId: RECORD_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("AnaesthesiaRecordController.updateIntraOpNotes", () => {
  it("unwraps the notes object before handing it to the service", async () => {
    const stored = { id: RECORD_ID };
    service.updateIntraOpNotes.mockResolvedValue(stored as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.updateIntraOpNotes(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { notes: { hr: 96, spo2: 98, temperature: 37.2 } },
      }),
      res,
    );

    expect(service.updateIntraOpNotes).toHaveBeenCalledWith(RECORD_ID, ORG, {
      hr: 96,
      spo2: 98,
      temperature: 37.2,
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a body with no notes key with 400", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.updateIntraOpNotes(
      buildRequest({ params: { recordId: RECORD_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.updateIntraOpNotes).not.toHaveBeenCalled();
  });

  it("rejects notes that are not an object with 400", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.updateIntraOpNotes(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { notes: "all stable" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.updateIntraOpNotes).not.toHaveBeenCalled();
  });

  it("propagates the not-in-progress conflict", async () => {
    service.updateIntraOpNotes.mockRejectedValue(
      new AnaesthesiaRecordError(
        "Intra-operative notes can only be updated during an active anaesthesia.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      AnaesthesiaRecordController.updateIntraOpNotes(
        buildRequest({
          params: { recordId: RECORD_ID },
          body: { notes: { hr: 96 } },
        }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe("AnaesthesiaRecordController.complete", () => {
  it("forwards the recovery payload", async () => {
    const stored = { id: RECORD_ID, status: "COMPLETED" };
    service.complete.mockResolvedValue(stored as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.complete(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: {
          complications: "Transient hypotension",
          recoveryNotes: "Extubated at 10:42, sternal by 10:55",
        },
      }),
      res,
    );

    expect(service.complete).toHaveBeenCalledWith(RECORD_ID, ORG, {
      complications: "Transient hypotension",
      recoveryNotes: "Extubated at 10:42, sternal by 10:55",
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("completes with an empty payload when nothing is reported", async () => {
    service.complete.mockResolvedValue({ id: RECORD_ID } as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.complete(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(service.complete).toHaveBeenCalledWith(RECORD_ID, ORG, {});
  });

  it("rejects non-string recovery notes with 400", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.complete(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { recoveryNotes: 42 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Array) });
    expect(service.complete).not.toHaveBeenCalled();
  });
});

describe("AnaesthesiaRecordController.abort", () => {
  it("unwraps the complications string", async () => {
    const stored = { id: RECORD_ID, status: "ABORTED" };
    service.abort.mockResolvedValue(stored as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.abort(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { complications: "Failed intubation" },
      }),
      res,
    );

    expect(service.abort).toHaveBeenCalledWith(
      RECORD_ID,
      ORG,
      "Failed intubation",
    );
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("aborts without complications when the body is empty", async () => {
    service.abort.mockResolvedValue({ id: RECORD_ID } as never);
    const res = buildResponse();

    await AnaesthesiaRecordController.abort(
      buildRequest({ params: { recordId: RECORD_ID } }),
      res,
    );

    expect(service.abort).toHaveBeenCalledWith(RECORD_ID, ORG, undefined);
  });

  it("rejects non-string complications with 400", async () => {
    const res = buildResponse();

    await AnaesthesiaRecordController.abort(
      buildRequest({
        params: { recordId: RECORD_ID },
        body: { complications: { code: 7 } },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.abort).not.toHaveBeenCalled();
  });

  it("propagates the terminal-status conflict", async () => {
    service.abort.mockRejectedValue(
      new AnaesthesiaRecordError(
        "Cannot abort anaesthesia with status ABORTED.",
        409,
      ) as never,
    );
    const res = buildResponse();

    await expect(
      AnaesthesiaRecordController.abort(
        buildRequest({ params: { recordId: RECORD_ID } }),
        res,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(res.json).not.toHaveBeenCalled();
  });
});
