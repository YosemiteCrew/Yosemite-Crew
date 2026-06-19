import { Request, Response } from "express";
import { PrescriptionController } from "../../src/controllers/web/prescription.controller";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "../../src/services/clinical-artifact.service";
import {
  InventoryConsumptionService,
  InventoryConsumptionServiceError,
} from "../../src/services/inventory-consumption.service";
import { clinicalArtifactFhirMapper } from "../../src/services/fhir-clinical-artifact.mapper";

jest.mock("../../src/services/clinical-artifact.service", () => ({
  ClinicalArtifactService: {
    getPrescription: jest.fn(),
  },
  ClinicalArtifactServiceError: class ClinicalArtifactServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "ClinicalArtifactServiceError";
    }
  },
}));

jest.mock("../../src/services/inventory-consumption.service", () => ({
  InventoryConsumptionService: {
    reservePrescription: jest.fn(),
    consumePrescription: jest.fn(),
    returnPrescription: jest.fn(),
    voidDispensePrescription: jest.fn(),
  },
  InventoryConsumptionServiceError: class InventoryConsumptionServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "InventoryConsumptionServiceError";
    }
  },
}));

jest.mock("../../src/services/fhir-clinical-artifact.mapper", () => ({
  clinicalArtifactFhirMapper: {
    prescriptionToMedicationRequest: jest.fn(),
  },
}));

const mockedClinicalService = ClinicalArtifactService as jest.Mocked<
  typeof ClinicalArtifactService
>;
const mockedInventoryService = InventoryConsumptionService as jest.Mocked<
  typeof InventoryConsumptionService
>;
const mockedMapper = clinicalArtifactFhirMapper as jest.Mocked<
  typeof clinicalArtifactFhirMapper
>;

describe("PrescriptionController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  const buildResponse = () => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });
    res = {
      status: statusMock,
      json: jsonMock,
    } as unknown as Response;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      params: {
        organisationId: "org-1",
        prescriptionId: "rx-1",
      },
      body: {},
      headers: {},
    };
    buildResponse();
    mockedClinicalService.getPrescription.mockResolvedValue({
      artifact: { id: "artifact-1" },
      prescription: { id: "rx-1", medications: [{ quantity: 1 }] },
    } as never);
    mockedMapper.prescriptionToMedicationRequest.mockReturnValue({
      resourceType: "MedicationRequest",
    } as never);
  });

  it("executes reserve, dispense, return, and void dispense actions", async () => {
    mockedInventoryService.reservePrescription.mockResolvedValueOnce([
      { id: "event-1" },
    ] as never);
    mockedInventoryService.consumePrescription.mockResolvedValueOnce([
      { id: "event-2" },
    ] as never);
    mockedInventoryService.returnPrescription.mockResolvedValueOnce([
      { id: "event-3" },
    ] as never);
    mockedInventoryService.voidDispensePrescription.mockResolvedValueOnce([
      { id: "event-4" },
    ] as never);

    await PrescriptionController.reserve(req as Request, res as Response);
    await PrescriptionController.dispense(req as Request, res as Response);
    await PrescriptionController.returnPrescription(
      req as Request,
      res as Response,
    );
    await PrescriptionController.voidDispense(req as Request, res as Response);

    expect(mockedInventoryService.reservePrescription).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      }),
    );
    expect(mockedInventoryService.consumePrescription).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      }),
    );
    expect(mockedInventoryService.returnPrescription).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      }),
    );
    expect(
      mockedInventoryService.voidDispensePrescription,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "VOID_DISPENSE",
        prescriptionId: "rx-1",
      }),
    );
  });

  it("returns service errors from the inventory layer", async () => {
    mockedInventoryService.consumePrescription.mockRejectedValueOnce(
      new InventoryConsumptionServiceError("Insufficient stock", 409),
    );

    await PrescriptionController.dispense(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Insufficient stock" });
  });

  it("returns clinical artifact errors before inventory actions", async () => {
    mockedClinicalService.getPrescription.mockRejectedValueOnce(
      new ClinicalArtifactServiceError("Prescription not found", 404),
    );

    await PrescriptionController.reserve(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Prescription not found",
    });
  });
});
