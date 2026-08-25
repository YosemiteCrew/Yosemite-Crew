import { Request, Response } from "express";
import {
  Composition,
  MedicationRequest,
  Observation,
} from "@yosemite-crew/fhir";
import { z } from "zod";
import {
  ClinicalArtifactService,
  ClinicalArtifactServiceError,
} from "src/services/clinical-artifact.service";
import { clinicalArtifactFhirMapper } from "src/services/fhir-clinical-artifact.mapper";
import { SoapCodedTermsFhirService } from "src/services/soap-coded-terms.service";
import type { SoapNoteRecord } from "@yosemite-crew/types";
import { createFhirErrorHandler } from "src/controllers/web/fhir-controller.shared";
import { resolveVerifiedUserId } from "src/utils/request";
import type { PrescriptionActor } from "src/services/clinical-artifact.service";
import type { OrgRequest } from "src/middlewares/rbac";

/**
 * Read the actor straight off the verified session rather than via
 * `resolveVerifiedUserId`, which falls back to the client-supplied
 * `x-user-id` header. That fallback is acceptable for attribution but must
 * never decide an authorization outcome.
 */
const resolvePrescriptionActor = (req: Request): PrescriptionActor => {
  const orgRequest = req as OrgRequest;
  return {
    actorId: orgRequest.userId?.trim() ?? "",
    canEditAny:
      orgRequest.userPermissions?.includes("prescription:edit:any") ?? false,
  };
};

const compositionSchema = z
  .object({ resourceType: z.literal("Composition") })
  .passthrough();
const medicationRequestSchema = z
  .object({ resourceType: z.literal("MedicationRequest") })
  .passthrough();
const observationSchema = z
  .object({ resourceType: z.literal("Observation") })
  .passthrough();

const handleError = createFhirErrorHandler({
  isServiceError: (error): error is ClinicalArtifactServiceError =>
    error instanceof ClinicalArtifactServiceError,
  invalidPayloadMessage: "Invalid FHIR payload.",
  logMessage: "Unexpected FHIR clinical artifact error",
});

const readFirstPerformer = (resource: Record<string, unknown>) => {
  if (
    typeof resource.performer !== "object" ||
    resource.performer === null ||
    !Array.isArray(resource.performer) ||
    resource.performer.length === 0
  ) {
    return undefined;
  }

  const performer: unknown = resource.performer[0];
  if (typeof performer !== "object" || performer === null) {
    return undefined;
  }

  return performer as Record<string, unknown>;
};

const readPerformerReference = (resource: Record<string, unknown>) => {
  const performer = readFirstPerformer(resource);
  const reference = performer?.reference;
  if (typeof reference !== "string") {
    return undefined;
  }

  return reference.split("/").pop() || undefined;
};

const readPerformerDisplay = (resource: Record<string, unknown>) => {
  const performer = readFirstPerformer(resource);
  const display = performer?.display;
  if (typeof display !== "string") {
    return undefined;
  }

  const trimmed = display.trim();
  return trimmed.length > 0 ? trimmed : undefined;
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
      : readPerformerReference(resource),
  recordedByDisplay:
    typeof resource.recordedByDisplay === "string"
      ? resource.recordedByDisplay
      : readPerformerDisplay(resource),
});

const readAppointmentId = (value: string | undefined) => value?.trim() || "";

const readEncounterId = (value: string | undefined) => value?.trim() || "";

/**
 * SOAP notes serialize through these so every response carries the typed
 * coded-term projection (YC + usable VeNom/SNOMED translations) alongside the
 * raw diagnoses channel. Derived per read; the stored record is never touched.
 */
const serializeSoapNote = async (record: SoapNoteRecord) => {
  const composition = clinicalArtifactFhirMapper.soapNoteToComposition(record);
  const coded = await SoapCodedTermsFhirService.codedTermExtensions(
    record.soapNote.diagnoses,
  );
  if (coded.length > 0) {
    composition.extension = [...(composition.extension ?? []), ...coded];
  }
  return composition;
};

const serializeSoapNoteBundle = async (records: SoapNoteRecord[]) => {
  const bundle = clinicalArtifactFhirMapper.bundles.soapNotes(records);
  // recordBundle maps records in order, so entries pair up index-for-index.
  await Promise.all(
    records.map(async (record, index) => {
      const coded = await SoapCodedTermsFhirService.codedTermExtensions(
        record.soapNote.diagnoses,
      );
      const resource = bundle.entry?.[index]?.resource as
        Composition | undefined;
      if (coded.length > 0 && resource) {
        resource.extension = [...(resource.extension ?? []), ...coded];
      }
    }),
  );
  return bundle;
};

