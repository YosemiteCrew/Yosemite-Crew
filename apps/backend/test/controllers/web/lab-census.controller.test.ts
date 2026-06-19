import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Request, Response } from "express";
import { LabCensusController } from "../../../src/controllers/web/lab-census.controller";
import { LabCensusService } from "../../../src/services/lab-census.service";
import { LabOrderServiceError } from "../../../src/services/lab-order.service";

jest.mock("../../../src/services/lab-census.service", () => ({
  LabCensusService: {
    listIvlsDevices: jest.fn(),
    listCensus: jest.fn(),
    deleteCensus: jest.fn(),
    getCensusById: jest.fn(),
    deleteCensusById: jest.fn(),
    getCensusPatient: jest.fn(),
    addCensusPatient: jest.fn(),
  },
}));

jest.mock("../../../src/utils/external-error", () => ({
  mapAxiosError: jest.fn(() => undefined),
}));

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
});
