import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { ClinicalArtifactFhirController } from "../../src/controllers/web/clinical-artifact.fhir.controller";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "../../src/services/clinical-artifact.service";
import { clinicalArtifactFhirMapper } from "../../src/services/fhir-clinical-artifact.mapper";

jest.mock("../../src/services/clinical-artifact.service", () => {
  const actual = jest.requireActual(
    "../../src/services/clinical-artifact.service",
  ) as typeof import("../../src/services/clinical-artifact.service");

  return {
    ClinicalArtifactService: {
      createSoapNote: jest.fn(),
      updateSoapNote: jest.fn(),
      getSoapNote: jest.fn(),
      listSoapNotesForAppointment: jest.fn(),
      listSoapNotesForEncounter: jest.fn(),
      createPrescription: jest.fn(),
      updatePrescription: jest.fn(),
      getPrescription: jest.fn(),
      listPrescriptionsForAppointment: jest.fn(),
      listPrescriptionsForEncounter: jest.fn(),
      createDischargeSummary: jest.fn(),
      updateDischargeSummary: jest.fn(),
      getDischargeSummary: jest.fn(),
      listDischargeSummariesForAppointment: jest.fn(),
      listDischargeSummariesForEncounter: jest.fn(),
      createVitalRecord: jest.fn(),
      updateVitalRecord: jest.fn(),
      getVitalRecord: jest.fn(),
      listVitalRecordsForAppointment: jest.fn(),
      listVitalRecordsForEncounter: jest.fn(),
    },
    ClinicalArtifactServiceError: actual.ClinicalArtifactServiceError,
  };
});

jest.mock("../../src/services/fhir-clinical-artifact.mapper", () => ({
  clinicalArtifactFhirMapper: {
    soapNoteToComposition: jest.fn(),
    compositionToSoapNoteInput: jest.fn(),
    prescriptionToMedicationRequest: jest.fn(),
    medicationRequestToPrescriptionInput: jest.fn(),
    dischargeSummaryToComposition: jest.fn(),
    compositionToDischargeSummaryInput: jest.fn(),
    vitalRecordToObservation: jest.fn(),
    observationToVitalRecordInput: jest.fn(),
    bundles: {
      soapNotes: jest.fn(),
      prescriptions: jest.fn(),
      dischargeSummaries: jest.fn(),
      vitalRecords: jest.fn(),
    },
  },
}));

const mockedService = ClinicalArtifactService as jest.Mocked<
  typeof ClinicalArtifactService
>;
const mockedMapper = clinicalArtifactFhirMapper as jest.Mocked<
  typeof clinicalArtifactFhirMapper
>;

