import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Request, Response } from "express";
import { ClinicalArtifactFhirController } from "../../src/controllers/web/clinical-artifact.fhir.controller";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "../../src/services/clinical-artifact.service";
import { clinicalArtifactFhirMapper } from "../../src/services/fhir-clinical-artifact.mapper";
import logger from "../../src/utils/logger";

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
      finalizeSoapNote: jest.fn(),
      reopenSoapNote: jest.fn(),
      amendSoapNote: jest.fn(),
      createPrescription: jest.fn(),
      updatePrescription: jest.fn(),
      getPrescription: jest.fn(),
      listPrescriptionsForAppointment: jest.fn(),
      listPrescriptionsForEncounter: jest.fn(),
      finalizePrescription: jest.fn(),
      reopenPrescription: jest.fn(),
      amendPrescription: jest.fn(),
      deletePrescription: jest.fn(),
      cancelPrescription: jest.fn(),
      createDischargeSummary: jest.fn(),
      updateDischargeSummary: jest.fn(),
      getDischargeSummary: jest.fn(),
      listDischargeSummariesForAppointment: jest.fn(),
      listDischargeSummariesForEncounter: jest.fn(),
      finalizeDischargeSummary: jest.fn(),
      reopenDischargeSummary: jest.fn(),
      amendDischargeSummary: jest.fn(),
      createVitalRecord: jest.fn(),
      updateVitalRecord: jest.fn(),
      getVitalRecord: jest.fn(),
      listVitalRecordsForAppointment: jest.fn(),
      listVitalRecordsForEncounter: jest.fn(),
      finalizeVitalRecord: jest.fn(),
      reopenVitalRecord: jest.fn(),
      amendVitalRecord: jest.fn(),
      listImmunizationsForAppointment: jest.fn(),
      listImmunizationsForEncounter: jest.fn(),
      listRabiesTitrationsForAppointment: jest.fn(),
      listRabiesTitrationsForEncounter: jest.fn(),
      listParasiteTreatmentsForAppointment: jest.fn(),
      listParasiteTreatmentsForEncounter: jest.fn(),
      listClinicalExaminationsForAppointment: jest.fn(),
      listClinicalExaminationsForEncounter: jest.fn(),
    },
    ClinicalArtifactServiceError: actual.ClinicalArtifactServiceError,
  };
});

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

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
      immunizations: jest.fn(),
      rabiesTitrations: jest.fn(),
      parasiteTreatments: jest.fn(),
      clinicalExaminations: jest.fn(),
    },
  },
}));

const mockedService = ClinicalArtifactService as jest.Mocked<
  typeof ClinicalArtifactService
>;
const mockedMapper = clinicalArtifactFhirMapper as jest.Mocked<
  typeof clinicalArtifactFhirMapper
>;

/**
 * The service and mapper doubles are declared as bare `jest.fn()`s, so Jest
 * resolves the argument of `mockResolvedValueOnce`/`mockRejectedValueOnce` to
 * `never`. The tables below drive them through a deliberately loose spy shape
 * instead of sprinkling `as never` over every stubbed value.
 */
type LooseSpy = {
  (...args: unknown[]): unknown;
  mockReturnValue: (value: unknown) => LooseSpy;
  mockResolvedValueOnce: (value: unknown) => LooseSpy;
  mockRejectedValueOnce: (value: unknown) => LooseSpy;
};

const asSpy = (value: unknown) => value as unknown as LooseSpy;

