import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { TreatmentOutcomeController } from "../../../src/controllers/web/treatment-outcome.controller";
import {
  TreatmentOutcomeService,
  TreatmentOutcomeError,
} from "../../../src/services/treatment-outcome.service";

jest.mock("../../../src/services/treatment-outcome.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/treatment-outcome.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    TreatmentOutcomeService: {
      record: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      resolve: jest.fn(),
    },
  };
});

const service = jest.mocked(TreatmentOutcomeService);

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
const OUTCOME_ID = "outcome-1";

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

describe("TreatmentOutcomeController.record", () => {
  it("coerces both dates and answers 201", async () => {
    const stored = { id: OUTCOME_ID };
    service.record.mockResolvedValue(stored as never);
    const res = buildResponse();

    await TreatmentOutcomeController.record(
      buildRequest({
        body: {
          patientId: "pat-1",
          encounterId: "enc-1",
          recordedAt: "2026-04-01T09:00:00.000Z",
          outcomeType: "IMPROVED",
          clinicalNotes: "Lameness reduced to grade 1",
          followUpDate: "2026-04-15T09:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.record).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      encounterId: "enc-1",
      outcomeType: "IMPROVED",
      clinicalNotes: "Lameness reduced to grade 1",
      recordedAt: new Date("2026-04-01T09:00:00.000Z"),
      followUpDate: new Date("2026-04-15T09:00:00.000Z"),
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("leaves the follow-up date undefined when none is booked", async () => {
    service.record.mockResolvedValue({ id: OUTCOME_ID } as never);
    const res = buildResponse();

    await TreatmentOutcomeController.record(
      buildRequest({
        body: {
          patientId: "pat-1",
          recordedAt: "2026-04-01T09:00:00.000Z",
          outcomeType: "RECOVERED",
        },
      }),
      res,
    );

    expect(service.record).toHaveBeenCalledWith(
      expect.objectContaining({ followUpDate: undefined }),
    );
  });

  it("rejects an unknown outcome type with 400 and never calls the service", async () => {
    const res = buildResponse();

    await TreatmentOutcomeController.record(
      buildRequest({
        body: {
          patientId: "pat-1",
          recordedAt: "2026-04-01T09:00:00.000Z",
          outcomeType: "CURED_BY_MAGIC",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ errors: expect.any(Array) });
    expect(service.record).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.record.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await TreatmentOutcomeController.record(
      buildRequest({
        body: {
          patientId: "pat-1",
          recordedAt: "2026-04-01T09:00:00.000Z",
          outcomeType: "ONGOING",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("TreatmentOutcomeController.get", () => {
  it("looks the outcome up inside the organisation", async () => {
    const stored = { id: OUTCOME_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await TreatmentOutcomeController.get(
      buildRequest({ params: { outcomeId: OUTCOME_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(OUTCOME_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      new TreatmentOutcomeError("Outcome not found.", 404) as never,
    );
    const res = buildResponse();

    await TreatmentOutcomeController.get(
      buildRequest({ params: { outcomeId: OUTCOME_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Outcome not found." });
  });
});

describe("TreatmentOutcomeController.list", () => {
  it("forwards a recognised outcome type and reads resolved=true", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await TreatmentOutcomeController.list(
      buildRequest({
        query: {
          patientId: "pat-1",
          encounterId: "enc-1",
          outcomeType: "STABLE",
          resolved: "true",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      encounterId: "enc-1",
      outcomeType: "STABLE",
      resolved: true,
    });
  });

  it("reads any other resolved value as false", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await TreatmentOutcomeController.list(
      buildRequest({ query: { resolved: "no" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ resolved: false }),
    );
  });

  it("leaves resolved undefined and drops an unknown outcome type", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await TreatmentOutcomeController.list(
      buildRequest({ query: { outcomeType: "MYSTERY" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: undefined,
      encounterId: undefined,
      outcomeType: undefined,
      resolved: undefined,
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await TreatmentOutcomeController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});

describe("TreatmentOutcomeController.update", () => {
  it("replaces the follow-up date when a new one is supplied", async () => {
    const stored = { id: OUTCOME_ID };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await TreatmentOutcomeController.update(
      buildRequest({
        params: { outcomeId: OUTCOME_ID },
        body: {
          outcomeType: "DETERIORATED",
          followUpDate: "2026-04-20T09:00:00.000Z",
        },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(OUTCOME_ID, ORG, {
      outcomeType: "DETERIORATED",
      followUpDate: new Date("2026-04-20T09:00:00.000Z"),
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("clears the stored follow-up date when null is sent", async () => {
    service.update.mockResolvedValue({ id: OUTCOME_ID } as never);
    const res = buildResponse();

    await TreatmentOutcomeController.update(
      buildRequest({
        params: { outcomeId: OUTCOME_ID },
        body: { followUpDate: null },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(OUTCOME_ID, ORG, {
      followUpDate: null,
    });
  });

  it("leaves the stored follow-up date untouched when the key is absent", async () => {
    service.update.mockResolvedValue({ id: OUTCOME_ID } as never);
    const res = buildResponse();

    await TreatmentOutcomeController.update(
      buildRequest({
        params: { outcomeId: OUTCOME_ID },
        body: { resolved: true },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(OUTCOME_ID, ORG, {
      resolved: true,
      followUpDate: undefined,
    });
  });

  it("rejects a non-boolean resolved flag with 400", async () => {
    const res = buildResponse();

    await TreatmentOutcomeController.update(
      buildRequest({
        params: { outcomeId: OUTCOME_ID },
        body: { resolved: "yes" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("passes a 404 through", async () => {
    service.update.mockRejectedValue(
      new TreatmentOutcomeError("Outcome not found.", 404) as never,
    );
    const res = buildResponse();

    await TreatmentOutcomeController.update(
      buildRequest({ params: { outcomeId: OUTCOME_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Outcome not found." });
  });
});

describe("TreatmentOutcomeController.resolve", () => {
  it("resolves the outcome", async () => {
    const stored = { id: OUTCOME_ID, resolved: true };
    service.resolve.mockResolvedValue(stored as never);
    const res = buildResponse();

    await TreatmentOutcomeController.resolve(
      buildRequest({ params: { outcomeId: OUTCOME_ID } }),
      res,
    );

    expect(service.resolve).toHaveBeenCalledWith(OUTCOME_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.resolve.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await TreatmentOutcomeController.resolve(
      buildRequest({ params: { outcomeId: OUTCOME_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ message: "Internal server error" });
  });
});
