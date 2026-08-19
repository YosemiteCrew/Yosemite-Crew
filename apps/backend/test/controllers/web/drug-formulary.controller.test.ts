import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { Request, Response } from "express";
import { drugFormularyController } from "../../../src/controllers/web/drug-formulary.controller";
import { DrugFormularyService } from "../../../src/services/drug-formulary.service";

jest.mock("../../../src/services/drug-formulary.service", () => {
  const actual = jest.requireActual(
    "../../../src/services/drug-formulary.service",
  ) as Record<string, unknown>;
  return {
    ...actual,
    DrugFormularyService: {
      create: jest.fn(),
      get: jest.fn(),
      list: jest.fn(),
      update: jest.fn(),
      addDosage: jest.fn(),
      removeDosage: jest.fn(),
      delete: jest.fn(),
    },
  };
});

const service = jest.mocked(DrugFormularyService);

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
const FORMULARY_ID = "formulary-1";
const USER_ID = "user-1";

const buildRequest = (
  overrides: Partial<{
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: unknown;
    userId: string;
  }> = {},
): Request =>
  ({
    params: { organisationId: ORG, ...(overrides.params ?? {}) },
    query: overrides.query ?? {},
    body: overrides.body ?? {},
    userId: "userId" in overrides ? overrides.userId : USER_ID,
  }) as unknown as Request;