describe("ClinicalArtifactFhirController", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let jsonMock: jest.Mock;
  let sendMock: jest.Mock;
  let statusMock: jest.Mock;

  const buildResponse = () => {
    jsonMock = jest.fn();
    sendMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, send: sendMock });
    res = {
      status: statusMock,
      json: jsonMock,
      send: sendMock,
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
      status: "COMPLETED",
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
    expect(mockedService.createSoapNote).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
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
      status: "COMPLETED",
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
    mockedService.cancelPrescription.mockResolvedValueOnce({
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
    await ClinicalArtifactFhirController.deletePrescription(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.cancelPrescription(
      req as Request,
      res as Response,
    );

    expect(mockedService.createPrescription).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
    expect(mockedMapper.prescriptionToMedicationRequest).toHaveBeenCalledTimes(
      4,
    );
    expect(mockedService.cancelPrescription).toHaveBeenCalledWith(
      "rx-1",
      "org-1",
      { actorId: "", canEditAny: false },
    );
    expect(statusMock).toHaveBeenCalledWith(201);
    expect(statusMock).toHaveBeenCalledWith(204);
  });

  it("handles discharge summary operations", async () => {
    mockedMapper.dischargeSummaryToComposition.mockReturnValue({
      resourceType: "Composition",
    } as never);
    mockedMapper.compositionToDischargeSummaryInput.mockReturnValue({
      organisationId: "org-1",
      status: "COMPLETED",
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

    expect(mockedService.createDischargeSummary).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
    expect(mockedMapper.dischargeSummaryToComposition).toHaveBeenCalledTimes(3);
  });

  it("handles vital record operations", async () => {
    mockedMapper.vitalRecordToObservation.mockReturnValue({
      resourceType: "Observation",
    } as never);
    mockedMapper.observationToVitalRecordInput.mockReturnValue({
      organisationId: "org-1",
      status: "COMPLETED",
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
        body: {
          resourceType: "Observation",
          code: { text: "Vitals" },
          performer: [
            {
              reference: "Practitioner/nurse-1",
              display: "Nurse Joy",
            },
          ],
        },
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
        body: {
          resourceType: "Observation",
          code: { text: "Vitals" },
          performer: [
            {
              reference: "Practitioner/nurse-1",
              display: "Nurse Joy",
            },
          ],
        },
      } as Request,
      res as Response,
    );

    expect(mockedService.createVitalRecord).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" }),
    );
    const firstVitalCall =
      mockedMapper.observationToVitalRecordInput.mock.calls[0];
    expect(firstVitalCall?.[0]).toEqual(
      expect.objectContaining({
        resourceType: "Observation",
        performer: [
          expect.objectContaining({
            reference: "Practitioner/nurse-1",
            display: "Nurse Joy",
          }),
        ],
      }),
    );
    expect(firstVitalCall?.[1]).toEqual(
      expect.objectContaining({
        organisationId: "org-1",
        recordedByDisplay: "Nurse Joy",
      }),
    );
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

  it("handles passport clinical-record FHIR reads for all kinds", async () => {
    mockedMapper.bundles.immunizations.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedMapper.bundles.rabiesTitrations.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedMapper.bundles.parasiteTreatments.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedMapper.bundles.clinicalExaminations.mockReturnValue({
      resourceType: "Bundle",
    } as never);
    mockedService.listImmunizationsForAppointment.mockResolvedValueOnce([]);
    mockedService.listImmunizationsForEncounter.mockResolvedValueOnce([]);
    mockedService.listRabiesTitrationsForAppointment.mockResolvedValueOnce([]);
    mockedService.listRabiesTitrationsForEncounter.mockResolvedValueOnce([]);
    mockedService.listParasiteTreatmentsForAppointment.mockResolvedValueOnce(
      [],
    );
    mockedService.listParasiteTreatmentsForEncounter.mockResolvedValueOnce([]);
    mockedService.listClinicalExaminationsForAppointment.mockResolvedValueOnce(
      [],
    );
    mockedService.listClinicalExaminationsForEncounter.mockResolvedValueOnce(
      [],
    );

    await ClinicalArtifactFhirController.listImmunizationsForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listImmunizationsForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listRabiesTitrationsForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listRabiesTitrationsForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listParasiteTreatmentsForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listParasiteTreatmentsForEncounter(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listClinicalExaminationsForAppointment(
      req as Request,
      res as Response,
    );
    await ClinicalArtifactFhirController.listClinicalExaminationsForEncounter(
      req as Request,
      res as Response,
    );

    expect(mockedService.listImmunizationsForAppointment).toHaveBeenCalledWith(
      "org-1",
      "appt-1",
    );
    expect(mockedService.listImmunizationsForEncounter).toHaveBeenCalledWith(
      "org-1",
      "enc-1",
    );
    expect(
      mockedService.listClinicalExaminationsForEncounter,
    ).toHaveBeenCalledWith("org-1", "enc-1");
    expect(mockedMapper.bundles.immunizations).toHaveBeenCalled();
    expect(mockedMapper.bundles.rabiesTitrations).toHaveBeenCalled();
    expect(mockedMapper.bundles.parasiteTreatments).toHaveBeenCalled();
    expect(mockedMapper.bundles.clinicalExaminations).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("propagates errors from every passport clinical-record read", async () => {
    const reads = [
      [
        "listImmunizationsForAppointment",
        ClinicalArtifactFhirController.listImmunizationsForAppointment,
      ],
      [
        "listImmunizationsForEncounter",
        ClinicalArtifactFhirController.listImmunizationsForEncounter,
      ],
      [
        "listRabiesTitrationsForAppointment",
        ClinicalArtifactFhirController.listRabiesTitrationsForAppointment,
      ],
      [
        "listRabiesTitrationsForEncounter",
        ClinicalArtifactFhirController.listRabiesTitrationsForEncounter,
      ],
      [
        "listParasiteTreatmentsForAppointment",
        ClinicalArtifactFhirController.listParasiteTreatmentsForAppointment,
      ],
      [
        "listParasiteTreatmentsForEncounter",
        ClinicalArtifactFhirController.listParasiteTreatmentsForEncounter,
      ],
      [
        "listClinicalExaminationsForAppointment",
        ClinicalArtifactFhirController.listClinicalExaminationsForAppointment,
      ],
      [
        "listClinicalExaminationsForEncounter",
        ClinicalArtifactFhirController.listClinicalExaminationsForEncounter,
      ],
    ] as const;

    for (const [name, handler] of reads) {
      (mockedService[name] as jest.Mock).mockRejectedValueOnce(
        new ClinicalArtifactServiceError(
          "organisationId is required",
          400,
        ) as never,
      );
      buildResponse();
      await handler(req as Request, res as Response);
      expect(statusMock).toHaveBeenCalledWith(400);
    }
  });

  it("forces the author to the verified user when the caller has only own-scope edit", async () => {
    mockedMapper.medicationRequestToPrescriptionInput.mockReturnValue({
      organisationId: "org-1",
    } as never);
    mockedService.createPrescription.mockResolvedValueOnce({
      artifact: { id: "artifact-9" },
      prescription: { id: "rx-9" },
    } as never);
    mockedMapper.prescriptionToMedicationRequest.mockReturnValue({
      resourceType: "MedicationRequest",
    } as never);

    await ClinicalArtifactFhirController.createPrescription(
      {
        ...req,
        userId: "vet-self",
        userPermissions: ["prescription:edit:own"],
        headers: { "x-user-id": "someone-else" },
        body: {
          resourceType: "MedicationRequest",
          intent: "order",
          authorId: "victim-author",
        },
      } as unknown as Request,
      res as Response,
    );

    const [, context] = mockedMapper.medicationRequestToPrescriptionInput.mock
      .calls[0] as [unknown, { authorId?: string }];
    expect(context.authorId).toBe("vet-self");
  });

  it("keeps the payload author for a caller holding org-wide edit", async () => {
    mockedMapper.medicationRequestToPrescriptionInput.mockReturnValue({
      organisationId: "org-1",
    } as never);
    mockedService.createPrescription.mockResolvedValueOnce({
      artifact: { id: "artifact-10" },
      prescription: { id: "rx-10" },
    } as never);
    mockedMapper.prescriptionToMedicationRequest.mockReturnValue({
      resourceType: "MedicationRequest",
    } as never);

    await ClinicalArtifactFhirController.createPrescription(
      {
        ...req,
        userId: "supervisor",
        userPermissions: ["prescription:edit:any"],
        body: {
          resourceType: "MedicationRequest",
          intent: "order",
          authorId: "delegated-author",
        },
      } as unknown as Request,
      res as Response,
    );

    const [, context] = mockedMapper.medicationRequestToPrescriptionInput.mock
      .calls[0] as [unknown, { authorId?: string }];
    expect(context.authorId).toBe("delegated-author");
  });

  describe("finalize / reopen / amend endpoints", () => {
    const soapComposition = {
      resourceType: "Composition",
      id: "composition-soap",
    };
    const dischargeComposition = {
      resourceType: "Composition",
      id: "composition-discharge",
    };
    const medicationRequest = {
      resourceType: "MedicationRequest",
      id: "medreq-1",
    };
    const observation = { resourceType: "Observation", id: "observation-1" };

    const soapRecord = {
      artifact: { id: "artifact-1", status: "COMPLETED" },
      soapNote: { id: "soap-1" },
    };
    const prescriptionRecord = {
      artifact: { id: "artifact-2", status: "COMPLETED" },
      prescription: { id: "rx-1" },
    };
    const dischargeRecord = {
      artifact: { id: "artifact-3", status: "COMPLETED" },
      dischargeSummary: { id: "ds-1" },
    };
    const vitalRecord = {
      artifact: { id: "artifact-4", status: "COMPLETED" },
      vitalRecord: { id: "vital-1" },
    };

    const anonymousActor = { actorId: "", canEditAny: false };

    type LifecycleCase = {
      name: string;
      call: () => Promise<unknown>;
      service: LooseSpy;
      mapper: LooseSpy;
      record: Record<string, unknown>;
      envelope: Record<string, unknown>;
      args: unknown[];
      status: number;
    };

    const lifecycleCases: LifecycleCase[] = [
      {
        name: "finalizeSoapNote",
        call: () =>
          ClinicalArtifactFhirController.finalizeSoapNote(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.finalizeSoapNote),
        mapper: asSpy(mockedMapper.soapNoteToComposition),
        record: soapRecord,
        envelope: soapComposition,
        args: ["soap-1", "org-1"],
        status: 200,
      },
      {
        name: "reopenSoapNote",
        call: () =>
          ClinicalArtifactFhirController.reopenSoapNote(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.reopenSoapNote),
        mapper: asSpy(mockedMapper.soapNoteToComposition),
        record: soapRecord,
        envelope: soapComposition,
        args: ["soap-1", "org-1"],
        status: 200,
      },
      {
        name: "amendSoapNote",
        call: () =>
          ClinicalArtifactFhirController.amendSoapNote(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.amendSoapNote),
        mapper: asSpy(mockedMapper.soapNoteToComposition),
        record: soapRecord,
        envelope: soapComposition,
        args: ["soap-1", "org-1"],
        status: 201,
      },
      {
        name: "finalizePrescription",
        call: () =>
          ClinicalArtifactFhirController.finalizePrescription(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.finalizePrescription),
        mapper: asSpy(mockedMapper.prescriptionToMedicationRequest),
        record: prescriptionRecord,
        envelope: medicationRequest,
        args: ["rx-1", "org-1", anonymousActor],
        status: 200,
      },
      {
        name: "reopenPrescription",
        call: () =>
          ClinicalArtifactFhirController.reopenPrescription(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.reopenPrescription),
        mapper: asSpy(mockedMapper.prescriptionToMedicationRequest),
        record: prescriptionRecord,
        envelope: medicationRequest,
        args: ["rx-1", "org-1", anonymousActor],
        status: 200,
      },
      {
        name: "amendPrescription",
        call: () =>
          ClinicalArtifactFhirController.amendPrescription(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.amendPrescription),
        mapper: asSpy(mockedMapper.prescriptionToMedicationRequest),
        record: prescriptionRecord,
        envelope: medicationRequest,
        args: ["rx-1", "org-1", anonymousActor],
        status: 201,
      },
      {
        name: "finalizeDischargeSummary",
        call: () =>
          ClinicalArtifactFhirController.finalizeDischargeSummary(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.finalizeDischargeSummary),
        mapper: asSpy(mockedMapper.dischargeSummaryToComposition),
        record: dischargeRecord,
        envelope: dischargeComposition,
        args: ["ds-1", "org-1"],
        status: 200,
      },
      {
        name: "reopenDischargeSummary",
        call: () =>
          ClinicalArtifactFhirController.reopenDischargeSummary(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.reopenDischargeSummary),
        mapper: asSpy(mockedMapper.dischargeSummaryToComposition),
        record: dischargeRecord,
        envelope: dischargeComposition,
        args: ["ds-1", "org-1"],
        status: 200,
      },
      {
        name: "amendDischargeSummary",
        call: () =>
          ClinicalArtifactFhirController.amendDischargeSummary(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.amendDischargeSummary),
        mapper: asSpy(mockedMapper.dischargeSummaryToComposition),
        record: dischargeRecord,
        envelope: dischargeComposition,
        args: ["ds-1", "org-1"],
        status: 201,
      },
      {
        name: "finalizeVitalRecord",
        call: () =>
          ClinicalArtifactFhirController.finalizeVitalRecord(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.finalizeVitalRecord),
        mapper: asSpy(mockedMapper.vitalRecordToObservation),
        record: vitalRecord,
        envelope: observation,
        args: ["vital-1", "org-1"],
        status: 200,
      },
      {
        name: "reopenVitalRecord",
        call: () =>
          ClinicalArtifactFhirController.reopenVitalRecord(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.reopenVitalRecord),
        mapper: asSpy(mockedMapper.vitalRecordToObservation),
        record: vitalRecord,
        envelope: observation,
        args: ["vital-1", "org-1"],
        status: 200,
      },
      {
        name: "amendVitalRecord",
        call: () =>
          ClinicalArtifactFhirController.amendVitalRecord(
            req as Request,
            res as Response,
          ),
        service: asSpy(mockedService.amendVitalRecord),
        mapper: asSpy(mockedMapper.vitalRecordToObservation),
        record: vitalRecord,
        envelope: observation,
        args: ["vital-1", "org-1"],
        status: 201,
      },
    ];

    beforeEach(() => {
      asSpy(mockedMapper.soapNoteToComposition).mockReturnValue(
        soapComposition,
      );
      asSpy(mockedMapper.dischargeSummaryToComposition).mockReturnValue(
        dischargeComposition,
      );
      asSpy(mockedMapper.prescriptionToMedicationRequest).mockReturnValue(
        medicationRequest,
      );
      asSpy(mockedMapper.vitalRecordToObservation).mockReturnValue(observation);
    });

    it.each(lifecycleCases)(
      "$name returns the mapped FHIR resource with the lifecycle status code",
      async ({ call, service, mapper, record, envelope, args, status }) => {
        service.mockResolvedValueOnce(record);

        await call();

        expect(service).toHaveBeenCalledWith(...args);
        expect(mapper).toHaveBeenCalledWith(record);
        expect(statusMock).toHaveBeenCalledWith(status);
        expect(jsonMock).toHaveBeenCalledWith(envelope);
      },
    );

    it.each(lifecycleCases)(
      "$name rejects an illegal status transition with 409 and no FHIR body",
      async ({ call, service, mapper }) => {
        service.mockRejectedValueOnce(
          new ClinicalArtifactServiceError(
            "Artifact is final. Reopen or amend it before editing.",
            409,
          ),
        );

        await call();

        expect(statusMock).toHaveBeenCalledWith(409);
        expect(jsonMock).toHaveBeenCalledWith({
          message: "Artifact is final. Reopen or amend it before editing.",
        });
        expect(mapper).not.toHaveBeenCalled();
      },
    );

    it.each(lifecycleCases)(
      "$name reports a missing artifact as 404",
      async ({ call, service, mapper }) => {
        service.mockRejectedValueOnce(
          new ClinicalArtifactServiceError("Artifact not found", 404),
        );

        await call();

        expect(statusMock).toHaveBeenCalledWith(404);
        expect(jsonMock).toHaveBeenCalledWith({
          message: "Artifact not found",
        });
        expect(mapper).not.toHaveBeenCalled();
      },
    );

    it("passes the verified session actor to every prescription lifecycle call", async () => {
      asSpy(mockedService.finalizePrescription).mockResolvedValueOnce(
        prescriptionRecord,
      );

      await ClinicalArtifactFhirController.finalizePrescription(
        {
          ...req,
          userId: " vet-1 ",
          userPermissions: ["prescription:edit:any"],
        } as unknown as Request,
        res as Response,
      );

      expect(mockedService.finalizePrescription).toHaveBeenCalledWith(
        "rx-1",
        "org-1",
        { actorId: "vet-1", canEditAny: true },
      );
    });
  });

  describe("error propagation for read and write endpoints", () => {
    type ErrorCase = {
      name: string;
      invoke: (request: Request) => Promise<unknown>;
      service: LooseSpy;
      body: Record<string, unknown>;
    };

    const composition = { resourceType: "Composition", title: "t" };
    const medicationRequest = {
      resourceType: "MedicationRequest",
      intent: "order",
    };
    const observation = { resourceType: "Observation", code: { text: "v" } };

    const errorCases: ErrorCase[] = [
      {
        name: "listSoapNotesForAppointment",
        invoke: (request) =>
          ClinicalArtifactFhirController.listSoapNotesForAppointment(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listSoapNotesForAppointment),
        body: {},
      },
      {
        name: "listSoapNotesForEncounter",
        invoke: (request) =>
          ClinicalArtifactFhirController.listSoapNotesForEncounter(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listSoapNotesForEncounter),
        body: {},
      },
      {
        name: "updateSoapNote",
        invoke: (request) =>
          ClinicalArtifactFhirController.updateSoapNote(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.updateSoapNote),
        body: composition,
      },
      {
        name: "listPrescriptionsForAppointment",
        invoke: (request) =>
          ClinicalArtifactFhirController.listPrescriptionsForAppointment(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listPrescriptionsForAppointment),
        body: {},
      },
      {
        name: "listPrescriptionsForEncounter",
        invoke: (request) =>
          ClinicalArtifactFhirController.listPrescriptionsForEncounter(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listPrescriptionsForEncounter),
        body: {},
      },
      {
        name: "createPrescription",
        invoke: (request) =>
          ClinicalArtifactFhirController.createPrescription(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.createPrescription),
        body: medicationRequest,
      },
      {
        name: "getPrescription",
        invoke: (request) =>
          ClinicalArtifactFhirController.getPrescription(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.getPrescription),
        body: {},
      },
      {
        name: "updatePrescription",
        invoke: (request) =>
          ClinicalArtifactFhirController.updatePrescription(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.updatePrescription),
        body: medicationRequest,
      },
      {
        name: "deletePrescription",
        invoke: (request) =>
          ClinicalArtifactFhirController.deletePrescription(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.deletePrescription),
        body: {},
      },
      {
        name: "cancelPrescription",
        invoke: (request) =>
          ClinicalArtifactFhirController.cancelPrescription(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.cancelPrescription),
        body: {},
      },
      {
        name: "listDischargeSummariesForAppointment",
        invoke: (request) =>
          ClinicalArtifactFhirController.listDischargeSummariesForAppointment(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listDischargeSummariesForAppointment),
        body: {},
      },
      {
        name: "listDischargeSummariesForEncounter",
        invoke: (request) =>
          ClinicalArtifactFhirController.listDischargeSummariesForEncounter(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listDischargeSummariesForEncounter),
        body: {},
      },
      {
        name: "createDischargeSummary",
        invoke: (request) =>
          ClinicalArtifactFhirController.createDischargeSummary(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.createDischargeSummary),
        body: composition,
      },
      {
        name: "getDischargeSummary",
        invoke: (request) =>
          ClinicalArtifactFhirController.getDischargeSummary(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.getDischargeSummary),
        body: {},
      },
      {
        name: "updateDischargeSummary",
        invoke: (request) =>
          ClinicalArtifactFhirController.updateDischargeSummary(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.updateDischargeSummary),
        body: composition,
      },
      {
        name: "listVitalRecordsForAppointment",
        invoke: (request) =>
          ClinicalArtifactFhirController.listVitalRecordsForAppointment(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listVitalRecordsForAppointment),
        body: {},
      },
      {
        name: "listVitalRecordsForEncounter",
        invoke: (request) =>
          ClinicalArtifactFhirController.listVitalRecordsForEncounter(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.listVitalRecordsForEncounter),
        body: {},
      },
      {
        name: "createVitalRecord",
        invoke: (request) =>
          ClinicalArtifactFhirController.createVitalRecord(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.createVitalRecord),
        body: observation,
      },
      {
        name: "getVitalRecord",
        invoke: (request) =>
          ClinicalArtifactFhirController.getVitalRecord(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.getVitalRecord),
        body: {},
      },
      {
        name: "updateVitalRecord",
        invoke: (request) =>
          ClinicalArtifactFhirController.updateVitalRecord(
            request,
            res as Response,
          ),
        service: asSpy(mockedService.updateVitalRecord),
        body: observation,
      },
    ];

    it.each(errorCases)(
      "$name maps a tenant mismatch onto the service status code",
      async ({ invoke, service, body }) => {
        service.mockRejectedValueOnce(
          new ClinicalArtifactServiceError(
            "Artifact does not belong to organisation",
            403,
          ),
        );

        await invoke({ ...req, body } as Request);

        expect(statusMock).toHaveBeenCalledWith(403);
        expect(jsonMock).toHaveBeenCalledWith({
          message: "Artifact does not belong to organisation",
        });
      },
    );

    it("falls back to 500 and logs when the failure is not a service error", async () => {
      asSpy(mockedService.getVitalRecord).mockRejectedValueOnce(
        new Error("prisma exploded"),
      );

      await ClinicalArtifactFhirController.getVitalRecord(
        req as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith({
        message: "Internal Server Error",
      });
      expect(logger.error).toHaveBeenCalledWith(
        "Unexpected FHIR clinical artifact error",
        expect.any(Error),
      );
    });

    it("reports zod issues for a payload with the wrong resourceType", async () => {
      await ClinicalArtifactFhirController.createVitalRecord(
        { ...req, body: { resourceType: "Composition" } } as Request,
        res as Response,
      );

      expect(statusMock).toHaveBeenCalledWith(400);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "Invalid FHIR payload.",
          issues: [expect.objectContaining({ path: "resourceType" })],
        }),
      );
      expect(mockedService.createVitalRecord).not.toHaveBeenCalled();
    });
  });

  describe("request context extraction", () => {
    beforeEach(() => {
      asSpy(mockedMapper.observationToVitalRecordInput).mockReturnValue({
        organisationId: "org-1",
      });
      asSpy(mockedMapper.vitalRecordToObservation).mockReturnValue({
        resourceType: "Observation",
      });
      asSpy(mockedMapper.compositionToSoapNoteInput).mockReturnValue({
        organisationId: "org-1",
      });
      asSpy(mockedMapper.soapNoteToComposition).mockReturnValue({
        resourceType: "Composition",
      });
      asSpy(mockedMapper.bundles.soapNotes).mockReturnValue({
        resourceType: "Bundle",
      });
    });

    it("carries every typed context field from the payload into the service input", async () => {
      asSpy(mockedService.createSoapNote).mockResolvedValueOnce({
        artifact: { id: "artifact-1" },
        soapNote: { id: "soap-1" },
      });

      await ClinicalArtifactFhirController.createSoapNote(
        {
          ...req,
          body: {
            resourceType: "Composition",
            organisationId: "payload-org",
            appointmentId: "payload-appt",
            caseId: "payload-case",
            encounterId: "payload-enc",
            authorId: "payload-author",
            templateId: "payload-template",
            templateVersion: 9,
            templateVersionId: "payload-template-version",
            recordedBy: "payload-recorder",
            recordedByDisplay: "Payload Recorder",
          },
        } as Request,
        res as Response,
      );

      const [, context] = mockedMapper.compositionToSoapNoteInput.mock
        .calls[0] as [unknown, Record<string, unknown>];
      expect(context).toEqual({
        // the route param always wins over a payload-supplied organisation
        organisationId: "org-1",
        appointmentId: "payload-appt",
        caseId: "payload-case",
        encounterId: "payload-enc",
        authorId: "payload-author",
        templateId: "payload-template",
        templateVersion: 9,
        templateVersionId: "payload-template-version",
        recordedBy: "payload-recorder",
        recordedByDisplay: "Payload Recorder",
      });
    });

    it("falls back to the request user id when the payload names no author", async () => {
      asSpy(mockedService.createSoapNote).mockResolvedValueOnce({
        artifact: { id: "artifact-1" },
        soapNote: { id: "soap-1" },
      });

      await ClinicalArtifactFhirController.createSoapNote(
        {
          ...req,
          headers: { "x-user-id": "header-user" },
          body: { resourceType: "Composition", templateVersion: "9" },
        } as unknown as Request,
        res as Response,
      );

      const [, context] = mockedMapper.compositionToSoapNoteInput.mock
        .calls[0] as [unknown, Record<string, unknown>];
      expect(context.authorId).toBe("header-user");
      expect(context.templateVersion).toBeUndefined();
    });

    it.each([
      ["a non-array performer", { performer: { reference: "Practitioner/x" } }],
      ["an empty performer list", { performer: [] }],
      ["a null performer entry", { performer: [null] }],
      [
        "non-string performer fields",
        { performer: [{ reference: 42, display: 7 }] },
      ],
      ["a blank performer display", { performer: [{ display: "   " }] }],
      ["an empty performer reference", { performer: [{ reference: "" }] }],
    ])("derives no recorder from %s", async (_label, performerFragment) => {
      asSpy(mockedService.createVitalRecord).mockResolvedValueOnce({
        artifact: { id: "artifact-4" },
        vitalRecord: { id: "vital-1" },
      });

      await ClinicalArtifactFhirController.createVitalRecord(
        {
          ...req,
          body: {
            resourceType: "Observation",
            code: { text: "Vitals" },
            ...performerFragment,
          },
        } as Request,
        res as Response,
      );

      const [, context] = mockedMapper.observationToVitalRecordInput.mock
        .calls[0] as [unknown, Record<string, unknown>];
      expect(context.recordedBy).toBeUndefined();
      expect(context.recordedByDisplay).toBeUndefined();
    });

    it("derives the recorder from the first performer reference", async () => {
      asSpy(mockedService.createVitalRecord).mockResolvedValueOnce({
        artifact: { id: "artifact-4" },
        vitalRecord: { id: "vital-1" },
      });

      await ClinicalArtifactFhirController.createVitalRecord(
        {
          ...req,
          body: {
            resourceType: "Observation",
            code: { text: "Vitals" },
            performer: [
              { reference: "Practitioner/nurse-7", display: " Joy " },
            ],
          },
        } as Request,
        res as Response,
      );

      const [, context] = mockedMapper.observationToVitalRecordInput.mock
        .calls[0] as [unknown, Record<string, unknown>];
      expect(context.recordedBy).toBe("nurse-7");
      expect(context.recordedByDisplay).toBe("Joy");
    });

    it.each([
      ["a missing appointment id", undefined],
      ["a whitespace-only appointment id", "   "],
    ])("normalizes %s to an empty filter", async (_label, appointmentId) => {
      asSpy(mockedService.listSoapNotesForAppointment).mockResolvedValueOnce(
        [],
      );

      await ClinicalArtifactFhirController.listSoapNotesForAppointment(
        {
          ...req,
          params: { organisationId: "org-1", appointmentId },
        } as unknown as Request,
        res as Response,
      );

      expect(mockedService.listSoapNotesForAppointment).toHaveBeenCalledWith(
        "org-1",
        "",
      );
    });

    it.each([
      ["a missing encounter id", undefined],
      ["a whitespace-only encounter id", "  "],
    ])(
      "normalizes %s to an empty encounter filter",
      async (_label, encounterId) => {
        asSpy(mockedService.listSoapNotesForEncounter).mockResolvedValueOnce(
          [],
        );

        await ClinicalArtifactFhirController.listSoapNotesForEncounter(
          {
            ...req,
            params: { organisationId: "org-1", encounterId },
          } as unknown as Request,
          res as Response,
        );

        expect(mockedService.listSoapNotesForEncounter).toHaveBeenCalledWith(
          "org-1",
          "",
        );
      },
    );
  });
});
