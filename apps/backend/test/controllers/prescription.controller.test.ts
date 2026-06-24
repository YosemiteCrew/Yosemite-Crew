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
import { renderPrescriptionLabelPdf } from "../../src/services/rendered-document-renderer.service";

jest.mock("../../src/services/clinical-artifact.service", () => ({
  ClinicalArtifactService: {
    getPrescription: jest.fn(),
    finalizePrescription: jest.fn(),
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
    listPrescriptionDispenseRequests: jest.fn(),
    getPrescriptionDispenseRequest: jest.fn(),
    reservePrescription: jest.fn(),
    approvePrescriptionDispenseRequest: jest.fn(),
    markPrescriptionDispenseRequestNotDispensed: jest.fn(),
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

jest.mock("../../src/services/rendered-document-renderer.service", () => ({
  renderPrescriptionLabelPdf: jest.fn(),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
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
const mockedRenderLabelPdf = renderPrescriptionLabelPdf as jest.Mock;

describe("PrescriptionController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;
  let sendMock: jest.Mock;
  let setHeaderMock: jest.Mock;

  const buildResponse = () => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    setHeaderMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
      setHeader: setHeaderMock,
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
    mockedInventoryService.approvePrescriptionDispenseRequest.mockResolvedValueOnce(
      [{ id: "event-2" }] as never,
    );
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
    expect(
      mockedInventoryService.approvePrescriptionDispenseRequest,
    ).toHaveBeenCalledWith(
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

  it("finalizes a prescription", async () => {
    mockedClinicalService.finalizePrescription.mockResolvedValueOnce({
      artifact: { id: "artifact-1" },
      prescription: { id: "rx-1", medications: [{ quantity: 1 }] },
    } as never);

    await PrescriptionController.finalize(req as Request, res as Response);

    expect(mockedClinicalService.finalizePrescription).toHaveBeenCalledWith(
      "rx-1",
      "org-1",
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: "MedicationRequest",
      }),
    );
  });

  it("lists dispense requests for an organisation", async () => {
    mockedInventoryService.listPrescriptionDispenseRequests.mockResolvedValueOnce(
      [
        {
          id: "request-1",
          organisationId: "org-1",
          prescriptionId: "rx-1",
          status: "PENDING",
          medications: [],
          metadata: null,
          requestedBy: null,
          reviewedBy: null,
          requestedAt: new Date("2026-01-01T00:00:00.000Z"),
          reviewedAt: null,
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
          updatedAt: new Date("2026-01-01T00:00:00.000Z"),
          prescription: {
            id: "rx-1",
            artifactId: "artifact-1",
            artifact: { id: "artifact-1" },
          },
        },
      ] as never,
    );

    await PrescriptionController.listDispenseRequests(
      req as Request,
      res as Response,
    );

    expect(
      mockedInventoryService.listPrescriptionDispenseRequests,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: "request-1",
          status: "PENDING",
        }),
      ]),
    );
  });

  it("gets a dispense request by id", async () => {
    mockedInventoryService.getPrescriptionDispenseRequest.mockResolvedValueOnce(
      {
        id: "request-2",
        organisationId: "org-1",
        prescriptionId: "rx-1",
        status: "DISPENSED",
        medications: [],
        metadata: null,
        requestedBy: null,
        reviewedBy: "user-1",
        requestedAt: new Date("2026-01-01T00:00:00.000Z"),
        reviewedAt: new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        prescription: {
          id: "rx-1",
          artifactId: "artifact-1",
          artifact: { id: "artifact-1" },
        },
      } as never,
    );

    req.params = {
      organisationId: "org-1",
      dispenseRequestId: "request-2",
    };

    await PrescriptionController.getDispenseRequest(
      req as Request,
      res as Response,
    );

    expect(
      mockedInventoryService.getPrescriptionDispenseRequest,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        dispenseRequestId: "request-2",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "request-2",
        status: "DISPENSED",
      }),
    );
  });

  it("returns service errors from the inventory layer", async () => {
    mockedInventoryService.approvePrescriptionDispenseRequest.mockRejectedValueOnce(
      new InventoryConsumptionServiceError("Insufficient stock", 409),
    );

    await PrescriptionController.dispense(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(409);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Insufficient stock" });
  });

  it("marks a prescription as not dispensed", async () => {
    mockedInventoryService.markPrescriptionDispenseRequestNotDispensed.mockResolvedValueOnce(
      null as never,
    );

    await PrescriptionController.notDispensed(req as Request, res as Response);

    expect(
      mockedInventoryService.markPrescriptionDispenseRequestNotDispensed,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      }),
    );
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "NOT_DISPENSED",
        prescriptionId: "rx-1",
      }),
    );
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

  it("streams a prescription label PDF", async () => {
    const pdf = Buffer.from("%PDF-label");
    mockedRenderLabelPdf.mockResolvedValueOnce(pdf);

    await PrescriptionController.generateLabelPdf(
      req as Request,
      res as Response,
    );

    expect(mockedRenderLabelPdf).toHaveBeenCalledWith({
      organisationId: "org-1",
      prescriptionId: "rx-1",
    });
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Type",
      "application/pdf",
    );
    // The sensitive label response must not be cached by browsers or shared proxies.
    expect(setHeaderMock).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Disposition",
      'inline; filename="prescription-label-rx-1.pdf"',
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(sendMock).toHaveBeenCalledWith(pdf);
  });

  it("streams a prescription label PDF via the labels endpoint alias", async () => {
    const pdf = Buffer.from("%PDF-label");
    mockedRenderLabelPdf.mockResolvedValueOnce(pdf);

    await PrescriptionController.generateLabels(
      req as Request,
      res as Response,
    );

    expect(mockedRenderLabelPdf).toHaveBeenCalledWith({
      organisationId: "org-1",
      prescriptionId: "rx-1",
    });
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Type",
      "application/pdf",
    );
    expect(setHeaderMock).toHaveBeenCalledWith("Cache-Control", "no-store");
    expect(setHeaderMock).toHaveBeenCalledWith(
      "Content-Disposition",
      'inline; filename="prescription-label-rx-1.pdf"',
    );
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(sendMock).toHaveBeenCalledWith(pdf);
  });

  it("returns 404 when the prescription label is not found", async () => {
    mockedRenderLabelPdf.mockRejectedValueOnce(
      new Error("Prescription not found"),
    );

    await PrescriptionController.generateLabelPdf(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Prescription not found",
    });
  });

  it("returns 400 for an invalid prescription label request", async () => {
    req.params = { organisationId: "org-1", prescriptionId: "" };

    await PrescriptionController.generateLabelPdf(
      req as Request,
      res as Response,
    );

    expect(mockedRenderLabelPdf).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Invalid prescription label request.",
    });
  });

  it("returns 500 when label rendering fails unexpectedly", async () => {
    mockedRenderLabelPdf.mockRejectedValueOnce(new Error("boom"));

    await PrescriptionController.generateLabelPdf(
      req as Request,
      res as Response,
    );

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      message: "Failed to generate prescription label PDF.",
    });
  });
});
