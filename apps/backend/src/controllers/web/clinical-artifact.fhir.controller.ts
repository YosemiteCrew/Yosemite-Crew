import { Request, Response } from "express";
import {
  Composition,
  MedicationRequest,
  Observation,
} from "@yosemite-crew/fhir";
import { z } from "zod";
import { AuthenticatedRequest } from "src/middlewares/auth";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "src/services/clinical-artifact.service";
import { clinicalArtifactFhirMapper } from "src/services/fhir-clinical-artifact.mapper";
import logger from "src/utils/logger";

const compositionSchema = z
  .object({ resourceType: z.literal("Composition") })
  .passthrough();
const medicationRequestSchema = z
  .object({ resourceType: z.literal("MedicationRequest") })
  .passthrough();
const observationSchema = z
  .object({ resourceType: z.literal("Observation") })
  .passthrough();

const handleError = (error: unknown, res: Response) => {
  if (error instanceof ClinicalArtifactServiceError) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  if (error instanceof z.ZodError) {
    return res.status(400).json({
      message: "Invalid FHIR payload.",
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    });
  }

  logger.error("Unexpected FHIR clinical artifact error", error);
  return res.status(500).json({ message: "Internal Server Error" });
};

const resolveUserId = (req: Request) => {
  const typed = req as AuthenticatedRequest;
  return typeof typed.userId === "string" ? typed.userId : "";
};

const readContext = (resource: Record<string, unknown>, userId: string) => ({
  organisationId:
    typeof resource.organisationId === "string" ? resource.organisationId : "",
  appointmentId:
    typeof resource.appointmentId === "string"
      ? resource.appointmentId
      : undefined,
  caseId: typeof resource.caseId === "string" ? resource.caseId : undefined,
  encounterId:
    typeof resource.encounterId === "string" ? resource.encounterId : undefined,
  authorId: typeof resource.authorId === "string" ? resource.authorId : userId,
  templateId:
    typeof resource.templateId === "string" ? resource.templateId : undefined,
  templateVersion:
    typeof resource.templateVersion === "number"
      ? resource.templateVersion
      : undefined,
  templateVersionId:
    typeof resource.templateVersionId === "string"
      ? resource.templateVersionId
      : undefined,
  recordedBy:
    typeof resource.recordedBy === "string"
      ? resource.recordedBy
      : typeof resource.performer === "object" &&
          Array.isArray(resource.performer) &&
          typeof resource.performer[0] === "object" &&
          resource.performer[0] !== null &&
          typeof (resource.performer[0] as { reference?: unknown })
            .reference === "string"
        ? String((resource.performer[0] as { reference: string }).reference)
            .split("/")
            .pop()
        : undefined,
});

const readAppointmentId = (value: string | undefined) => value?.trim() || "";

const readEncounterId = (value: string | undefined) => value?.trim() || "";

export const ClinicalArtifactFhirController = {
  async listSoapNotesForAppointment(req: Request, res: Response) {
    try {
      const records = await ClinicalArtifactService.listSoapNotesForAppointment(
        req.params.organisationId,
        readAppointmentId(req.params.appointmentId),
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.soapNotes(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listSoapNotesForEncounter(req: Request, res: Response) {
    try {
      const records = await ClinicalArtifactService.listSoapNotesForEncounter(
        req.params.organisationId,
        readEncounterId(req.params.encounterId),
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.soapNotes(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createSoapNote(req: Request, res: Response) {
    try {
      const body = compositionSchema.parse(req.body) as unknown as Composition;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.createSoapNote(
        clinicalArtifactFhirMapper.compositionToSoapNoteInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
      );
      return res
        .status(201)
        .json(clinicalArtifactFhirMapper.soapNoteToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getSoapNote(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.getSoapNote(
        req.params.soapNoteId,
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.soapNoteToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateSoapNote(req: Request, res: Response) {
    try {
      const body = compositionSchema.parse(req.body) as unknown as Composition;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.updateSoapNote(
        req.params.soapNoteId,
        clinicalArtifactFhirMapper.compositionToSoapNoteInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.soapNoteToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listPrescriptionsForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listPrescriptionsForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.prescriptions(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listPrescriptionsForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listPrescriptionsForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.prescriptions(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createPrescription(req: Request, res: Response) {
    try {
      const body = medicationRequestSchema.parse(
        req.body,
      ) as unknown as MedicationRequest;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.createPrescription(
        clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
      );
      return res
        .status(201)
        .json(
          clinicalArtifactFhirMapper.prescriptionToMedicationRequest(record),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getPrescription(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.getPrescription(
        req.params.prescriptionId,
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(
          clinicalArtifactFhirMapper.prescriptionToMedicationRequest(record),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updatePrescription(req: Request, res: Response) {
    try {
      const body = medicationRequestSchema.parse(
        req.body,
      ) as unknown as MedicationRequest;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.updatePrescription(
        req.params.prescriptionId,
        clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(
          clinicalArtifactFhirMapper.prescriptionToMedicationRequest(record),
        );
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listDischargeSummariesForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listDischargeSummariesForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.dischargeSummaries(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listDischargeSummariesForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listDischargeSummariesForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.dischargeSummaries(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createDischargeSummary(req: Request, res: Response) {
    try {
      const body = compositionSchema.parse(req.body) as unknown as Composition;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.createDischargeSummary(
        clinicalArtifactFhirMapper.compositionToDischargeSummaryInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
      );
      return res
        .status(201)
        .json(clinicalArtifactFhirMapper.dischargeSummaryToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getDischargeSummary(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.getDischargeSummary(
        req.params.dischargeSummaryId,
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.dischargeSummaryToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateDischargeSummary(req: Request, res: Response) {
    try {
      const body = compositionSchema.parse(req.body) as unknown as Composition;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.updateDischargeSummary(
        req.params.dischargeSummaryId,
        clinicalArtifactFhirMapper.compositionToDischargeSummaryInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.dischargeSummaryToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listVitalRecordsForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listVitalRecordsForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.vitalRecords(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listVitalRecordsForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listVitalRecordsForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.vitalRecords(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createVitalRecord(req: Request, res: Response) {
    try {
      const body = observationSchema.parse(req.body) as unknown as Observation;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.createVitalRecord(
        clinicalArtifactFhirMapper.observationToVitalRecordInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
      );
      return res
        .status(201)
        .json(clinicalArtifactFhirMapper.vitalRecordToObservation(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async getVitalRecord(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.getVitalRecord(
        req.params.vitalRecordId,
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.vitalRecordToObservation(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateVitalRecord(req: Request, res: Response) {
    try {
      const body = observationSchema.parse(req.body) as unknown as Observation;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveUserId(req),
      );
      const record = await ClinicalArtifactService.updateVitalRecord(
        req.params.vitalRecordId,
        clinicalArtifactFhirMapper.observationToVitalRecordInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
        req.params.organisationId,
      );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.vitalRecordToObservation(record));
    } catch (error) {
      return handleError(error, res);
    }
  },
};