describe("ClinicalArtifactFhirController", () => {
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
        appointmentId: "appt-1",
        encounterId: "enc-1",
        soapNoteId: "soap-1",
        prescriptionId: "rx-1",
        dischargeSummaryId: "ds-1",
        vitalRecordId: "vital-1",
      },
      body: {},
      query: {},
      headers: {},
    };
    buildResponse();
  });

  it("handles SOAP note operations", async () => {
    mockedMapper.soapNoteToComposition.mockReturnValue({
      resourceType: "Composition",
    } as never);
    mockedMapper.compositionToSoapNoteInput.mockReturnValue({
      organisationId: "org-1",
    } as never);
    mockedMapper.bundles.soapNotes.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedService.listSoapNotesForAppointment.mockResolvedValueOnce([]);
    mockedService.listSoapNotesForEncounter.mockResolvedValueOnce([]);
    mockedService.createSoapNote.mockResolvedValueOnce({
      artifact: { id: "artifact-1" },
      soapNote: { id: "soap-1" },
    } as never);
    mockedService.getSoapNote.mockResolvedValueOnce({
      artifact: { id: "artifact-1" },
      soapNote: { id: "soap-1" },
    } as never);
    mockedService.updateSoapNote.mockResolvedValueOnce({
      artifact: { id: "artifact-1" },
      soapNote: { id: "soap-1" },
    } as never);

    await ClinicalArtifactFhirController.listSoapNotesForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listSoapNotesForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.createSoapNote(
      {
        ...req,
        body: { resourceType: "Composition", title: "SOAP summary" },
      } as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.getSoapNote(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.updateSoapNote(
      {
        ...req,
        body: { resourceType: "Composition", title: "SOAP summary" },
      } as Request,
      res as Response,
    );

    expect(mockedService.listSoapNotesForAppointment).toHaveBeenCalledWith(
      "org-1",
      "appt-1",
    );
    expect(mockedService.createSoapNote).toHaveBeenCalled();
    expect(mockedMapper.soapNoteToComposition).toHaveBeenCalledTimes(3);
    expect(statusMock).toHaveBeenCalledWith(201);
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("handles prescription operations", async () => {
    mockedMapper.prescriptionToMedicationRequest.mockReturnValue({
      resourceType: "MedicationRequest",
    } as never);
    mockedMapper.medicationRequestToPrescriptionInput.mockReturnValue({
      organisationId: "org-1",
    } as never);
    mockedMapper.bundles.prescriptions.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedService.listPrescriptionsForAppointment.mockResolvedValueOnce([]);
    mockedService.listPrescriptionsForEncounter.mockResolvedValueOnce([]);
    mockedService.createPrescription.mockResolvedValueOnce({
      artifact: { id: "artifact-2" },
      prescription: { id: "rx-1" },
    } as never);
    mockedService.getPrescription.mockResolvedValueOnce({
      artifact: { id: "artifact-2" },
      prescription: { id: "rx-1" },
    } as never);
    mockedService.updatePrescription.mockResolvedValueOnce({
      artifact: { id: "artifact-2" },
      prescription: { id: "rx-1" },
    } as never);

    await ClinicalArtifactFhirController.listPrescriptionsForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listPrescriptionsForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.createPrescription(
      {
        ...req,
        body: { resourceType: "MedicationRequest", intent: "order" },
      } as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.getPrescription(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.updatePrescription(
      {
        ...req,
        body: { resourceType: "MedicationRequest", intent: "order" },
      } as Request,
      res as Response,
    );

    expect(mockedService.createPrescription).toHaveBeenCalled();
    expect(mockedMapper.prescriptionToMedicationRequest).toHaveBeenCalledTimes(
      3,
    );
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it("handles discharge summary operations", async () => {
    mockedMapper.dischargeSummaryToComposition.mockReturnValue({
      resourceType: "Composition",
    } as never);
    mockedMapper.compositionToDischargeSummaryInput.mockReturnValue({
      organisationId: "org-1",
    } as never);
    mockedMapper.bundles.dischargeSummaries.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedService.listDischargeSummariesForAppointment.mockResolvedValueOnce(
      [],
    );
    mockedService.listDischargeSummariesForEncounter.mockResolvedValueOnce([]);
    mockedService.createDischargeSummary.mockResolvedValueOnce({
      artifact: { id: "artifact-3" },
      dischargeSummary: { id: "ds-1" },
    } as never);
    mockedService.getDischargeSummary.mockResolvedValueOnce({
      artifact: { id: "artifact-3" },
      dischargeSummary: { id: "ds-1" },
    } as never);
    mockedService.updateDischargeSummary.mockResolvedValueOnce({
      artifact: { id: "artifact-3" },
      dischargeSummary: { id: "ds-1" },
    } as never);

    await ClinicalArtifactFhirController.listDischargeSummariesForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listDischargeSummariesForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.createDischargeSummary(
      {
        ...req,
        body: { resourceType: "Composition", title: "Discharge summary" },
      } as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.getDischargeSummary(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.updateDischargeSummary(
      {
        ...req,
        body: { resourceType: "Composition", title: "Discharge summary" },
      } as Request,
      res as Response,
    );

    expect(mockedService.createDischargeSummary).toHaveBeenCalled();
    expect(mockedMapper.dischargeSummaryToComposition).toHaveBeenCalledTimes(3);
  });

  it("handles vital record operations", async () => {
    mockedMapper.vitalRecordToObservation.mockReturnValue({
      resourceType: "Observation",
    } as never);
    mockedMapper.observationToVitalRecordInput.mockReturnValue({
      organisationId: "org-1",
    } as never);
    mockedMapper.bundles.vitalRecords.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedService.listVitalRecordsForAppointment.mockResolvedValueOnce([]);
    mockedService.listVitalRecordsForEncounter.mockResolvedValueOnce([]);
    mockedService.createVitalRecord.mockResolvedValueOnce({
      artifact: { id: "artifact-4" },
      vitalRecord: { id: "vital-1" },
    } as never);
    mockedService.getVitalRecord.mockResolvedValueOnce({
      artifact: { id: "artifact-4" },
      vitalRecord: { id: "vital-1" },
    } as never);
    mockedService.updateVitalRecord.mockResolvedValueOnce({
      artifact: { id: "artifact-4" },
      vitalRecord: { id: "vital-1" },
    } as never);

    await ClinicalArtifactFhirController.listVitalRecordsForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listVitalRecordsForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.createVitalRecord(
      {
        ...req,
        body: { resourceType: "Observation", code: { text: "Vitals" } },
      } as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.getVitalRecord(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.updateVitalRecord(
      {
        ...req,
        body: { resourceType: "Observation", code: { text: "Vitals" } },
      } as Request,
      res as Response,
    );

    expect(mockedService.createVitalRecord).toHaveBeenCalled();
    expect(mockedMapper.vitalRecordToObservation).toHaveBeenCalledTimes(3);
  });

  it("returns validation and service errors", async () => {
    await ClinicalArtifactFhirController.createSoapNote(
      {
        ...req,
        body: { resourceType: "Observation" },
      } as Request,
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(400);

    mockedService.getSoapNote.mockRejectedValueOnce(
      new ClinicalArtifactServiceError("SOAP note not found", 404),
    );
    await ClinicalArtifactFhirController.getSoapNote(
      req as Request,
      res as Response,
    );
    expect(statusMock).toHaveBeenCalledWith(404);
  });
});
