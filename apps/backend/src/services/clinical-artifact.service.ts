import {
  Prisma,
  ClinicalArtifactKind,
  ClinicalArtifactStatus,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  createRenderedDocumentRecord,
  type PersistRenderedDocumentInput,
} from "src/services/rendered-document.service";
import { InventoryConsumptionService } from "src/services/inventory-consumption.service";

export class ClinicalArtifactServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "ClinicalArtifactServiceError";
  }
}

type ClinicalArtifactBaseInput = {
  organisationId: string;
  appointmentId?: string;
  caseId?: string;
  encounterId?: string;
  templateId?: string;
  templateVersion?: number;
  templateVersionId?: string;
  authorId?: string;
  status?: ClinicalArtifactStatus;
  summary?: string | null;
};

type ClinicalArtifactWithKind<TKind extends ClinicalArtifactKind> =
  SoapNoteRecord["artifact"] & {
    kind: TKind;
  };

type SoapNoteWithArtifact = Prisma.SoapNoteGetPayload<{
  include: { artifact: true };
}>;

type PrescriptionWithArtifact = Prisma.PrescriptionGetPayload<{
  include: { artifact: true };
}>;

type PrescriptionModel =
  Prisma.PrescriptionGetPayload<Prisma.PrescriptionDefaultArgs>;

type DischargeSummaryWithArtifact = Prisma.DischargeSummaryGetPayload<{
  include: { artifact: true };
}>;

type DischargeSummaryModel =
  Prisma.DischargeSummaryGetPayload<Prisma.DischargeSummaryDefaultArgs>;

type VitalRecordWithArtifact = Prisma.VitalRecordGetPayload<{
  include: { artifact: true };
}>;

type VitalRecordModel =
  Prisma.VitalRecordGetPayload<Prisma.VitalRecordDefaultArgs>;

type ClinicalPrisma = typeof prisma & {
  prescription: {
    findUnique(
      args: Prisma.PrescriptionFindUniqueArgs,
    ): Promise<PrescriptionWithArtifact | null>;
    findMany(
      args: Prisma.PrescriptionFindManyArgs,
    ): Promise<PrescriptionWithArtifact[]>;
    create(args: Prisma.PrescriptionCreateArgs): Promise<PrescriptionModel>;
    update(args: Prisma.PrescriptionUpdateArgs): Promise<PrescriptionModel>;
  };
  dischargeSummary: {
    findUnique(
      args: Prisma.DischargeSummaryFindUniqueArgs,
    ): Promise<DischargeSummaryWithArtifact | null>;
    findMany(
      args: Prisma.DischargeSummaryFindManyArgs,
    ): Promise<DischargeSummaryWithArtifact[]>;
    create(
      args: Prisma.DischargeSummaryCreateArgs,
    ): Promise<DischargeSummaryModel>;
    update(
      args: Prisma.DischargeSummaryUpdateArgs,
    ): Promise<DischargeSummaryModel>;
  };
  vitalRecord: {
    findUnique(
      args: Prisma.VitalRecordFindUniqueArgs,
    ): Promise<VitalRecordWithArtifact | null>;
    findMany(
      args: Prisma.VitalRecordFindManyArgs,
    ): Promise<VitalRecordWithArtifact[]>;
    create(args: Prisma.VitalRecordCreateArgs): Promise<VitalRecordModel>;
    update(args: Prisma.VitalRecordUpdateArgs): Promise<VitalRecordModel>;
  };
};

const clinicalPrisma = prisma as ClinicalPrisma;

const shouldConsumeInventoryForPrescription = (
  status: ClinicalArtifactStatus,
) => status === "SIGNED" || status === "COMPLETED";

const isSamePrescriptionPayload = (
  nextMedications: unknown,
  previousMedications: unknown,
) =>
  JSON.stringify(nextMedications ?? null) ===
  JSON.stringify(previousMedications ?? null);

export type SoapNoteInput = ClinicalArtifactBaseInput & {
  subjective?: unknown;
  objective?: unknown;
  assessment?: unknown;
  plan?: unknown;
  diagnoses?: unknown;
  metadata?: unknown;
};

export type SoapNoteUpdateInput = Partial<
  Pick<
    SoapNoteInput,
    | "status"
    | "summary"
    | "subjective"
    | "objective"
    | "assessment"
    | "plan"
    | "diagnoses"
    | "metadata"
  >
>;

