import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { PatientFlagController } from "../../../src/controllers/web/patient-flag.controller";
import {
  PatientFlagService,
  PatientFlagError,
} from "../../../src/services/patient-flag.service";

jest.mock("../../../src/services/patient-flag.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/patient-flag.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    PatientFlagService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      resolve: jest.fn(),
    },
  };
});

const service = jest.mocked(PatientFlagService);

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
const FLAG_ID = "flag-1";

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

describe("PatientFlagController.create", () => {
  it("stamps the organisation from the route and answers 201", async () => {
    const stored = { id: FLAG_ID, isActive: true };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientFlagController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          flagType: "AGGRESSION",
          severity: "CRITICAL",
          title: "Muzzle required",
          description: "Bites during nail trims",
          createdBy: "user-1",
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      flagType: "AGGRESSION",
      severity: "CRITICAL",
      title: "Muzzle required",
      description: "Bites during nail trims",
      createdBy: "user-1",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects an unknown flag type with 400 and never calls the service", async () => {
    const res = buildResponse();

    await PatientFlagController.create(
      buildRequest({
        body: { patientId: "pat-1", flagType: "GRUMPY", title: "Careful" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await PatientFlagController.create(
      buildRequest({
        body: {
          patientId: "pat-1",
          flagType: "VIP",
          title: "Long-standing client",
        },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("PatientFlagController.get", () => {
  it("looks the flag up inside the organisation", async () => {
    const stored = { id: FLAG_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientFlagController.get(
      buildRequest({ params: { flagId: FLAG_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(FLAG_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through with the service message", async () => {
    service.get.mockRejectedValue(
      new PatientFlagError("Patient flag not found.", 404) as never,
    );
    const res = buildResponse();

    await PatientFlagController.get(
      buildRequest({ params: { flagId: FLAG_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Patient flag not found.",
    });
  });
});

describe("PatientFlagController.list", () => {
  it("forwards every filter and parses the active flag", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await PatientFlagController.list(
      buildRequest({
        query: {
          patientId: "pat-1",
          flagType: "QUARANTINE",
          severity: "HIGH",
          isActive: "true",
        },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: "pat-1",
      flagType: "QUARANTINE",
      severity: "HIGH",
      isActive: true,
    });
  });

  it("leaves every filter undefined when the query is empty", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await PatientFlagController.list(buildRequest(), res);

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      patientId: undefined,
      flagType: undefined,
      severity: undefined,
      isActive: undefined,
    });
  });

  it("hides an unexpected failure behind a 500", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await PatientFlagController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error." });
  });
});

describe("PatientFlagController.update", () => {
  it("forwards the validated changes", async () => {
    const stored = { id: FLAG_ID, severity: "LOW" };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientFlagController.update(
      buildRequest({
        params: { flagId: FLAG_ID },
        body: { severity: "LOW", description: "Settled with training" },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(FLAG_ID, ORG, {
      severity: "LOW",
      description: "Settled with training",
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a blank title with 400", async () => {
    const res = buildResponse();

    await PatientFlagController.update(
      buildRequest({ params: { flagId: FLAG_ID }, body: { title: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("passes the resolved-flag conflict through", async () => {
    service.update.mockRejectedValue(
      new PatientFlagError("Cannot update a resolved flag.", 409) as never,
    );
    const res = buildResponse();

    await PatientFlagController.update(
      buildRequest({ params: { flagId: FLAG_ID }, body: { severity: "LOW" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Cannot update a resolved flag.",
    });
  });
});

describe("PatientFlagController.resolve", () => {
  it("records who resolved the flag", async () => {
    const stored = { id: FLAG_ID, isActive: false };
    service.resolve.mockResolvedValue(stored as never);
    const res = buildResponse();

    await PatientFlagController.resolve(
      buildRequest({
        params: { flagId: FLAG_ID },
        body: { resolvedBy: "user-2" },
      }),
      res,
    );

    expect(service.resolve).toHaveBeenCalledWith(FLAG_ID, ORG, "user-2");
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("resolves without a named user when the body is empty", async () => {
    service.resolve.mockResolvedValue({ id: FLAG_ID } as never);
    const res = buildResponse();

    await PatientFlagController.resolve(
      buildRequest({ params: { flagId: FLAG_ID } }),
      res,
    );

    expect(service.resolve).toHaveBeenCalledWith(FLAG_ID, ORG, undefined);
  });

  it("passes the already-resolved conflict through", async () => {
    service.resolve.mockRejectedValue(
      new PatientFlagError("Flag is already resolved.", 409) as never,
    );
    const res = buildResponse();

    await PatientFlagController.resolve(
      buildRequest({ params: { flagId: FLAG_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Flag is already resolved.",
    });
  });
});
