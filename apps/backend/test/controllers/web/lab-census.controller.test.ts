import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { LabCensusController } from "../../../src/controllers/web/lab-census.controller";
import { LabCensusService } from "../../../src/services/lab-census.service";
import { LabOrderServiceError } from "../../../src/services/lab-order.service";
import { mapAxiosError } from "../../../src/utils/external-error";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/services/lab-census.service", () => ({
  LabCensusService: {
    listIvlsDevices: jest.fn(),
    listCensus: jest.fn(),
    deleteCensus: jest.fn(),
    getCensusById: jest.fn(),
    deleteCensusById: jest.fn(),
    getCensusPatient: jest.fn(),
    addCensusPatient: jest.fn(),
    deleteCensusPatient: jest.fn(),
  },
}));

jest.mock("../../../src/utils/external-error", () => ({
  mapAxiosError: jest.fn(() => undefined),
}));
jest.mock("../../../src/utils/logger");

const mockedMapAxiosError = jest.mocked(mapAxiosError);
const mockedLogger = jest.mocked(logger);

describe("LabCensusController", () => {
  const mockedService = jest.mocked(LabCensusService);
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<Request>;
  let res: Response;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    req = {
      params: { organisationId: "org-1", provider: "idexx" },
      body: {},
      query: {},
    };
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
    jest.clearAllMocks();
  });

  it("returns structured lab mapping errors", async () => {
    mockedService.listIvlsDevices.mockRejectedValue(
      new LabOrderServiceError(
        "Missing IDEXX mapping for code CANISLF.",
        400,
        "DIAGNOSTIC_SPECIES_MAPPING_UNSUPPORTED",
        {
          provider: "IDEXX",
          field: "species",
          code: "CANISLF",
        },
      ),
    );

    await LabCensusController.listIvlsDevices(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Missing IDEXX mapping for code CANISLF.",
      error: {
        code: "DIAGNOSTIC_SPECIES_MAPPING_UNSUPPORTED",
        details: {
          provider: "IDEXX",
          field: "species",
          code: "CANISLF",
        },
      },
    });
  });

  it("returns 400 when organisationId is missing", async () => {
    req.params = { provider: "idexx" };

    await LabCensusController.listIvlsDevices(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "organisationId is required.",
    });
    expect(mockedService.listIvlsDevices).not.toHaveBeenCalled();
  });

  it("returns 400 when provider is missing", async () => {
    req.params = { organisationId: "org-1" };

    await LabCensusController.listIvlsDevices(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "provider is required." });
    expect(mockedService.listIvlsDevices).not.toHaveBeenCalled();
  });

  it("lists IVLS devices", async () => {
    (mockedService.listIvlsDevices as any).mockResolvedValue({ devices: [] });

    await LabCensusController.listIvlsDevices(req as Request, res);

    expect(mockedService.listIvlsDevices).toHaveBeenCalledWith(
      "idexx",
      "org-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ devices: [] });
  });

  it("maps axios errors from the upstream provider", async () => {
    (mockedService.listCensus as any).mockRejectedValue(new Error("boom"));
    mockedMapAxiosError.mockReturnValueOnce({
      status: 502,
      message: "IDEXX request failed",
      details: { upstream: true },
    });

    await LabCensusController.listCensus(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(502);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "IDEXX request failed",
      details: { upstream: true },
    });
  });

  it("lists census and maps unexpected errors to 500", async () => {
    (mockedService.listCensus as any).mockResolvedValue({ census: [] });

    await LabCensusController.listCensus(req as Request, res);

    expect(mockedService.listCensus).toHaveBeenCalledWith("idexx", "org-1");
    expect(jsonMock).toHaveBeenCalledWith({ census: [] });

    (mockedService.listCensus as any).mockRejectedValue(new Error("boom"));

    await LabCensusController.listCensus(req as Request, res);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "Failed to list census",
      expect.any(Error),
    );
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Failed to list census.",
    });
  });

  it("deletes the census", async () => {
    (mockedService.deleteCensus as any).mockResolvedValue({ ok: true });

    await LabCensusController.deleteCensus(req as Request, res);

    expect(mockedService.deleteCensus).toHaveBeenCalledWith("idexx", "org-1");
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("fetches a census by id and validates censusId", async () => {
    await LabCensusController.getCensusById(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "censusId is required." });

    req.params = { ...req.params, censusId: "census-1" };
    (mockedService.getCensusById as any).mockResolvedValue({ id: "census-1" });

    await LabCensusController.getCensusById(req as Request, res);

    expect(mockedService.getCensusById).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      "census-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("deletes a census by id", async () => {
    req.params = { ...req.params, censusId: "census-1" };
    (mockedService.deleteCensusById as any).mockResolvedValue({ ok: true });

    await LabCensusController.deleteCensusById(req as Request, res);

    expect(mockedService.deleteCensusById).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      "census-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("rejects census patient lookups without a patientId", async () => {
    req.method = "GET";

    await LabCensusController.getCensusPatient(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(405);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Use POST with patientId in request body.",
    });

    req.method = "POST";

    await LabCensusController.getCensusPatient(req as Request, res);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "patientId is required.",
    });
    expect(mockedService.getCensusPatient).not.toHaveBeenCalled();
  });

  it("fetches a census patient with a trimmed patientId", async () => {
    req.method = "POST";
    req.body = { patientId: " patient-1 " };
    (mockedService.getCensusPatient as any).mockResolvedValue({
      id: "patient-1",
    });

    await LabCensusController.getCensusPatient(req as Request, res);

    expect(mockedService.getCensusPatient).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      "patient-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("adds a census patient with normalized defaults", async () => {
    req.body = { patientId: "patient-1", ivls: [{ serialNumber: "S1" }] };
    (mockedService.addCensusPatient as any).mockResolvedValue({ ok: true });

    await LabCensusController.addCensusPatient(req as Request, res);

    expect(mockedService.addCensusPatient).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      {
        patientId: "patient-1",
        parentId: undefined,
        veterinarian: null,
        ivls: [{ serialNumber: "S1" }],
      },
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("deletes a census patient", async () => {
    req.params = { ...req.params, patientId: "patient-1" };
    (mockedService.deleteCensusPatient as any).mockResolvedValue({ ok: true });

    await LabCensusController.deleteCensusPatient(req as Request, res);

    expect(mockedService.deleteCensusPatient).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      "patient-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("prefers the organisation authorized by the middleware", async () => {
    req.params = { provider: "idexx" };
    (req as unknown as { organisationId: string }).organisationId = "org-mw";
    (mockedService.listIvlsDevices as any).mockResolvedValue({ devices: [] });

    await LabCensusController.listIvlsDevices(req as Request, res);

    expect(mockedService.listIvlsDevices).toHaveBeenCalledWith(
      "idexx",
      "org-mw",
    );
  });

  describe("guard rejections per handler", () => {
    const handlers = [
      ["listCensus", "listCensus"],
      ["deleteCensus", "deleteCensus"],
      ["getCensusById", "getCensusById"],
      ["deleteCensusById", "deleteCensusById"],
      ["getCensusPatient", "getCensusPatient"],
      ["addCensusPatient", "addCensusPatient"],
      ["deleteCensusPatient", "deleteCensusPatient"],
    ] as const;

    it.each(handlers)(
      "%s stops at the organisation guard",
      async (handler, serviceMethod) => {
        req.params = { provider: "idexx" };

        await (LabCensusController as any)[handler](req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(400);
        expect(jsonMock).toHaveBeenCalledWith({
          message: "organisationId is required.",
        });
        expect((mockedService as any)[serviceMethod]).not.toHaveBeenCalled();
      },
    );

    it("deleteCensusById requires a censusId", async () => {
      await LabCensusController.deleteCensusById(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "censusId is required.",
      });
      expect(mockedService.deleteCensusById).not.toHaveBeenCalled();
    });

    it("deleteCensusPatient requires a patientId", async () => {
      await LabCensusController.deleteCensusPatient(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "patientId is required.",
      });
      expect(mockedService.deleteCensusPatient).not.toHaveBeenCalled();
    });

    it("getCensusPatient rejects a body without a patientId string", async () => {
      req.method = "POST";
      req.body = undefined;

      await LabCensusController.getCensusPatient(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "patientId is required.",
      });

      req.body = { patientId: 42 };

      await LabCensusController.getCensusPatient(req as Request, res);

      expect(jsonMock).toHaveBeenLastCalledWith({
        message: "patientId is required.",
      });
      expect(mockedService.getCensusPatient).not.toHaveBeenCalled();
    });
  });

  describe("error mapping per handler", () => {
    const cases = [
      ["deleteCensus", "deleteCensus", "Failed to delete census."],
      ["getCensusById", "getCensusById", "Failed to fetch census by id."],
      [
        "deleteCensusById",
        "deleteCensusById",
        "Failed to delete census by id.",
      ],
      [
        "getCensusPatient",
        "getCensusPatient",
        "Failed to fetch census patient.",
      ],
      ["addCensusPatient", "addCensusPatient", "Failed to add census patient."],
      [
        "deleteCensusPatient",
        "deleteCensusPatient",
        "Failed to delete census patient.",
      ],
    ] as const;

    it.each(cases)(
      "%s maps unexpected errors to 500",
      async (handler, serviceMethod, message) => {
        req.params = {
          organisationId: "org-1",
          provider: "idexx",
          censusId: "census-1",
          patientId: "patient-1",
        };
        req.method = "POST";
        req.body = { patientId: "patient-1" };
        (mockedService as any)[serviceMethod].mockRejectedValue(
          new Error("boom"),
        );

        await (LabCensusController as any)[handler](req as Request, res);

        expect(statusMock).toHaveBeenCalledWith(500);
        expect(jsonMock).toHaveBeenCalledWith({ message });
      },
    );

    it("addCensusPatient maps upstream axios failures", async () => {
      req.body = { patientId: "patient-1" };
      (mockedService.addCensusPatient as any).mockRejectedValue(
        new Error("boom"),
      );
      mockedMapAxiosError.mockReturnValueOnce({
        status: 503,
        message: "IDEXX request failed",
        details: { retryable: true },
      });

      await LabCensusController.addCensusPatient(req as Request, res);

      expect(statusMock).toHaveBeenCalledWith(503);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "IDEXX request failed",
        details: { retryable: true },
      });
    });
  });

  it("adds a census patient forwarding every supplied field", async () => {
    req.body = {
      patientId: "patient-1",
      parentId: "parent-1",
      veterinarian: "Dr Vet",
      ivls: [{ serialNumber: "S1" }],
    };
    (mockedService.addCensusPatient as any).mockResolvedValue({ ok: true });

    await LabCensusController.addCensusPatient(req as Request, res);

    expect(mockedService.addCensusPatient).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      {
        patientId: "patient-1",
        parentId: "parent-1",
        veterinarian: "Dr Vet",
        ivls: [{ serialNumber: "S1" }],
      },
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ ok: true });
  });

  it("defaults a missing patientId to an empty string on add", async () => {
    req.body = {};
    (mockedService.addCensusPatient as any).mockResolvedValue({ ok: true });

    await LabCensusController.addCensusPatient(req as Request, res);

    expect(mockedService.addCensusPatient).toHaveBeenCalledWith(
      "idexx",
      "org-1",
      {
        patientId: "",
        parentId: undefined,
        veterinarian: null,
        ivls: undefined,
      },
    );
  });
});