export type SoapNoteRecord = {
  artifact: {
    id: string;
    organisationId: string;
    appointmentId: string | null;
    caseId: string | null;
    encounterId: string | null;
    kind: ClinicalArtifactKind;
    status: ClinicalArtifactStatus;
    templateId: string | null;
    templateVersion: number | null;
    templateVersionId: string | null;
    authorId: string | null;
    signedBy: string | null;
    signedAt: Date | null;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  soapNote: {
    id: string;
    artifactId: string;
    subjective: Prisma.JsonValue | null;
    objective: Prisma.JsonValue | null;
    assessment: Prisma.JsonValue | null;
    plan: Prisma.JsonValue | null;
    diagnoses: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type PrescriptionInput = ClinicalArtifactBaseInput & {
  medications?: unknown;
  instructions?: unknown;
  notes?: unknown;
  metadata?: unknown;
};

export type PrescriptionUpdateInput = Partial<
  Pick<
    PrescriptionInput,
    "status" | "summary" | "medications" | "instructions" | "notes" | "metadata"
  >
>;

export type PrescriptionRecord = {
  artifact: SoapNoteRecord["artifact"] & {
    kind: "PRESCRIPTION";
  };
  prescription: {
    id: string;
    artifactId: string;
    medications: Prisma.JsonValue | null;
    instructions: Prisma.JsonValue | null;
    notes: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type DischargeSummaryInput = ClinicalArtifactBaseInput & {
  summaryContent?: unknown;
  diagnoses?: unknown;
  medications?: unknown;
  followUp?: unknown;
  instructions?: unknown;
  metadata?: unknown;
};

export type DischargeSummaryUpdateInput = Partial<
  Pick<
    DischargeSummaryInput,
    | "status"
    | "summary"
    | "summaryContent"
    | "diagnoses"
    | "medications"
    | "followUp"
    | "instructions"
    | "metadata"
  >
>;

export type DischargeSummaryRecord = {
  artifact: SoapNoteRecord["artifact"] & {
    kind: "DISCHARGE_SUMMARY";
  };
  dischargeSummary: {
    id: string;
    artifactId: string;
    summary: Prisma.JsonValue | null;
    diagnoses: Prisma.JsonValue | null;
    medications: Prisma.JsonValue | null;
    followUp: Prisma.JsonValue | null;
    instructions: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

export type VitalRecordInput = ClinicalArtifactBaseInput & {
  measuredAt: Date | string;
  recordedBy?: string | null;
  vitals: unknown;
  notes?: unknown;
  metadata?: unknown;
};

export type VitalRecordUpdateInput = Partial<
  Pick<
    VitalRecordInput,
    | "status"
    | "summary"
    | "measuredAt"
    | "recordedBy"
    | "vitals"
    | "notes"
    | "metadata"
  >
>;

export type VitalRecordRecord = {
  artifact: SoapNoteRecord["artifact"] & {
    kind: "VITAL_RECORD";
  };
  vitalRecord: {
    id: string;
    artifactId: string;
    measuredAt: Date;
    recordedBy: string | null;
    vitals: Prisma.JsonValue;
    notes: Prisma.JsonValue | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  };
};

const ensureId = (value: string | undefined, field: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ClinicalArtifactServiceError(`Invalid ${field}`, 400);
  }
  return value.trim();
};

const toNullableJsonInput = (
  value: unknown,
): Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | undefined => {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
};

const toJsonInput = (
  value: unknown,
  fallback: Record<string, unknown> = {},
): Prisma.InputJsonValue => (value ?? fallback) as Prisma.InputJsonValue;

const toNullableString = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  return value === null ? null : value.trim();
};

const DOCUMENT_BACKED_CLINICAL_KINDS = new Set<ClinicalArtifactKind>([
  "SOAP_NOTE",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "VITAL_RECORD",
]);

const clinicalArtifactTitleByKind: Record<ClinicalArtifactKind, string> = {
  SOAP_NOTE: "SOAP note",
  PRESCRIPTION: "Prescription",
  DISCHARGE_SUMMARY: "Discharge summary",
  VITAL_RECORD: "Vital record",
};

const buildClinicalArtifactRenderedDocumentInput = (artifact: {
  id: string;
  organisationId: string;
  kind: ClinicalArtifactKind;
  templateId?: string | null;
  templateVersion?: number | null;
  templateVersionId?: string | null;
}): PersistRenderedDocumentInput => ({
  title: clinicalArtifactTitleByKind[artifact.kind],
  source: {
    sourceKind: "CLINICAL_ARTIFACT",
    sourceId: artifact.id,
    organisationId: artifact.organisationId,
    templateKind: artifact.kind,
    templateId: artifact.templateId ?? undefined,
    templateVersion: artifact.templateVersion ?? undefined,
    templateVersionId: artifact.templateVersionId ?? undefined,
  },
  clinicalArtifactId: artifact.id,
});

const assertArtifactKind = (
  artifact: { kind: ClinicalArtifactKind; organisationId: string },
  expectedKind: ClinicalArtifactKind,
  label: string,
  organisationId?: string,
) => {
  if (artifact.kind !== expectedKind) {
    throw new ClinicalArtifactServiceError(`Artifact is not a ${label}`, 409);
  }

  if (organisationId && artifact.organisationId !== organisationId) {
    throw new ClinicalArtifactServiceError(
      "Artifact does not belong to organisation",
      403,
    );
  }
};

const assertSoapNoteArtifact = (
  artifact: { kind: ClinicalArtifactKind; organisationId: string },
  organisationId?: string,
) => assertArtifactKind(artifact, "SOAP_NOTE", "SOAP note", organisationId);

const toClinicalArtifactKind = <TKind extends ClinicalArtifactKind>(
  artifact: SoapNoteRecord["artifact"],
  kind: TKind,
): ClinicalArtifactWithKind<TKind> => ({
  ...artifact,
  kind,
});

const buildPrescriptionRecord = (
  artifact: SoapNoteRecord["artifact"],
  prescription: PrescriptionModel,
): PrescriptionRecord => ({
  artifact: toClinicalArtifactKind(artifact, "PRESCRIPTION"),
  prescription,
});

const toPrescriptionRecord = (
  record: PrescriptionWithArtifact,
): PrescriptionRecord =>
  buildPrescriptionRecord(record.artifact, {
    id: record.id,
    artifactId: record.artifactId,
    medications: record.medications,
    instructions: record.instructions,
    notes: record.notes,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

const buildDischargeSummaryRecord = (
  artifact: SoapNoteRecord["artifact"],
  dischargeSummary: DischargeSummaryModel,
): DischargeSummaryRecord => ({
  artifact: toClinicalArtifactKind(artifact, "DISCHARGE_SUMMARY"),
  dischargeSummary,
});

const toDischargeSummaryRecord = (
  record: DischargeSummaryWithArtifact,
): DischargeSummaryRecord =>
  buildDischargeSummaryRecord(record.artifact, {
    id: record.id,
    artifactId: record.artifactId,
    summary: record.summary,
    diagnoses: record.diagnoses,
    medications: record.medications,
    followUp: record.followUp,
    instructions: record.instructions,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

const buildVitalRecordRecord = (
  artifact: SoapNoteRecord["artifact"],
  vitalRecord: VitalRecordModel,
): VitalRecordRecord => ({
  artifact: toClinicalArtifactKind(artifact, "VITAL_RECORD"),
  vitalRecord,
});

const toVitalRecordRecord = (
  record: VitalRecordWithArtifact,
): VitalRecordRecord =>
  buildVitalRecordRecord(record.artifact, {
    id: record.id,
    artifactId: record.artifactId,
    measuredAt: record.measuredAt,
    recordedBy: record.recordedBy,
    vitals: record.vitals,
    notes: record.notes,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

const loadSoapNoteOrThrow = async (soapNoteId: string) => {
  const note = await prisma.soapNote.findUnique({
    where: { id: ensureId(soapNoteId, "soapNoteId") },
    include: { artifact: true },
  });

  if (!note) {
    throw new ClinicalArtifactServiceError("SOAP note not found", 404);
  }

  assertArtifactKind(note.artifact, "SOAP_NOTE", "SOAP note");

  return note;
};

const loadPrescriptionOrThrow = async (prescriptionId: string) => {
  const prescription = await clinicalPrisma.prescription.findUnique({
    where: { id: ensureId(prescriptionId, "prescriptionId") },
    include: { artifact: true },
  });

  if (!prescription) {
    throw new ClinicalArtifactServiceError("Prescription not found", 404);
  }

  assertArtifactKind(prescription.artifact, "PRESCRIPTION", "prescription");

  return prescription;
};

const loadDischargeSummaryOrThrow = async (dischargeSummaryId: string) => {
  const dischargeSummary = await clinicalPrisma.dischargeSummary.findUnique({
    where: { id: ensureId(dischargeSummaryId, "dischargeSummaryId") },
    include: { artifact: true },
  });

  if (!dischargeSummary) {
    throw new ClinicalArtifactServiceError("Discharge summary not found", 404);
  }

  assertArtifactKind(
    dischargeSummary.artifact,
    "DISCHARGE_SUMMARY",
    "discharge summary",
  );

  return dischargeSummary;
};

const loadVitalRecordOrThrow = async (vitalRecordId: string) => {
  const vitalRecord = await clinicalPrisma.vitalRecord.findUnique({
    where: { id: ensureId(vitalRecordId, "vitalRecordId") },
    include: { artifact: true },
  });

  if (!vitalRecord) {
    throw new ClinicalArtifactServiceError("Vital record not found", 404);
  }

  assertArtifactKind(vitalRecord.artifact, "VITAL_RECORD", "vital record");

  return vitalRecord;
};

const soapNoteInputFromRecord = (record: SoapNoteRecord): SoapNoteInput => ({
  organisationId: record.artifact.organisationId,
  appointmentId: record.artifact.appointmentId ?? undefined,
  caseId: record.artifact.caseId ?? undefined,
  encounterId: record.artifact.encounterId ?? undefined,
  templateId: record.artifact.templateId ?? undefined,
  templateVersion: record.artifact.templateVersion ?? undefined,
  templateVersionId: record.artifact.templateVersionId ?? undefined,
  authorId: record.artifact.authorId ?? undefined,
  status: "DRAFT",
  summary: record.artifact.summary,
  subjective: record.soapNote.subjective,
  objective: record.soapNote.objective,
  assessment: record.soapNote.assessment,
  plan: record.soapNote.plan,
  diagnoses: record.soapNote.diagnoses,
  metadata: record.soapNote.metadata,
});

const prescriptionInputFromRecord = (
  record: PrescriptionRecord,
): PrescriptionInput => ({
  organisationId: record.artifact.organisationId,
  appointmentId: record.artifact.appointmentId ?? undefined,
  caseId: record.artifact.caseId ?? undefined,
  encounterId: record.artifact.encounterId ?? undefined,
  templateId: record.artifact.templateId ?? undefined,
  templateVersion: record.artifact.templateVersion ?? undefined,
  templateVersionId: record.artifact.templateVersionId ?? undefined,
  authorId: record.artifact.authorId ?? undefined,
  status: "DRAFT",
  summary: record.artifact.summary,
  medications: record.prescription.medications,
  instructions: record.prescription.instructions,
  notes: record.prescription.notes,
  metadata: record.prescription.metadata,
});

const dischargeSummaryInputFromRecord = (
  record: DischargeSummaryRecord,
): DischargeSummaryInput => ({
  organisationId: record.artifact.organisationId,
  appointmentId: record.artifact.appointmentId ?? undefined,
  caseId: record.artifact.caseId ?? undefined,
  encounterId: record.artifact.encounterId ?? undefined,
  templateId: record.artifact.templateId ?? undefined,
  templateVersion: record.artifact.templateVersion ?? undefined,
  templateVersionId: record.artifact.templateVersionId ?? undefined,
  authorId: record.artifact.authorId ?? undefined,
  status: "DRAFT",
  summary: record.artifact.summary,
  summaryContent: record.dischargeSummary.summary,
  diagnoses: record.dischargeSummary.diagnoses,
  medications: record.dischargeSummary.medications,
  followUp: record.dischargeSummary.followUp,
  instructions: record.dischargeSummary.instructions,
  metadata: record.dischargeSummary.metadata,
});

const vitalRecordInputFromRecord = (
  record: VitalRecordRecord,
): VitalRecordInput => ({
  organisationId: record.artifact.organisationId,
  appointmentId: record.artifact.appointmentId ?? undefined,
  caseId: record.artifact.caseId ?? undefined,
  encounterId: record.artifact.encounterId ?? undefined,
  templateId: record.artifact.templateId ?? undefined,
  templateVersion: record.artifact.templateVersion ?? undefined,
  templateVersionId: record.artifact.templateVersionId ?? undefined,
  authorId: record.artifact.authorId ?? undefined,
  status: "DRAFT",
  summary: record.artifact.summary,
  measuredAt: record.vitalRecord.measuredAt,
  recordedBy: record.vitalRecord.recordedBy,
  vitals: record.vitalRecord.vitals,
  notes: record.vitalRecord.notes,
  metadata: record.vitalRecord.metadata,
});

const toDate = (value: Date | string | undefined, field: string) => {
  if (value === undefined) return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ClinicalArtifactServiceError(`Invalid ${field}`, 400);
  }
  return date;
};

const FINAL_CLINICAL_ARTIFACT_STATUSES = new Set<ClinicalArtifactStatus>([
  "COMPLETED",
  "SIGNED",
]);

const isFinalClinicalArtifactStatus = (status: ClinicalArtifactStatus) =>
  FINAL_CLINICAL_ARTIFACT_STATUSES.has(status);

export const ClinicalArtifactService = {
  async createSoapNote(input: SoapNoteInput): Promise<SoapNoteRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await txPrisma.clinicalArtifact.create({
        data: {
          organisationId,
          appointmentId: input.appointmentId ?? undefined,
          caseId: input.caseId ?? undefined,
          encounterId: input.encounterId ?? undefined,
          kind: "SOAP_NOTE",
          status: input.status ?? "DRAFT",
          templateId: input.templateId ?? undefined,
          templateVersion: input.templateVersion ?? undefined,
          templateVersionId: input.templateVersionId ?? undefined,
          authorId: input.authorId ?? undefined,
          summary: toNullableString(input.summary),
        },
      });

      const createdSoapNote = await txPrisma.soapNote.create({
        data: {
          artifactId: createdArtifact.id,
          subjective: toNullableJsonInput(input.subjective),
          objective: toNullableJsonInput(input.objective),
          assessment: toNullableJsonInput(input.assessment),
          plan: toNullableJsonInput(input.plan),
          diagnoses: toNullableJsonInput(input.diagnoses),
          metadata: toNullableJsonInput(input.metadata),
        },
      });

      if (DOCUMENT_BACKED_CLINICAL_KINDS.has(createdArtifact.kind)) {
        await createRenderedDocumentRecord(
          buildClinicalArtifactRenderedDocumentInput({
            id: createdArtifact.id,
            organisationId: createdArtifact.organisationId,
            kind: createdArtifact.kind,
            templateId: createdArtifact.templateId,
            templateVersion: createdArtifact.templateVersion,
            templateVersionId: createdArtifact.templateVersionId,
          }),
          tx,
        );
      }

      return {
        artifact: createdArtifact,
        soapNote: createdSoapNote,
      };
    });

    return artifact;
  },

  async updateSoapNote(
    soapNoteId: string,
    input: SoapNoteUpdateInput,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    const note = await loadSoapNoteOrThrow(soapNoteId);
    assertSoapNoteArtifact(note.artifact, organisationId);

    if (
      isFinalClinicalArtifactStatus(note.artifact.status) &&
      (input.status === undefined ||
        isFinalClinicalArtifactStatus(input.status))
    ) {
      throw new ClinicalArtifactServiceError(
        "Artifact is final. Reopen or amend it before editing.",
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const artifact = await tx.clinicalArtifact.update({
        where: { id: note.artifact.id },
        data: {
          status: input.status ?? note.artifact.status,
          summary:
            input.summary === undefined
              ? note.artifact.summary
              : toNullableString(input.summary),
        },
      });

      const soapNote = await tx.soapNote.update({
        where: { id: note.id },
        data: {
          subjective:
            input.subjective === undefined
              ? toNullableJsonInput(note.subjective)
              : toNullableJsonInput(input.subjective),
          objective:
            input.objective === undefined
              ? toNullableJsonInput(note.objective)
              : toNullableJsonInput(input.objective),
          assessment:
            input.assessment === undefined
              ? toNullableJsonInput(note.assessment)
              : toNullableJsonInput(input.assessment),
          plan:
            input.plan === undefined
              ? toNullableJsonInput(note.plan)
              : toNullableJsonInput(input.plan),
          diagnoses:
            input.diagnoses === undefined
              ? toNullableJsonInput(note.diagnoses)
              : toNullableJsonInput(input.diagnoses),
          metadata:
            input.metadata === undefined
              ? toNullableJsonInput(note.metadata)
              : toNullableJsonInput(input.metadata),
        },
      });

      return { artifact, soapNote };
    });

    return updated;
  },

  async getSoapNote(
    soapNoteId: string,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    const note = await loadSoapNoteOrThrow(soapNoteId);
    assertSoapNoteArtifact(note.artifact, organisationId);

    return {
      artifact: note.artifact,
      soapNote: note,
    };
  },

  async listSoapNotesForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<SoapNoteRecord[]> {
    const records = await prisma.soapNote.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "SOAP_NOTE",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record: SoapNoteWithArtifact) => ({
      artifact: record.artifact,
      soapNote: record,
    }));
  },

  async listSoapNotesForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<SoapNoteRecord[]> {
    const records = await prisma.soapNote.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "SOAP_NOTE",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record: SoapNoteWithArtifact) => ({
      artifact: record.artifact,
      soapNote: record,
    }));
  },

  async createPrescription(
    input: PrescriptionInput,
  ): Promise<PrescriptionRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await txPrisma.clinicalArtifact.create({
        data: {
          organisationId,
          appointmentId: input.appointmentId ?? undefined,
          caseId: input.caseId ?? undefined,
          encounterId: input.encounterId ?? undefined,
          kind: "PRESCRIPTION",
          status: input.status ?? "DRAFT",
          templateId: input.templateId ?? undefined,
          templateVersion: input.templateVersion ?? undefined,
          templateVersionId: input.templateVersionId ?? undefined,
          authorId: input.authorId ?? undefined,
          summary: toNullableString(input.summary),
        },
      });

      const createdPrescription = await txPrisma.prescription.create({
        data: {
          artifactId: createdArtifact.id,
          medications: toNullableJsonInput(input.medications),
          instructions: toNullableJsonInput(input.instructions),
          notes: toNullableJsonInput(input.notes),
          metadata: toNullableJsonInput(input.metadata),
        },
      });

      if (DOCUMENT_BACKED_CLINICAL_KINDS.has(createdArtifact.kind)) {
        await createRenderedDocumentRecord(
          buildClinicalArtifactRenderedDocumentInput({
            id: createdArtifact.id,
            organisationId: createdArtifact.organisationId,
            kind: createdArtifact.kind,
            templateId: createdArtifact.templateId,
            templateVersion: createdArtifact.templateVersion,
            templateVersionId: createdArtifact.templateVersionId,
          }),
          tx,
        );
      }

      return buildPrescriptionRecord(createdArtifact, createdPrescription);
    });

    if (shouldConsumeInventoryForPrescription(artifact.artifact.status)) {
      await InventoryConsumptionService.consumePrescription({
        organisationId,
        prescriptionId: artifact.prescription.id,
        medications: artifact.prescription.medications,
        metadata: artifact.prescription.metadata as
          | Prisma.InputJsonValue
          | undefined,
      });
    }

    return artifact;
  },

  async updatePrescription(
    prescriptionId: string,
    input: PrescriptionUpdateInput,
    organisationId?: string,
  ): Promise<PrescriptionRecord> {
    const record = await loadPrescriptionOrThrow(prescriptionId);
    assertArtifactKind(
      record.artifact,
      "PRESCRIPTION",
      "prescription",
      organisationId,
    );

    if (
      isFinalClinicalArtifactStatus(record.artifact.status) &&
      (input.status === undefined ||
        isFinalClinicalArtifactStatus(input.status))
    ) {
      throw new ClinicalArtifactServiceError(
        "Artifact is final. Reopen or amend it before editing.",
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const artifact = await txPrisma.clinicalArtifact.update({
        where: { id: record.artifact.id },
        data: {
          status: input.status ?? record.artifact.status,
          summary:
            input.summary === undefined
              ? record.artifact.summary
              : toNullableString(input.summary),
        },
      });

      const prescription = await txPrisma.prescription.update({
        where: { id: record.id },
        data: {
          medications:
            input.medications === undefined
              ? toNullableJsonInput(record.medications)
              : toNullableJsonInput(input.medications),
          instructions:
            input.instructions === undefined
              ? toNullableJsonInput(record.instructions)
              : toNullableJsonInput(input.instructions),
          notes:
            input.notes === undefined
              ? toNullableJsonInput(record.notes)
              : toNullableJsonInput(input.notes),
          metadata:
            input.metadata === undefined
              ? toNullableJsonInput(record.metadata)
              : toNullableJsonInput(input.metadata),
        },
      });

      return buildPrescriptionRecord(artifact, prescription);
    });

    const wasConsumed = shouldConsumeInventoryForPrescription(
      record.artifact.status,
    );
    const isConsumed = shouldConsumeInventoryForPrescription(
      updated.artifact.status,
    );
    const medicationChanged = !isSamePrescriptionPayload(
      updated.prescription.medications,
      record.medications,
    );

    if (wasConsumed && !isConsumed) {
      await InventoryConsumptionService.releasePrescription({
        organisationId: updated.artifact.organisationId,
        prescriptionId: updated.prescription.id,
        medications: record.medications,
        metadata: record.metadata as Prisma.InputJsonValue | undefined,
      });
    } else if (!wasConsumed && isConsumed) {
      await InventoryConsumptionService.consumePrescription({
        organisationId: updated.artifact.organisationId,
        prescriptionId: updated.prescription.id,
        medications: updated.prescription.medications,
        metadata: updated.prescription.metadata as
          | Prisma.InputJsonValue
          | undefined,
      });
    } else if (wasConsumed && isConsumed && medicationChanged) {
      await InventoryConsumptionService.releasePrescription({
        organisationId: updated.artifact.organisationId,
        prescriptionId: updated.prescription.id,
        medications: record.medications,
        metadata: record.metadata as Prisma.InputJsonValue | undefined,
      });
      await InventoryConsumptionService.consumePrescription({
        organisationId: updated.artifact.organisationId,
        prescriptionId: updated.prescription.id,
        medications: updated.prescription.medications,
        metadata: updated.prescription.metadata as
          | Prisma.InputJsonValue
          | undefined,
      });
    }

    return updated;
  },

  async getPrescription(
    prescriptionId: string,
    organisationId?: string,
  ): Promise<PrescriptionRecord> {
    const record = await loadPrescriptionOrThrow(prescriptionId);
    assertArtifactKind(
      record.artifact,
      "PRESCRIPTION",
      "prescription",
      organisationId,
    );

    return toPrescriptionRecord(record);
  },

  async listPrescriptionsForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<PrescriptionRecord[]> {
    const records = await clinicalPrisma.prescription.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "PRESCRIPTION",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map(toPrescriptionRecord);
  },

  async listPrescriptionsForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<PrescriptionRecord[]> {
    const records = await clinicalPrisma.prescription.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "PRESCRIPTION",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map(toPrescriptionRecord);
  },

  async createDischargeSummary(
    input: DischargeSummaryInput,
  ): Promise<DischargeSummaryRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await txPrisma.clinicalArtifact.create({
        data: {
          organisationId,
          appointmentId: input.appointmentId ?? undefined,
          caseId: input.caseId ?? undefined,
          encounterId: input.encounterId ?? undefined,
          kind: "DISCHARGE_SUMMARY",
          status: input.status ?? "DRAFT",
          templateId: input.templateId ?? undefined,
          templateVersion: input.templateVersion ?? undefined,
          templateVersionId: input.templateVersionId ?? undefined,
          authorId: input.authorId ?? undefined,
          summary: toNullableString(input.summary),
        },
      });

      const createdDischargeSummary = await txPrisma.dischargeSummary.create({
        data: {
          artifactId: createdArtifact.id,
          summary: toNullableJsonInput(input.summaryContent),
          diagnoses: toNullableJsonInput(input.diagnoses),
          medications: toNullableJsonInput(input.medications),
          followUp: toNullableJsonInput(input.followUp),
          instructions: toNullableJsonInput(input.instructions),
          metadata: toNullableJsonInput(input.metadata),
        },
      });

      if (DOCUMENT_BACKED_CLINICAL_KINDS.has(createdArtifact.kind)) {
        await createRenderedDocumentRecord(
          buildClinicalArtifactRenderedDocumentInput({
            id: createdArtifact.id,
            organisationId: createdArtifact.organisationId,
            kind: createdArtifact.kind,
            templateId: createdArtifact.templateId,
            templateVersion: createdArtifact.templateVersion,
            templateVersionId: createdArtifact.templateVersionId,
          }),
          tx,
        );
      }

      return buildDischargeSummaryRecord(
        createdArtifact,
        createdDischargeSummary,
      );
    });

    return artifact;
  },

  async updateDischargeSummary(
    dischargeSummaryId: string,
    input: DischargeSummaryUpdateInput,
    organisationId?: string,
  ): Promise<DischargeSummaryRecord> {
    const record = await loadDischargeSummaryOrThrow(dischargeSummaryId);
    assertArtifactKind(
      record.artifact,
      "DISCHARGE_SUMMARY",
      "discharge summary",
      organisationId,
    );

    if (
      isFinalClinicalArtifactStatus(record.artifact.status) &&
      (input.status === undefined ||
        isFinalClinicalArtifactStatus(input.status))
    ) {
      throw new ClinicalArtifactServiceError(
        "Artifact is final. Reopen or amend it before editing.",
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const artifact = await txPrisma.clinicalArtifact.update({
        where: { id: record.artifact.id },
        data: {
          status: input.status ?? record.artifact.status,
          summary:
            input.summary === undefined
              ? record.artifact.summary
              : toNullableString(input.summary),
        },
      });

      const dischargeSummary = await txPrisma.dischargeSummary.update({
        where: { id: record.id },
        data: {
          summary:
            input.summaryContent === undefined
              ? toNullableJsonInput(record.summary)
              : toNullableJsonInput(input.summaryContent),
          diagnoses:
            input.diagnoses === undefined
              ? toNullableJsonInput(record.diagnoses)
              : toNullableJsonInput(input.diagnoses),
          medications:
            input.medications === undefined
              ? toNullableJsonInput(record.medications)
              : toNullableJsonInput(input.medications),
          followUp:
            input.followUp === undefined
              ? toNullableJsonInput(record.followUp)
              : toNullableJsonInput(input.followUp),
          instructions:
            input.instructions === undefined
              ? toNullableJsonInput(record.instructions)
              : toNullableJsonInput(input.instructions),
          metadata:
            input.metadata === undefined
              ? toNullableJsonInput(record.metadata)
              : toNullableJsonInput(input.metadata),
        },
      });

      return buildDischargeSummaryRecord(artifact, dischargeSummary);
    });

    return updated;
  },

  async getDischargeSummary(
    dischargeSummaryId: string,
    organisationId?: string,
  ): Promise<DischargeSummaryRecord> {
    const record = await loadDischargeSummaryOrThrow(dischargeSummaryId);
    assertArtifactKind(
      record.artifact,
      "DISCHARGE_SUMMARY",
      "discharge summary",
      organisationId,
    );

    return toDischargeSummaryRecord(record);
  },

  async listDischargeSummariesForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<DischargeSummaryRecord[]> {
    const records = await clinicalPrisma.dischargeSummary.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "DISCHARGE_SUMMARY",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map(toDischargeSummaryRecord);
  },

  async listDischargeSummariesForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<DischargeSummaryRecord[]> {
    const records = await clinicalPrisma.dischargeSummary.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "DISCHARGE_SUMMARY",
        },
      },
      include: { artifact: true },
      orderBy: { createdAt: "desc" },
    });

    return records.map(toDischargeSummaryRecord);
  },

  async createVitalRecord(input: VitalRecordInput): Promise<VitalRecordRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const measuredAt = toDate(input.measuredAt, "measuredAt");
    if (!measuredAt) {
      throw new ClinicalArtifactServiceError("Invalid measuredAt", 400);
    }

    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await txPrisma.clinicalArtifact.create({
        data: {
          organisationId,
          appointmentId: input.appointmentId ?? undefined,
          caseId: input.caseId ?? undefined,
          encounterId: input.encounterId ?? undefined,
          kind: "VITAL_RECORD",
          status: input.status ?? "DRAFT",
          templateId: input.templateId ?? undefined,
          templateVersion: input.templateVersion ?? undefined,
          templateVersionId: input.templateVersionId ?? undefined,
          authorId: input.authorId ?? undefined,
          summary: toNullableString(input.summary),
        },
      });

      const createdVitalRecord = await txPrisma.vitalRecord.create({
        data: {
          artifactId: createdArtifact.id,
          measuredAt,
          recordedBy: toNullableString(input.recordedBy),
          vitals: toJsonInput(input.vitals),
          notes: toNullableJsonInput(input.notes),
          metadata: toNullableJsonInput(input.metadata),
        },
      });

      if (DOCUMENT_BACKED_CLINICAL_KINDS.has(createdArtifact.kind)) {
        await createRenderedDocumentRecord(
          buildClinicalArtifactRenderedDocumentInput({
            id: createdArtifact.id,
            organisationId: createdArtifact.organisationId,
            kind: createdArtifact.kind,
            templateId: createdArtifact.templateId,
            templateVersion: createdArtifact.templateVersion,
            templateVersionId: createdArtifact.templateVersionId,
          }),
          tx,
        );
      }

      return buildVitalRecordRecord(createdArtifact, createdVitalRecord);
    });

    return artifact;
  },

  async updateVitalRecord(
    vitalRecordId: string,
    input: VitalRecordUpdateInput,
    organisationId?: string,
  ): Promise<VitalRecordRecord> {
    const record = await loadVitalRecordOrThrow(vitalRecordId);
    assertArtifactKind(
      record.artifact,
      "VITAL_RECORD",
      "vital record",
      organisationId,
    );

    if (
      isFinalClinicalArtifactStatus(record.artifact.status) &&
      (input.status === undefined ||
        isFinalClinicalArtifactStatus(input.status))
    ) {
      throw new ClinicalArtifactServiceError(
        "Artifact is final. Reopen or amend it before editing.",
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const artifact = await txPrisma.clinicalArtifact.update({
        where: { id: record.artifact.id },
        data: {
          status: input.status ?? record.artifact.status,
          summary:
            input.summary === undefined
              ? record.artifact.summary
              : toNullableString(input.summary),
        },
      });

      const vitalRecord = await txPrisma.vitalRecord.update({
        where: { id: record.id },
        data: {
          measuredAt:
            input.measuredAt === undefined
              ? record.measuredAt
              : (toDate(input.measuredAt, "measuredAt") ?? record.measuredAt),
          recordedBy:
            input.recordedBy === undefined
              ? record.recordedBy
              : toNullableString(input.recordedBy),
          vitals:
            input.vitals === undefined
              ? toJsonInput(record.vitals)
              : toJsonInput(input.vitals),
          notes:
            input.notes === undefined
              ? toNullableJsonInput(record.notes)
              : toNullableJsonInput(input.notes),
          metadata:
            input.metadata === undefined
              ? toNullableJsonInput(record.metadata)
              : toNullableJsonInput(input.metadata),
        },
      });

      return buildVitalRecordRecord(artifact, vitalRecord);
    });

    return updated;
  },

  async getVitalRecord(
    vitalRecordId: string,
    organisationId?: string,
  ): Promise<VitalRecordRecord> {
    const record = await loadVitalRecordOrThrow(vitalRecordId);
    assertArtifactKind(
      record.artifact,
      "VITAL_RECORD",
      "vital record",
      organisationId,
    );

    return toVitalRecordRecord(record);
  },

  async listVitalRecordsForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<VitalRecordRecord[]> {
    const records = await clinicalPrisma.vitalRecord.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "VITAL_RECORD",
        },
      },
      include: { artifact: true },
      orderBy: { measuredAt: "desc" },
    });

    return records.map(toVitalRecordRecord);
  },

  async listVitalRecordsForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<VitalRecordRecord[]> {
    const records = await clinicalPrisma.vitalRecord.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "VITAL_RECORD",
        },
      },
      include: { artifact: true },
      orderBy: { measuredAt: "desc" },
    });

    return records.map(toVitalRecordRecord);
  },

  async finalizeSoapNote(
    soapNoteId: string,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    return ClinicalArtifactService.updateSoapNote(
      soapNoteId,
      { status: "COMPLETED" },
      organisationId,
    );
  },

  async reopenSoapNote(
    soapNoteId: string,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    return ClinicalArtifactService.updateSoapNote(
      soapNoteId,
      { status: "IN_PROGRESS" },
      organisationId,
    );
  },

  async amendSoapNote(
    soapNoteId: string,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    const note = await ClinicalArtifactService.getSoapNote(
      soapNoteId,
      organisationId,
    );
    return ClinicalArtifactService.createSoapNote(
      soapNoteInputFromRecord(note),
    );
  },

  async finalizePrescription(
    prescriptionId: string,
    organisationId?: string,
  ): Promise<PrescriptionRecord> {
    return ClinicalArtifactService.updatePrescription(
      prescriptionId,
      { status: "COMPLETED" },
      organisationId,
    );
  },

  async reopenPrescription(
    prescriptionId: string,
    organisationId?: string,
  ): Promise<PrescriptionRecord> {
    return ClinicalArtifactService.updatePrescription(
      prescriptionId,
      { status: "IN_PROGRESS" },
      organisationId,
    );
  },

  async amendPrescription(
    prescriptionId: string,
    organisationId?: string,
  ): Promise<PrescriptionRecord> {
    const record = await ClinicalArtifactService.getPrescription(
      prescriptionId,
      organisationId,
    );
    return ClinicalArtifactService.createPrescription(
      prescriptionInputFromRecord(record),
    );
  },

  async finalizeDischargeSummary(
    dischargeSummaryId: string,
    organisationId?: string,
  ): Promise<DischargeSummaryRecord> {
    return ClinicalArtifactService.updateDischargeSummary(
      dischargeSummaryId,
      { status: "COMPLETED" },
      organisationId,
    );
  },

  async reopenDischargeSummary(
    dischargeSummaryId: string,
    organisationId?: string,
  ): Promise<DischargeSummaryRecord> {
    return ClinicalArtifactService.updateDischargeSummary(
      dischargeSummaryId,
      { status: "IN_PROGRESS" },
      organisationId,
    );
  },

  async amendDischargeSummary(
    dischargeSummaryId: string,
    organisationId?: string,
  ): Promise<DischargeSummaryRecord> {
    const record = await ClinicalArtifactService.getDischargeSummary(
      dischargeSummaryId,
      organisationId,
    );
    return ClinicalArtifactService.createDischargeSummary(
      dischargeSummaryInputFromRecord(record),
    );
  },

  async finalizeVitalRecord(
    vitalRecordId: string,
    organisationId?: string,
  ): Promise<VitalRecordRecord> {
    return ClinicalArtifactService.updateVitalRecord(
      vitalRecordId,
      { status: "COMPLETED" },
      organisationId,
    );
  },

  async reopenVitalRecord(
    vitalRecordId: string,
    organisationId?: string,
  ): Promise<VitalRecordRecord> {
    return ClinicalArtifactService.updateVitalRecord(
      vitalRecordId,
      { status: "IN_PROGRESS" },
      organisationId,
    );
  },

  async amendVitalRecord(
    vitalRecordId: string,
    organisationId?: string,
  ): Promise<VitalRecordRecord> {
    const record = await ClinicalArtifactService.getVitalRecord(
      vitalRecordId,
      organisationId,
    );
    return ClinicalArtifactService.createVitalRecord(
      vitalRecordInputFromRecord(record),
    );
  },
};