export const ClinicalArtifactFhirController = {
  async listSoapNotesForAppointment(req: Request, res: Response) {
    try {
      const records = await ClinicalArtifactService.listSoapNotesForAppointment(
        req.params.organisationId,
        readAppointmentId(req.params.appointmentId),
      );
      return res.status(200).json(await serializeSoapNoteBundle(records));
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
      return res.status(200).json(await serializeSoapNoteBundle(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async createSoapNote(req: Request, res: Response) {
    try {
      const body = compositionSchema.parse(req.body) as unknown as Composition;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveVerifiedUserId(req) ?? "",
      );
      const record = await ClinicalArtifactService.createSoapNote(
        clinicalArtifactFhirMapper.compositionToSoapNoteInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
      );
      return res.status(201).json(await serializeSoapNote(record));
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
      return res.status(200).json(await serializeSoapNote(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async updateSoapNote(req: Request, res: Response) {
    try {
      const body = compositionSchema.parse(req.body) as unknown as Composition;
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveVerifiedUserId(req) ?? "",
      );
      const record = await ClinicalArtifactService.updateSoapNote(
        req.params.soapNoteId,
        clinicalArtifactFhirMapper.compositionToSoapNoteInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
        req.params.organisationId,
      );
      return res.status(200).json(await serializeSoapNote(record));
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
      const actor = resolvePrescriptionActor(req);
      const context = readContext(
        req.body as Record<string, unknown>,
        resolveVerifiedUserId(req) ?? "",
      );
      // A caller with only own-scope edit cannot attribute the prescription to
      // another author: the author is forced to the verified acting user, so a
      // payload-supplied authorId cannot forge provenance.
      const authorId = actor.canEditAny ? context.authorId : actor.actorId;
      const record = await ClinicalArtifactService.createPrescription(
        clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(body, {
          ...context,
          authorId,
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
        resolveVerifiedUserId(req) ?? "",
      );
      const record = await ClinicalArtifactService.updatePrescription(
        req.params.prescriptionId,
        clinicalArtifactFhirMapper.medicationRequestToPrescriptionInput(body, {
          ...context,
          organisationId: req.params.organisationId,
        }),
        req.params.organisationId,
        resolvePrescriptionActor(req),
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
        resolveVerifiedUserId(req) ?? "",
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
        resolveVerifiedUserId(req) ?? "",
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
        resolveVerifiedUserId(req) ?? "",
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
        resolveVerifiedUserId(req) ?? "",
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

  async finalizeSoapNote(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.finalizeSoapNote(
        req.params.soapNoteId,
        req.params.organisationId,
      );
      return res.status(200).json(await serializeSoapNote(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async reopenSoapNote(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.reopenSoapNote(
        req.params.soapNoteId,
        req.params.organisationId,
      );
      return res.status(200).json(await serializeSoapNote(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async amendSoapNote(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.amendSoapNote(
        req.params.soapNoteId,
        req.params.organisationId,
        resolveVerifiedUserId(req),
      );
      return res.status(201).json(await serializeSoapNote(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async finalizePrescription(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.finalizePrescription(
        req.params.prescriptionId,
        req.params.organisationId,
        resolvePrescriptionActor(req),
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

  async reopenPrescription(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.reopenPrescription(
        req.params.prescriptionId,
        req.params.organisationId,
        resolvePrescriptionActor(req),
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

  async amendPrescription(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.amendPrescription(
        req.params.prescriptionId,
        req.params.organisationId,
        resolvePrescriptionActor(req),
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

  async deletePrescription(req: Request, res: Response) {
    try {
      await ClinicalArtifactService.deletePrescription(
        req.params.prescriptionId,
        req.params.organisationId,
        resolvePrescriptionActor(req),
      );
      return res.status(204).send();
    } catch (error) {
      return handleError(error, res);
    }
  },

  async cancelPrescription(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.cancelPrescription(
        req.params.prescriptionId,
        req.params.organisationId,
        resolvePrescriptionActor(req),
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

  async finalizeDischargeSummary(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.finalizeDischargeSummary(
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

  async reopenDischargeSummary(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.reopenDischargeSummary(
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

  async amendDischargeSummary(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.amendDischargeSummary(
        req.params.dischargeSummaryId,
        req.params.organisationId,
        resolveVerifiedUserId(req),
      );
      return res
        .status(201)
        .json(clinicalArtifactFhirMapper.dischargeSummaryToComposition(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async finalizeVitalRecord(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.finalizeVitalRecord(
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

  async reopenVitalRecord(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.reopenVitalRecord(
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

  async amendVitalRecord(req: Request, res: Response) {
    try {
      const record = await ClinicalArtifactService.amendVitalRecord(
        req.params.vitalRecordId,
        req.params.organisationId,
        resolveVerifiedUserId(req),
      );
      return res
        .status(201)
        .json(clinicalArtifactFhirMapper.vitalRecordToObservation(record));
    } catch (error) {
      return handleError(error, res);
    }
  },

  // Passport clinical-record kinds, read-only over FHIR (Immunization /
  // Observation / Procedure / Composition). Captured via the passport flow.
  async listImmunizationsForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listImmunizationsForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.immunizations(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listImmunizationsForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listImmunizationsForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.immunizations(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listRabiesTitrationsForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listRabiesTitrationsForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.rabiesTitrations(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listRabiesTitrationsForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listRabiesTitrationsForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.rabiesTitrations(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listParasiteTreatmentsForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listParasiteTreatmentsForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.parasiteTreatments(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listParasiteTreatmentsForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listParasiteTreatmentsForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.parasiteTreatments(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listClinicalExaminationsForAppointment(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listClinicalExaminationsForAppointment(
          req.params.organisationId,
          readAppointmentId(req.params.appointmentId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.clinicalExaminations(records));
    } catch (error) {
      return handleError(error, res);
    }
  },

  async listClinicalExaminationsForEncounter(req: Request, res: Response) {
    try {
      const records =
        await ClinicalArtifactService.listClinicalExaminationsForEncounter(
          req.params.organisationId,
          readEncounterId(req.params.encounterId),
        );
      return res
        .status(200)
        .json(clinicalArtifactFhirMapper.bundles.clinicalExaminations(records));
    } catch (error) {
      return handleError(error, res);
    }
  },
};