/** The service throws plain objects carrying a statusCode, not a class. */
const serviceError = (message: string, statusCode: number) =>
  Object.assign(new Error(message), { statusCode });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("drugFormularyController.create", () => {
  it("stamps the organisation and session user, then answers 201", async () => {
    const stored = { id: FORMULARY_ID };
    service.create.mockResolvedValue(stored as never);
    const res = buildResponse();

    await drugFormularyController.create(
      buildRequest({
        body: {
          drugName: "Meloxicam",
          genericName: "meloxicam",
          category: "ANALGESIC",
          availableUnits: ["1.5mg/ml"],
          dosageEntries: [
            {
              species: "CANINE",
              doseMin: 0.1,
              doseMax: 0.2,
              doseUnit: "mg/kg",
            },
          ],
        },
      }),
      res,
    );

    expect(service.create).toHaveBeenCalledWith({
      organisationId: ORG,
      drugName: "Meloxicam",
      genericName: "meloxicam",
      category: "ANALGESIC",
      availableUnits: ["1.5mg/ml"],
      dosageEntries: [
        { species: "CANINE", doseMin: 0.1, doseMax: 0.2, doseUnit: "mg/kg" },
      ],
      createdBy: USER_ID,
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a blank drug name with 400 and never calls the service", async () => {
    const res = buildResponse();

    await drugFormularyController.create(
      buildRequest({ body: { drugName: "" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: expect.any(Object) });
    expect(service.create).not.toHaveBeenCalled();
  });

  it("uses the status the service error carries", async () => {
    service.create.mockRejectedValue(
      serviceError("Drug already in the formulary.", 409) as never,
    );
    const res = buildResponse();

    await drugFormularyController.create(
      buildRequest({ body: { drugName: "Meloxicam" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: "Drug already in the formulary.",
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.create.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.create(
      buildRequest({ body: { drugName: "Meloxicam" } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("drugFormularyController.get", () => {
  it("looks the entry up inside the organisation", async () => {
    const stored = { id: FORMULARY_ID };
    service.get.mockResolvedValue(stored as never);
    const res = buildResponse();

    await drugFormularyController.get(
      buildRequest({ params: { formularyId: FORMULARY_ID } }),
      res,
    );

    expect(service.get).toHaveBeenCalledWith(FORMULARY_ID, ORG);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("passes a 404 through", async () => {
    service.get.mockRejectedValue(
      serviceError("Formulary entry not found.", 404) as never,
    );
    const res = buildResponse();

    await drugFormularyController.get(
      buildRequest({ params: { formularyId: FORMULARY_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Formulary entry not found.",
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.get.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.get(
      buildRequest({ params: { formularyId: FORMULARY_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("drugFormularyController.list", () => {
  it("forwards a recognised category, the active flag and the search term", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await drugFormularyController.list(
      buildRequest({
        query: { category: "ANTIBIOTIC", isActive: "true", search: "amox" },
      }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      category: "ANTIBIOTIC",
      isActive: true,
      search: "amox",
    });
  });

  it("drops an unrecognised category instead of rejecting the request", async () => {
    service.list.mockResolvedValue([] as never);
    const res = buildResponse();

    await drugFormularyController.list(
      buildRequest({ query: { category: "SNACKS" } }),
      res,
    );

    expect(service.list).toHaveBeenCalledWith({
      organisationId: ORG,
      category: undefined,
      isActive: undefined,
      search: undefined,
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.list.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.list(buildRequest(), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("drugFormularyController.update", () => {
  it("forwards the validated changes", async () => {
    const stored = { id: FORMULARY_ID, isActive: false };
    service.update.mockResolvedValue(stored as never);
    const res = buildResponse();

    await drugFormularyController.update(
      buildRequest({
        params: { formularyId: FORMULARY_ID },
        body: { isActive: false, manufacturer: "Boehringer" },
      }),
      res,
    );

    expect(service.update).toHaveBeenCalledWith(FORMULARY_ID, ORG, {
      isActive: false,
      manufacturer: "Boehringer",
    });
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a blank drug name with 400", async () => {
    const res = buildResponse();

    await drugFormularyController.update(
      buildRequest({
        params: { formularyId: FORMULARY_ID },
        body: { drugName: "" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.update).not.toHaveBeenCalled();
  });

  it("passes a 404 through", async () => {
    service.update.mockRejectedValue(
      serviceError("Formulary entry not found.", 404) as never,
    );
    const res = buildResponse();

    await drugFormularyController.update(
      buildRequest({ params: { formularyId: FORMULARY_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "Formulary entry not found.",
    });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.update.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.update(
      buildRequest({ params: { formularyId: FORMULARY_ID }, body: {} }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("drugFormularyController.addDosage", () => {
  it("answers 201 with the stored dosage row", async () => {
    const stored = { id: "dosage-1" };
    service.addDosage.mockResolvedValue(stored as never);
    const res = buildResponse();

    await drugFormularyController.addDosage(
      buildRequest({
        params: { formularyId: FORMULARY_ID },
        body: {
          species: "FELINE",
          indication: "Post-op analgesia",
          doseMin: 0.05,
          doseUnit: "mg/kg",
          route: "SC",
        },
      }),
      res,
    );

    expect(service.addDosage).toHaveBeenCalledWith(FORMULARY_ID, ORG, {
      species: "FELINE",
      indication: "Post-op analgesia",
      doseMin: 0.05,
      doseUnit: "mg/kg",
      route: "SC",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(stored);
  });

  it("rejects a dosage row with no species", async () => {
    const res = buildResponse();

    await drugFormularyController.addDosage(
      buildRequest({
        params: { formularyId: FORMULARY_ID },
        body: { doseMin: 0.05 },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(service.addDosage).not.toHaveBeenCalled();
  });

  it("falls back to 500 for an error with no status", async () => {
    service.addDosage.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.addDosage(
      buildRequest({
        params: { formularyId: FORMULARY_ID },
        body: { species: "CANINE" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("drugFormularyController.removeDosage", () => {
  it("answers 204 with no body", async () => {
    service.removeDosage.mockResolvedValue(undefined as never);
    const res = buildResponse();

    await drugFormularyController.removeDosage(
      buildRequest({
        params: { formularyId: FORMULARY_ID, dosageId: "dosage-1" },
      }),
      res,
    );

    expect(service.removeDosage).toHaveBeenCalledWith(
      FORMULARY_ID,
      "dosage-1",
      ORG,
    );
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });

  it("passes a 404 through", async () => {
    service.removeDosage.mockRejectedValue(
      serviceError("Dosage not found.", 404) as never,
    );
    const res = buildResponse();

    await drugFormularyController.removeDosage(
      buildRequest({
        params: { formularyId: FORMULARY_ID, dosageId: "dosage-1" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Dosage not found." });
  });

  it("falls back to 500 for an error with no status", async () => {
    service.removeDosage.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.removeDosage(
      buildRequest({
        params: { formularyId: FORMULARY_ID, dosageId: "dosage-1" },
      }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});

describe("drugFormularyController.delete", () => {
  it("answers 204 with no body", async () => {
    service.delete.mockResolvedValue(undefined as never);
    const res = buildResponse();

    await drugFormularyController.delete(
      buildRequest({ params: { formularyId: FORMULARY_ID } }),
      res,
    );

    expect(service.delete).toHaveBeenCalledWith(FORMULARY_ID, ORG);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledWith();
  });

  it("falls back to 500 for an error with no status", async () => {
    service.delete.mockRejectedValue(new Error("db down") as never);
    const res = buildResponse();

    await drugFormularyController.delete(
      buildRequest({ params: { formularyId: FORMULARY_ID } }),
      res,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "db down" });
  });
});
