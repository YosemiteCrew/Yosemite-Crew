import {
  Prisma,
  ClinicalArtifactKind,
  ClinicalArtifactStatus,
} from "@prisma/client";
import {
  buildRenderedDocumentPdfSnapshot,
  type RenderedDocumentKind,
  type ImmunizationRecord,
  type RabiesTitrationRecord,
  type ParasiteTreatmentRecord,
  type ClinicalExaminationRecord,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { uploadBufferAsFile } from "src/middlewares/upload";
import {
  createRenderedDocumentRecord,
  type PersistRenderedDocumentInput,
} from "src/services/rendered-document.service";
import { renderRenderedDocumentPdfWithMetadata } from "src/services/rendered-document-renderer.service";
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
  include: { artifact: true; items: true };
}>;

type PrescriptionItemModel =
  Prisma.PrescriptionItemGetPayload<Prisma.PrescriptionItemDefaultArgs>;

type PrescriptionModel = Prisma.PrescriptionGetPayload<{
  include: { items: true };
}>;

type PrescriptionDispenseRequestModel =
  Prisma.PrescriptionDispenseRequestGetPayload<Prisma.PrescriptionDispenseRequestDefaultArgs>;

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

type VitalRecordPresentation = VitalRecordModel & {
  recordedByDisplay?: string | null;
};

type ClinicalPrisma = typeof prisma & {
  appointment: {
    updateMany(
      args: Prisma.AppointmentUpdateManyArgs,
    ): Promise<Prisma.BatchPayload>;
  };
  workspaceTreatmentItem: {
    findFirst(
      args: Prisma.WorkspaceTreatmentItemFindFirstArgs,
    ): Promise<Prisma.WorkspaceTreatmentItemGetPayload<Prisma.WorkspaceTreatmentItemDefaultArgs> | null>;
    deleteMany(
      args: Prisma.WorkspaceTreatmentItemDeleteManyArgs,
    ): Promise<Prisma.BatchPayload>;
  };
  prescription: {
    findFirst(
      args: Prisma.PrescriptionFindFirstArgs,
    ): Promise<PrescriptionWithArtifact | null>;
    findUnique(
      args: Prisma.PrescriptionFindUniqueArgs,
    ): Promise<PrescriptionWithArtifact | null>;
    findMany(
      args: Prisma.PrescriptionFindManyArgs,
    ): Promise<PrescriptionWithArtifact[]>;
    create(args: Prisma.PrescriptionCreateArgs): Promise<PrescriptionModel>;
    update(args: Prisma.PrescriptionUpdateArgs): Promise<PrescriptionModel>;
  };
  prescriptionDispenseRequest: {
    findFirst(
      args: Prisma.PrescriptionDispenseRequestFindFirstArgs,
    ): Promise<PrescriptionDispenseRequestModel | null>;
    create(
      args: Prisma.PrescriptionDispenseRequestCreateArgs,
    ): Promise<PrescriptionDispenseRequestModel>;
    update(
      args: Prisma.PrescriptionDispenseRequestUpdateArgs,
    ): Promise<PrescriptionDispenseRequestModel>;
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

const shouldCreateDispenseRequestForPrescription = (
  status: ClinicalArtifactStatus,
) => status === "SIGNED" || status === "COMPLETED";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

type PrescriptionItemInput = {
  sourceLineKey?: string;
  medication: string;
  strength?: string;
  dosage?: string;
  route?: string;
  frequency?: string;
  duration?: string;
  quantity?: number;
  instructions?: string;
  refill?: string;
  inventoryItemId?: string;
  inventoryItemSku?: string;
  batchId?: string;
  batchNumber?: string;
  lotNumber?: string;
  expiryDate?: Date | string;
  metadata?: unknown;
  sortOrder: number;
};

const readPrescriptionItemString = (
  item: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
};

const toPositivePrescriptionQuantity = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    const quantity = Math.trunc(value);
    return quantity > 0 ? quantity : undefined;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const quantity = Math.trunc(parsed);
      return quantity > 0 ? quantity : undefined;
    }
  }

  return undefined;
};

const readPrescriptionItemQuantity = (
  item: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const quantity = toPositivePrescriptionQuantity(item[key]);
    if (quantity !== undefined) {
      return quantity;
    }
  }

  return undefined;
};

const normalizePrescriptionItemInputs = (
  value: unknown,
): PrescriptionItemInput[] => {
  const source = Array.isArray(value) ? value : [];

  return source.map((item, index) => {
    if (!isRecord(item)) {
      return {
        medication: String(item ?? "").trim(),
        sortOrder: index,
      };
    }

    return {
      sourceLineKey: readPrescriptionItemString(item, ["sourceLineKey", "id"]),
      medication:
        readPrescriptionItemString(item, [
          "medication",
          "medicineName",
          "name",
          "drug",
          "product",
        ]) ?? "",
      strength: readPrescriptionItemString(item, ["strength", "doseStrength"]),
      dosage: readPrescriptionItemString(item, ["dosage", "dose"]),
      route: readPrescriptionItemString(item, [
        "route",
        "routeOfAdministration",
        "administrationRoute",
      ]),
      frequency: readPrescriptionItemString(item, ["frequency", "freq"]),
      duration: readPrescriptionItemString(item, [
        "duration",
        "durationDays",
        "days",
      ]),
      refill: readPrescriptionItemString(item, ["refill"]),
      quantity: readPrescriptionItemQuantity(item, [
        "quantity",
        "qty",
        "units",
        "count",
        "dispenseQuantity",
      ]),
      instructions: readPrescriptionItemString(item, [
        "instructions",
        "instruction",
        "sig",
      ]),
      inventoryItemId: readPrescriptionItemString(item, ["inventoryItemId"]),
      inventoryItemSku: readPrescriptionItemString(item, [
        "inventoryItemSku",
        "sku",
      ]),
      batchId: readPrescriptionItemString(item, [
        "batchId",
        "inventoryBatchId",
      ]),
      batchNumber: readPrescriptionItemString(item, ["batchNumber"]),
      lotNumber: readPrescriptionItemString(item, ["lotNumber"]),
      expiryDate:
        item.expiryDate instanceof Date || typeof item.expiryDate === "string"
          ? item.expiryDate
          : undefined,
      metadata: item.metadata === undefined ? undefined : item.metadata,
      sortOrder: index,
    };
  });
};

const prescriptionItemRowsToCreate = (items: PrescriptionItemInput[]) =>
  items.map((item) => ({
    sourceLineKey: item.sourceLineKey,
    medication: item.medication,
    strength: item.strength,
    dosage: item.dosage,
    route: item.route,
    frequency: item.frequency,
    duration: item.duration,
    quantity: item.quantity === undefined ? undefined : String(item.quantity),
    instructions: item.instructions,
    refill: item.refill,
    inventoryItemId: item.inventoryItemId,
    inventoryItemSku: item.inventoryItemSku,
    batchId: item.batchId,
    batchNumber: item.batchNumber,
    lotNumber: item.lotNumber,
    expiryDate: (() => {
      if (item.expiryDate instanceof Date) return item.expiryDate;
      if (typeof item.expiryDate === "string") {
        const parsed = new Date(item.expiryDate);
        return Number.isNaN(parsed.getTime()) ? undefined : parsed;
      }
      return undefined;
    })(),
    metadata:
      item.metadata === undefined
        ? undefined
        : (item.metadata as Prisma.InputJsonValue),
    sortOrder: item.sortOrder,
  }));

const prescriptionItemRowsToJson = (items: PrescriptionItemModel[]) =>
  items.map((item) => ({
    sourceLineKey: item.sourceLineKey ?? undefined,
    medication: item.medication,
    strength: item.strength,
    dosage: item.dosage,
    route: item.route,
    frequency: item.frequency,
    duration: item.duration,
    quantity: item.quantity === null ? undefined : Number(item.quantity),
    instructions: item.instructions,
    refill: item.refill ?? undefined,
    inventoryItemId: item.inventoryItemId ?? undefined,
    inventoryItemSku: item.inventoryItemSku ?? undefined,
    batchId: item.batchId ?? undefined,
    batchNumber: item.batchNumber ?? undefined,
    lotNumber: item.lotNumber ?? undefined,
    expiryDate: item.expiryDate ? item.expiryDate.toISOString() : undefined,
    metadata: item.metadata === undefined ? undefined : item.metadata,
  }));

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
  items?: unknown;
  medications?: unknown;
  instructions?: unknown;
  notes?: unknown;
  metadata?: unknown;
};

export type PrescriptionUpdateInput = Partial<
  Pick<
    PrescriptionInput,
    | "status"
    | "summary"
    | "items"
    | "medications"
    | "instructions"
    | "notes"
    | "metadata"
  >
>;

export type PrescriptionRecord = {
  artifact: SoapNoteRecord["artifact"] & {
    kind: "PRESCRIPTION";
  };
  prescription: {
    id: string;
    artifactId: string;
    items: PrescriptionItemModel[];
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
  recordedByDisplay?: string | null;
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
    | "recordedByDisplay"
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
    recordedByDisplay?: string | null;
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
  return value;
};

const toJsonInput = (
  value: unknown,
  fallback: Record<string, unknown> = {},
): Prisma.InputJsonValue => value ?? fallback;

const toNullableString = (value: string | null | undefined) => {
  if (value === undefined) return undefined;
  return value === null ? null : value.trim();
};

const toOptionalDisplay = (value: string | null | undefined) => {
  const normalized = toNullableString(value);
  if (normalized === undefined) return undefined;
  return normalized && normalized.length > 0 ? normalized : null;
};

const normalizePractitionerReference = (value: string | null | undefined) => {
  if (!value) return undefined;
  return value.replace(/^Practitioner\//, "").trim() || undefined;
};

const readRecordedByDisplay = (metadata: Prisma.JsonValue | null) => {
  if (!isRecord(metadata)) {
    return null;
  }

  const display = metadata.recordedByDisplay;
  if (typeof display !== "string") {
    return null;
  }

  const trimmed = display.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const mergeVitalRecordMetadata = (
  currentMetadata: Prisma.JsonValue | null,
  nextMetadata: unknown,
  nextRecordedByDisplay: string | null | undefined,
) => {
  const baseMetadata =
    nextMetadata === undefined ? currentMetadata : nextMetadata;
  const currentDisplay = readRecordedByDisplay(currentMetadata);
  const display =
    nextRecordedByDisplay === undefined
      ? currentDisplay
      : nextRecordedByDisplay;

  if (display === undefined) {
    return baseMetadata;
  }

  if (baseMetadata === null || baseMetadata === undefined) {
    return display === null ? null : { recordedByDisplay: display };
  }

  if (isRecord(baseMetadata)) {
    return {
      ...baseMetadata,
      recordedByDisplay: display,
    };
  }

  return baseMetadata;
};

/**
 * The display name for a vital record's `recordedBy`.
 *
 * `recordedBy` can be derived from an untrusted `Observation.performer.reference`
 * on the FHIR create/update path, so resolving it to a name with a bare user
 * lookup turned this into a directory: name a practitioner id from another
 * tenant and read their first and last name back as `performer.display`. The
 * lookup is therefore restricted to people who actually hold an active
 * membership in the artifact's own organisation, and an id that does not
 * resolve simply produces no display name.
 */
const resolveVitalRecordRecordedByDisplay = async (
  record: Pick<VitalRecordModel, "recordedBy" | "metadata">,
  organisationId?: string | null,
): Promise<string | null> => {
  const metadataDisplay = readRecordedByDisplay(record.metadata);
  if (metadataDisplay) {
    return metadataDisplay;
  }

  const normalizedRecordedBy = normalizePractitionerReference(
    record.recordedBy,
  );
  if (!normalizedRecordedBy) {
    return null;
  }

  const org = organisationId?.trim();
  if (!org) {
    return null;
  }

  const membership = await prisma.userOrganization.findFirst({
    where: {
      practitionerReference: normalizedRecordedBy,
      active: true,
      OR: [
        { organizationReference: org },
        { organizationReference: `Organization/${org}` },
      ],
    },
    select: { id: true },
  });
  if (!membership) {
    return null;
  }

  const user = await prisma.user.findFirst({
    where: {
      userId: normalizedRecordedBy,
    },
    select: {
      firstName: true,
      lastName: true,
    },
  });

  if (!user) {
    return null;
  }

  const display = [user.firstName, user.lastName]
    .filter(
      (part): part is string => typeof part === "string" && part.length > 0,
    )
    .join(" ")
    .trim();

  return display.length > 0 ? display : null;
};

const hydrateVitalRecord = async (
  record: VitalRecordWithArtifact,
): Promise<VitalRecordRecord> => {
  const recordedByDisplay = await resolveVitalRecordRecordedByDisplay(
    record,
    record.artifact.organisationId,
  );

  return buildVitalRecordRecord(record.artifact, {
    id: record.id,
    artifactId: record.artifactId,
    measuredAt: record.measuredAt,
    recordedBy: record.recordedBy,
    recordedByDisplay,
    vitals: record.vitals,
    notes: record.notes,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });
};

// The clinical kinds rendered to a signable document. Only these reach the
// rendered-document pipeline; the passport kinds (Immunization / RabiesTitration /
// ParasiteTreatment) are not document-backed yet, so they never flow here.
type RenderableClinicalKind =
  "SOAP_NOTE" | "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "VITAL_RECORD";

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
  IMMUNIZATION: "Vaccination record",
  RABIES_TITRATION: "Rabies titration",
  PARASITE_TREATMENT: "Parasite treatment",
  CLINICAL_EXAM: "Clinical examination",
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

const persistClinicalArtifactRenderedDocumentPdf = async (
  artifactId: string,
) => {
  const renderedDocument = await prisma.renderedDocument.findUnique({
    where: { clinicalArtifactId: ensureId(artifactId, "artifactId") },
  });

  if (!renderedDocument) {
    return;
  }

  const renderedPdf = await renderRenderedDocumentPdfWithMetadata({
    title: renderedDocument.title,
    source: {
      sourceKind: renderedDocument.sourceKind,
      sourceId: renderedDocument.sourceId,
      organisationId: renderedDocument.organisationId,
      templateKind: renderedDocument.kind as RenderableClinicalKind,
      templateId: renderedDocument.templateId,
      templateVersion: renderedDocument.templateVersion,
      templateVersionId: renderedDocument.templateVersionId,
    },
  });

  const upload = await uploadBufferAsFile(renderedPdf.pdf, {
    folderName: `rendered-documents/${renderedDocument.organisationId}`,
    mimeType: "application/pdf",
    originalName: `${renderedDocument.kind.toLowerCase().replaceAll("_", "-")}-${renderedDocument.id}.pdf`,
  });

  const nextPdf =
    renderedDocument.pdf &&
    typeof renderedDocument.pdf === "object" &&
    !Array.isArray(renderedDocument.pdf)
      ? {
          ...(renderedDocument.pdf as Record<string, unknown>),
          signaturePlacement: renderedPdf.signaturePlacement,
        }
      : {
          ...buildRenderedDocumentPdfSnapshot({
            title: renderedDocument.title,
            kind: renderedDocument.kind as RenderedDocumentKind,
            source: {
              sourceKind: renderedDocument.sourceKind,
              sourceId: renderedDocument.sourceId,
              organisationId: renderedDocument.organisationId,
              templateKind: renderedDocument.kind as RenderableClinicalKind,
              templateId: renderedDocument.templateId,
              templateVersion: renderedDocument.templateVersion,
              templateVersionId: renderedDocument.templateVersionId,
            },
          }),
          signaturePlacement: renderedPdf.signaturePlacement,
        };

  await prisma.renderedDocument.update({
    where: { id: renderedDocument.id },
    data: {
      pdfUrl: upload.url,
      pdf: nextPdf,
    },
  });
};

/**
 * Who is asking, and whether they hold the org-wide prescription edit
 * permission. Roles that only hold `prescription:edit:own` may act on the
 * prescriptions they authored, so the record's author is the deciding factor
 * and cannot be inferred from the permission set alone.
 */
export interface PrescriptionActor {
  actorId: string;
  canEditAny: boolean;
}

/**
 * Every prescription mutation is reachable by roles holding only own-scope
 * edit, so the author on the loaded artifact is what separates them from
 * org-wide editors. Callers that have already loaded the record use this
 * directly rather than fetching it twice.
 */
const assertActorMayMutateArtifact = (
  artifact: { authorId: string | null },
  actor: PrescriptionActor,
) => {
  if (actor.canEditAny) {
    return;
  }

  if (!actor.actorId || artifact.authorId !== actor.actorId) {
    throw new ClinicalArtifactServiceError(
      "Prescription was authored by another user",
      403,
    );
  }
};

const assertActorMayMutatePrescription = async (
  prescriptionId: string,
  organisationId: string | undefined,
  actor: PrescriptionActor,
) => {
  if (actor.canEditAny) {
    return;
  }

  const record = await loadPrescriptionOrThrow(prescriptionId);
  assertArtifactKind(
    record.artifact,
    "PRESCRIPTION",
    "prescription",
    organisationId,
  );

  assertActorMayMutateArtifact(record.artifact, actor);
};

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

const prescriptionMedicationsFromItems = (
  prescription: Pick<PrescriptionModel, "items" | "medications">,
) => {
  const items = prescription.items ?? [];
  if (items.length > 0) {
    return prescriptionItemRowsToJson(items);
  }

  return prescription.medications;
};

const buildPrescriptionRecord = (
  artifact: SoapNoteRecord["artifact"],
  prescription: PrescriptionModel,
): PrescriptionRecord => ({
  artifact: toClinicalArtifactKind(artifact, "PRESCRIPTION"),
  prescription: {
    id: prescription.id,
    artifactId: prescription.artifactId,
    items: prescription.items ?? [],
    medications: prescriptionMedicationsFromItems(prescription),
    instructions: prescription.instructions,
    notes: prescription.notes,
    metadata: prescription.metadata,
    createdAt: prescription.createdAt,
    updatedAt: prescription.updatedAt,
  },
});

const toPrescriptionRecord = (
  record: PrescriptionWithArtifact,
): PrescriptionRecord =>
  buildPrescriptionRecord(record.artifact, {
    id: record.id,
    artifactId: record.artifactId,
    items: record.items,
    medications: record.medications,
    instructions: record.instructions,
    notes: record.notes,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  });

type InventoryMedicationFields = {
  id: string;
  name: string;
  genericName: string | null;
  strength: string | null;
  dosageForm: string | null;
  controlledItem: boolean;
};

const firstNonEmptyString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value : undefined;

// Prescription medications keep an `inventoryItemId` reference; their display
// fields (medication name, strength, generic name, form, controlled flag) can be
// missing when the item was added by id without the full snapshot. Fill the gaps
// from the InventoryItem so the encounter/workspace shows complete prescriptions.
export const hydrateMedications = (
  medications: Prisma.JsonValue | null,
  inventoryById: Map<string, InventoryMedicationFields>,
): Prisma.JsonValue | null => {
  if (!Array.isArray(medications)) {
    return medications;
  }
  return medications.map((med) => {
    if (!isRecord(med)) {
      return med;
    }
    const inventoryItemId = firstNonEmptyString(med.inventoryItemId);
    const inv = inventoryItemId
      ? inventoryById.get(inventoryItemId)
      : undefined;
    if (!inv) {
      return med;
    }
    return {
      ...med,
      medication: firstNonEmptyString(med.medication) ?? inv.name,
      strength: firstNonEmptyString(med.strength) ?? inv.strength ?? undefined,
      genericName:
        firstNonEmptyString(med.genericName) ?? inv.genericName ?? undefined,
      dosageForm:
        firstNonEmptyString(med.dosageForm) ?? inv.dosageForm ?? undefined,
      controlledItem:
        typeof med.controlledItem === "boolean"
          ? med.controlledItem
          : inv.controlledItem,
    };
  });
};

const collectPrescriptionInventoryItemIds = (
  record: PrescriptionWithArtifact,
  inventoryItemIds: Set<string>,
) => {
  const items = Array.isArray(record.items) ? record.items : [];
  let foundInItems = false;
  for (const item of items) {
    const id = firstNonEmptyString(item.inventoryItemId);
    if (id) {
      inventoryItemIds.add(id);
      foundInItems = true;
    }
  }

  // The medications fallback is per record: it applies when THIS prescription
  // carries no item-level inventory reference. Testing the shared accumulator
  // here would skip the fallback for every record after the first one that
  // contributed an id.
  if (foundInItems || !Array.isArray(record.medications)) {
    return;
  }
  for (const med of record.medications) {
    const id = isRecord(med)
      ? firstNonEmptyString(med.inventoryItemId)
      : undefined;
    if (id) {
      inventoryItemIds.add(id);
    }
  }
};

/**
 * Medication fields for the inventory items a prescription references.
 *
 * `inventoryItemId` reaches the medication JSON from a client-controlled FHIR
 * extension and is stored without proving the item belongs to the prescribing
 * organisation, so this lookup has to carry the tenant itself. Without it,
 * naming another practice's item id in an otherwise local prescription and then
 * listing prescriptions returned that item's name, generic name, strength,
 * dosage form and controlled-substance flag. An id from another tenant simply
 * does not hydrate.
 */
const loadInventoryMedicationFieldsById = async (
  inventoryItemIds: Set<string>,
  organisationIds: Set<string>,
): Promise<Map<string, InventoryMedicationFields>> => {
  const inventoryById = new Map<string, InventoryMedicationFields>();
  if (inventoryItemIds.size === 0 || organisationIds.size === 0) {
    return inventoryById;
  }

  const items = await prisma.inventoryItem.findMany({
    where: {
      id: { in: [...inventoryItemIds] },
      organisationId: { in: [...organisationIds] },
    },
    select: {
      id: true,
      name: true,
      genericName: true,
      strength: true,
      dosageForm: true,
      controlledItem: true,
    },
  });
  for (const item of items) {
    inventoryById.set(item.id, item);
  }

  return inventoryById;
};

const hydratePrescriptionRecords = async (
  records: PrescriptionWithArtifact[],
): Promise<PrescriptionRecord[]> => {
  const inventoryItemIds = new Set<string>();
  const organisationIds = new Set<string>();
  for (const record of records) {
    collectPrescriptionInventoryItemIds(record, inventoryItemIds);
    if (record.artifact.organisationId) {
      organisationIds.add(record.artifact.organisationId);
    }
  }

  const inventoryById = await loadInventoryMedicationFieldsById(
    inventoryItemIds,
    organisationIds,
  );

  // Hydrate AFTER the record is built. The builder derives `medications` from
  // the item rows whenever a prescription has them, so hydrating the raw
  // `record.medications` first would be discarded for every row-backed
  // prescription -- exactly the records the item rows were introduced for.
  return records.map((record) => {
    const built = toPrescriptionRecord(record);
    return {
      ...built,
      prescription: {
        ...built.prescription,
        medications: hydrateMedications(
          built.prescription.medications,
          inventoryById,
        ),
      },
    };
  });
};

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
  vitalRecord: VitalRecordPresentation,
): VitalRecordRecord => ({
  artifact: toClinicalArtifactKind(artifact, "VITAL_RECORD"),
  vitalRecord,
});

const toVitalRecordRecord = async (
  record: VitalRecordWithArtifact,
): Promise<VitalRecordRecord> => hydrateVitalRecord(record);

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

const loadPrescriptionOrThrow = async (
  prescriptionId: string,
  options: { includeVoid?: boolean } = {},
) => {
  const identifier = ensureId(prescriptionId, "prescriptionId");
  const prescription = await clinicalPrisma.prescription.findFirst({
    where: {
      OR: [{ id: identifier }, { artifactId: identifier }],
    },
    include: { artifact: true, items: true },
  });

  if (!prescription) {
    throw new ClinicalArtifactServiceError("Prescription not found", 404);
  }

  assertArtifactKind(prescription.artifact, "PRESCRIPTION", "prescription");

  if (prescription.artifact.status === "VOID" && !options.includeVoid) {
    throw new ClinicalArtifactServiceError("Prescription not found", 404);
  }

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
  recordedByDisplay: record.vitalRecord.recordedByDisplay ?? undefined,
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

/**
 * Move the artifact's own appointment from CHECKED_IN to IN_PROGRESS.
 *
 * The appointment id arrives in the artifact payload, and these routes are
 * authorised on clinical-artifact permissions (`forms:edit:any`,
 * `prescription:edit:any`) rather than `appointments:edit:*`. Scoping the update
 * to the organisation alone therefore let a caller create a throwaway artifact
 * naming any colleague's checked-in appointment and force it into IN_PROGRESS.
 *
 * `encounterId` is the binding that makes this the artifact's OWN appointment.
 * When the artifact carries no encounter there is nothing tying it to a
 * particular visit, so the status is left alone rather than advanced on the
 * strength of a body-supplied id.
 */
const advanceCheckedInAppointment = async (
  txPrisma: ClinicalPrisma,
  input: {
    organisationId: string;
    appointmentId?: string;
    encounterId?: string;
  },
) => {
  if (!input.appointmentId || !input.encounterId) {
    return;
  }

  await txPrisma.appointment.updateMany({
    where: {
      id: input.appointmentId,
      organisationId: input.organisationId,
      encounterId: input.encounterId,
      status: "CHECKED_IN",
    },
    data: {
      status: "IN_PROGRESS",
    },
  });
};

const createArtifactForKindInTx = (
  txPrisma: ClinicalPrisma,
  organisationId: string,
  kind: ClinicalArtifactKind,
  input: ClinicalArtifactBaseInput,
) =>
  txPrisma.clinicalArtifact.create({
    data: {
      organisationId,
      appointmentId: input.appointmentId ?? undefined,
      caseId: input.caseId ?? undefined,
      encounterId: input.encounterId ?? undefined,
      kind,
      status: input.status ?? "DRAFT",
      templateId: input.templateId ?? undefined,
      templateVersion: input.templateVersion ?? undefined,
      templateVersionId: input.templateVersionId ?? undefined,
      authorId: input.authorId ?? undefined,
      summary: toNullableString(input.summary),
    },
  });

const createRenderedDocumentForArtifactInTx = async (
  createdArtifact: {
    id: string;
    organisationId: string;
    kind: ClinicalArtifactKind;
    templateId: string | null;
    templateVersion: number | null;
    templateVersionId: string | null;
  },
  tx: Parameters<typeof createRenderedDocumentRecord>[1],
) => {
  if (!DOCUMENT_BACKED_CLINICAL_KINDS.has(createdArtifact.kind)) {
    return;
  }

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
};

/**
 * A COMPLETED or SIGNED artifact may only leave that state through a deliberate
 * lifecycle operation - `$reopen` sends IN_PROGRESS, `$cancel` sends VOID.
 *
 * DRAFT is included on purpose. The FHIR status mapper defaults an omitted or
 * unrecognised `Composition.status` to DRAFT, so a plain PATCH that names no
 * status arrives here as DRAFT rather than undefined - which let one request
 * both edit a finalised clinical record AND silently reopen it. Nothing
 * legitimately moves final -> DRAFT; `updatePrescription` already spelled this
 * out and the other three artifact kinds share this guard.
 */
const assertArtifactEditable = (
  artifact: { status: ClinicalArtifactStatus },
  nextStatus: ClinicalArtifactStatus | undefined,
) => {
  if (
    isFinalClinicalArtifactStatus(artifact.status) &&
    (nextStatus === undefined ||
      isFinalClinicalArtifactStatus(nextStatus) ||
      nextStatus === "DRAFT")
  ) {
    throw new ClinicalArtifactServiceError(
      "Artifact is final. Reopen or amend it before editing.",
      409,
    );
  }
};

const updateArtifactStatusAndSummaryInTx = (
  txPrisma: ClinicalPrisma,
  artifact: {
    id: string;
    status: ClinicalArtifactStatus;
    summary: string | null;
  },
  input: { status?: ClinicalArtifactStatus; summary?: string | null },
) =>
  txPrisma.clinicalArtifact.update({
    where: { id: artifact.id },
    data: {
      status: input.status ?? artifact.status,
      summary:
        input.summary === undefined
          ? artifact.summary
          : toNullableString(input.summary),
    },
  });

/**
 * Refuse when ANY treatment item for this prescription has been billed.
 *
 * The previous form loaded ONE row with `findFirst` and inspected that, while
 * the delete below removes EVERY row sharing the prescription id - and package
 * expansion routinely creates several. If the single row it happened to load was
 * unbilled, the guard passed and billed, invoice-linked rows were deleted with
 * the rest. Asking directly for a billed row is both correct and cheaper.
 *
 * Takes the transaction client so callers can run it inside their transaction,
 * closing the window where a concurrent billing update lands between the check
 * and the delete.
 */
const assertNoBilledTreatmentItems = async (
  db: ClinicalPrisma,
  organisationId: string,
  prescriptionId: string,
  message = "Prescription has already been billed.",
): Promise<void> => {
  const billedItem = await db.workspaceTreatmentItem.findFirst({
    where: {
      organisationId,
      prescriptionId,
      OR: [
        { billingStatus: { not: "UNBILLED" } },
        { invoiceRowId: { not: null } },
      ],
    },
    select: { id: true },
  });

  if (billedItem) {
    throw new ClinicalArtifactServiceError(message, 409);
  }
};

export const ClinicalArtifactService = {
  async createSoapNote(input: SoapNoteInput): Promise<SoapNoteRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await createArtifactForKindInTx(
        txPrisma,
        organisationId,
        "SOAP_NOTE",
        input,
      );

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

      await advanceCheckedInAppointment(txPrisma, {
        organisationId,
        appointmentId: input.appointmentId,
        encounterId: input.encounterId,
      });

      await createRenderedDocumentForArtifactInTx(createdArtifact, tx);

      return {
        artifact: createdArtifact,
        soapNote: createdSoapNote,
      };
    });

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(artifact.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(artifact.artifact.id);
    }

    return artifact;
  },

  async updateSoapNote(
    soapNoteId: string,
    input: SoapNoteUpdateInput,
    organisationId?: string,
  ): Promise<SoapNoteRecord> {
    const note = await loadSoapNoteOrThrow(soapNoteId);
    assertSoapNoteArtifact(note.artifact, organisationId);

    assertArtifactEditable(note.artifact, input.status);

    const updated = await prisma.$transaction(async (tx) => {
      const artifact = await updateArtifactStatusAndSummaryInTx(
        tx as ClinicalPrisma,
        note.artifact,
        input,
      );

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

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(updated.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(updated.artifact.id);
    }

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
    const prescriptionItems = normalizePrescriptionItemInputs(
      input.items ?? input.medications,
    );
    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await createArtifactForKindInTx(
        txPrisma,
        organisationId,
        "PRESCRIPTION",
        input,
      );

      const createdPrescription = await txPrisma.prescription.create({
        data: {
          artifactId: createdArtifact.id,
          items: {
            create: prescriptionItemRowsToCreate(prescriptionItems),
          },
          instructions: toNullableJsonInput(input.instructions),
          notes: toNullableJsonInput(input.notes),
          metadata: toNullableJsonInput(input.metadata),
        },
        include: { items: true },
      });

      await advanceCheckedInAppointment(txPrisma, {
        organisationId,
        appointmentId: input.appointmentId,
        encounterId: input.encounterId,
      });

      await createRenderedDocumentForArtifactInTx(createdArtifact, tx);

      return buildPrescriptionRecord(createdArtifact, createdPrescription);
    });

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(artifact.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(artifact.artifact.id);
    }

    if (shouldCreateDispenseRequestForPrescription(artifact.artifact.status)) {
      await InventoryConsumptionService.createPrescriptionDispenseRequest({
        organisationId,
        prescriptionId: artifact.prescription.id,
        medications: artifact.prescription.medications,
        metadata: artifact.prescription.metadata as
          Prisma.InputJsonValue | undefined,
        requestedBy: artifact.artifact.authorId,
        context: {
          appointmentId: artifact.artifact.appointmentId,
          encounterId: artifact.artifact.encounterId,
        },
      });
    }

    return artifact;
  },

  async updatePrescription(
    prescriptionId: string,
    input: PrescriptionUpdateInput,
    organisationId: string | undefined,
    actor: PrescriptionActor,
  ): Promise<PrescriptionRecord> {
    const record = await loadPrescriptionOrThrow(prescriptionId);
    assertArtifactKind(
      record.artifact,
      "PRESCRIPTION",
      "prescription",
      organisationId,
    );
    assertActorMayMutateArtifact(record.artifact, actor);

    // A final artifact may only leave final via a deliberate lifecycle
    // transition: $reopen sends IN_PROGRESS and $cancel sends VOID. Nothing
    // legitimately moves final -> DRAFT, so an incoming DRAFT here is a plain
    // save racing an already-completed prescription; allowing it would silently
    // reopen the artifact and wipe/recreate its items.
    if (
      isFinalClinicalArtifactStatus(record.artifact.status) &&
      (input.status === undefined ||
        isFinalClinicalArtifactStatus(input.status) ||
        input.status === "DRAFT")
    ) {
      throw new ClinicalArtifactServiceError(
        "Artifact is final. Reopen or amend it before editing.",
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const hasPrescriptionItemUpdates =
        input.items !== undefined || input.medications !== undefined;
      const prescriptionItems = hasPrescriptionItemUpdates
        ? normalizePrescriptionItemInputs(input.items ?? input.medications)
        : [];
      const artifact = await updateArtifactStatusAndSummaryInTx(
        txPrisma,
        record.artifact,
        input,
      );

      const prescription = await txPrisma.prescription.update({
        where: { id: record.id },
        data: {
          items: hasPrescriptionItemUpdates
            ? {
                deleteMany: {},
                create: prescriptionItemRowsToCreate(prescriptionItems),
              }
            : undefined,
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
        include: { items: true },
      });

      return buildPrescriptionRecord(artifact, prescription);
    });

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(updated.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(updated.artifact.id);
    }

    const wasPendingDispenseRequest =
      shouldCreateDispenseRequestForPrescription(record.artifact.status);
    const isPendingDispenseRequest = shouldCreateDispenseRequestForPrescription(
      updated.artifact.status,
    );

    if (!wasPendingDispenseRequest && isPendingDispenseRequest) {
      await InventoryConsumptionService.createPrescriptionDispenseRequest({
        organisationId: updated.artifact.organisationId,
        prescriptionId: updated.prescription.id,
        medications: updated.prescription.medications,
        metadata: updated.prescription.metadata as
          Prisma.InputJsonValue | undefined,
        requestedBy: updated.artifact.authorId,
        context: {
          appointmentId: updated.artifact.appointmentId,
          encounterId: updated.artifact.encounterId,
        },
      });
    } else if (wasPendingDispenseRequest && !isPendingDispenseRequest) {
      await InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed(
        {
          organisationId: updated.artifact.organisationId,
          prescriptionId: updated.prescription.id,
          metadata: updated.prescription.metadata as
            Prisma.InputJsonValue | undefined,
        },
      );
    }

    return updated;
  },

  async deletePrescription(
    prescriptionId: string,
    organisationId: string | undefined,
    actor: PrescriptionActor,
  ): Promise<void> {
    const record = await loadPrescriptionOrThrow(prescriptionId);
    assertArtifactKind(
      record.artifact,
      "PRESCRIPTION",
      "prescription",
      organisationId,
    );
    assertActorMayMutateArtifact(record.artifact, actor);

    if (record.artifact.status !== "DRAFT") {
      throw new ClinicalArtifactServiceError(
        "Only draft prescriptions can be deleted.",
        409,
      );
    }

    await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      // Inside the transaction: checking outside it left a window where a
      // concurrent billing update could land between the guard and the delete,
      // and the billed row would be removed anyway.
      await assertNoBilledTreatmentItems(
        txPrisma,
        record.artifact.organisationId,
        record.id,
      );

      await txPrisma.workspaceTreatmentItem.deleteMany({
        where: {
          organisationId: record.artifact.organisationId,
          prescriptionId: record.id,
        },
      });

      await txPrisma.clinicalArtifact.update({
        where: { id: record.artifact.id },
        data: { status: "VOID" },
      });
    });
  },

  async cancelPrescription(
    prescriptionId: string,
    organisationId: string | undefined,
    actor: PrescriptionActor,
  ): Promise<PrescriptionRecord> {
    const record = await loadPrescriptionOrThrow(prescriptionId, {
      includeVoid: true,
    });
    assertArtifactKind(
      record.artifact,
      "PRESCRIPTION",
      "prescription",
      organisationId,
    );
    assertActorMayMutateArtifact(record.artifact, actor);

    if (record.artifact.status === "VOID") {
      return toPrescriptionRecord(record);
    }

    if (
      record.artifact.status !== "COMPLETED" &&
      record.artifact.status !== "SIGNED"
    ) {
      throw new ClinicalArtifactServiceError(
        "Only finalized prescriptions can be cancelled.",
        409,
      );
    }

    await assertNoBilledTreatmentItems(
      clinicalPrisma,
      record.artifact.organisationId,
      record.id,
      "Prescription has already been billed or paid.",
    );

    const dispenseRequest =
      await clinicalPrisma.prescriptionDispenseRequest.findFirst({
        where: {
          organisationId: record.artifact.organisationId,
          prescriptionId: record.id,
          status: { in: ["PENDING", "DISPENSED"] },
        },
        orderBy: { requestedAt: "desc" },
      });

    if (dispenseRequest?.status === "DISPENSED") {
      await InventoryConsumptionService.voidDispensePrescription({
        organisationId: record.artifact.organisationId,
        prescriptionId: record.id,
        medications: record.medications,
        metadata: record.metadata as Prisma.InputJsonValue | undefined,
      });
    } else if (dispenseRequest?.status === "PENDING") {
      await InventoryConsumptionService.markPrescriptionDispenseRequestNotDispensed(
        {
          organisationId: record.artifact.organisationId,
          prescriptionId: record.id,
          metadata: record.metadata as Prisma.InputJsonValue | undefined,
        },
      );
    }

    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      // Re-checked inside the transaction; see `deletePrescription`.
      await assertNoBilledTreatmentItems(
        txPrisma,
        record.artifact.organisationId,
        record.id,
        "Prescription has already been billed or paid.",
      );

      await txPrisma.workspaceTreatmentItem.deleteMany({
        where: {
          organisationId: record.artifact.organisationId,
          prescriptionId: record.id,
        },
      });

      return txPrisma.clinicalArtifact.update({
        where: { id: record.artifact.id },
        data: { status: "VOID" },
      });
    });

    return buildPrescriptionRecord(artifact, record);
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
          status: { not: "VOID" },
        },
      },
      include: { artifact: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    return hydratePrescriptionRecords(records);
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
          status: { not: "VOID" },
        },
      },
      include: { artifact: true, items: true },
      orderBy: { createdAt: "desc" },
    });

    return hydratePrescriptionRecords(records);
  },

  async createDischargeSummary(
    input: DischargeSummaryInput,
  ): Promise<DischargeSummaryRecord> {
    const organisationId = ensureId(input.organisationId, "organisationId");
    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await createArtifactForKindInTx(
        txPrisma,
        organisationId,
        "DISCHARGE_SUMMARY",
        input,
      );

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

      await advanceCheckedInAppointment(txPrisma, {
        organisationId,
        appointmentId: input.appointmentId,
        encounterId: input.encounterId,
      });

      await createRenderedDocumentForArtifactInTx(createdArtifact, tx);

      return buildDischargeSummaryRecord(
        createdArtifact,
        createdDischargeSummary,
      );
    });

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(artifact.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(artifact.artifact.id);
    }

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

    assertArtifactEditable(record.artifact, input.status);

    const updated = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const artifact = await updateArtifactStatusAndSummaryInTx(
        txPrisma,
        record.artifact,
        input,
      );

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

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(updated.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(updated.artifact.id);
    }

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
    const requestedRecordedByDisplay = toOptionalDisplay(
      input.recordedByDisplay,
    );
    if (!measuredAt) {
      throw new ClinicalArtifactServiceError("Invalid measuredAt", 400);
    }

    const artifact = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const createdArtifact = await createArtifactForKindInTx(
        txPrisma,
        organisationId,
        "VITAL_RECORD",
        input,
      );

      const createdVitalRecord = await txPrisma.vitalRecord.create({
        data: {
          artifactId: createdArtifact.id,
          measuredAt,
          recordedBy: toNullableString(input.recordedBy),
          vitals: toJsonInput(input.vitals),
          notes: toNullableJsonInput(input.notes),
          metadata: toNullableJsonInput(
            mergeVitalRecordMetadata(
              null,
              input.metadata,
              requestedRecordedByDisplay,
            ),
          ),
        },
      });

      await advanceCheckedInAppointment(txPrisma, {
        organisationId,
        appointmentId: input.appointmentId,
        encounterId: input.encounterId,
      });

      await createRenderedDocumentForArtifactInTx(createdArtifact, tx);

      const resolvedRecordedByDisplay =
        requestedRecordedByDisplay === undefined
          ? await resolveVitalRecordRecordedByDisplay(createdVitalRecord)
          : requestedRecordedByDisplay;

      return buildVitalRecordRecord(createdArtifact, {
        ...createdVitalRecord,
        recordedByDisplay: resolvedRecordedByDisplay ?? null,
      });
    });

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(artifact.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(artifact.artifact.id);
    }

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
    const requestedRecordedByDisplay = toOptionalDisplay(
      input.recordedByDisplay,
    );

    assertArtifactEditable(record.artifact, input.status);

    const updated = await prisma.$transaction(async (tx) => {
      const txPrisma = tx as ClinicalPrisma;
      const artifact = await updateArtifactStatusAndSummaryInTx(
        txPrisma,
        record.artifact,
        input,
      );

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
          metadata: toNullableJsonInput(
            mergeVitalRecordMetadata(
              record.metadata,
              input.metadata,
              requestedRecordedByDisplay,
            ),
          ),
        },
      });

      const resolvedRecordedByDisplay =
        requestedRecordedByDisplay === undefined
          ? await resolveVitalRecordRecordedByDisplay(vitalRecord)
          : requestedRecordedByDisplay;

      return buildVitalRecordRecord(artifact, {
        ...vitalRecord,
        recordedByDisplay: resolvedRecordedByDisplay ?? null,
      });
    });

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(updated.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(updated.artifact.id);
    }

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

    return await toVitalRecordRecord(record);
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

    return Promise.all(records.map(toVitalRecordRecord));
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

    return Promise.all(records.map(toVitalRecordRecord));
  },

  // Passport clinical-record kinds (immunization, rabies titration, parasite
  // treatment, pre-travel exam). Read-only over FHIR: these are captured through
  // the dedicated passport flow and signed via Documenso, so there is no FHIR
  // create/update path here.
  async listImmunizationsForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<ImmunizationRecord[]> {
    const records = await prisma.immunization.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "IMMUNIZATION",
        },
      },
      include: { artifact: true },
      orderBy: { dateAdministered: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "IMMUNIZATION"),
      immunization: record,
    }));
  },

  async listImmunizationsForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<ImmunizationRecord[]> {
    const records = await prisma.immunization.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "IMMUNIZATION",
        },
      },
      include: { artifact: true },
      orderBy: { dateAdministered: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "IMMUNIZATION"),
      immunization: record,
    }));
  },

  async listRabiesTitrationsForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<RabiesTitrationRecord[]> {
    const records = await prisma.rabiesTitration.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "RABIES_TITRATION",
        },
      },
      include: { artifact: true },
      orderBy: { sampleDate: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "RABIES_TITRATION"),
      rabiesTitration: record,
    }));
  },

  async listRabiesTitrationsForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<RabiesTitrationRecord[]> {
    const records = await prisma.rabiesTitration.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "RABIES_TITRATION",
        },
      },
      include: { artifact: true },
      orderBy: { sampleDate: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "RABIES_TITRATION"),
      rabiesTitration: record,
    }));
  },

  async listParasiteTreatmentsForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<ParasiteTreatmentRecord[]> {
    const records = await prisma.parasiteTreatment.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "PARASITE_TREATMENT",
        },
      },
      include: { artifact: true },
      orderBy: { treatedAt: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "PARASITE_TREATMENT"),
      parasiteTreatment: record,
    }));
  },

  async listParasiteTreatmentsForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<ParasiteTreatmentRecord[]> {
    const records = await prisma.parasiteTreatment.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "PARASITE_TREATMENT",
        },
      },
      include: { artifact: true },
      orderBy: { treatedAt: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "PARASITE_TREATMENT"),
      parasiteTreatment: record,
    }));
  },

  async listClinicalExaminationsForEncounter(
    organisationId: string,
    encounterId: string,
  ): Promise<ClinicalExaminationRecord[]> {
    const records = await prisma.clinicalExamination.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          encounterId: ensureId(encounterId, "encounterId"),
          kind: "CLINICAL_EXAM",
        },
      },
      include: { artifact: true },
      orderBy: { examinedAt: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "CLINICAL_EXAM"),
      clinicalExamination: record,
    }));
  },

  async listClinicalExaminationsForAppointment(
    organisationId: string,
    appointmentId: string,
  ): Promise<ClinicalExaminationRecord[]> {
    const records = await prisma.clinicalExamination.findMany({
      where: {
        artifact: {
          organisationId: ensureId(organisationId, "organisationId"),
          appointmentId: ensureId(appointmentId, "appointmentId"),
          kind: "CLINICAL_EXAM",
        },
      },
      include: { artifact: true },
      orderBy: { examinedAt: "desc" },
    });
    return records.map((record) => ({
      artifact: toClinicalArtifactKind(record.artifact, "CLINICAL_EXAM"),
      clinicalExamination: record,
    }));
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

  /**
   * An amendment is a NEW draft authored by whoever is amending.
   *
   * The `*InputFromRecord` helpers copy the source artifact wholesale, including
   * `authorId`, so without `amendedBy` the new draft went out in FHIR attributed
   * to the original practitioner - a colleague's name on a record they did not
   * write. `?? undefined` keeps the copied author only when no actor is known.
   */
  async amendSoapNote(
    soapNoteId: string,
    organisationId?: string,
    amendedBy?: string,
  ): Promise<SoapNoteRecord> {
    const note = await ClinicalArtifactService.getSoapNote(
      soapNoteId,
      organisationId,
    );
    return ClinicalArtifactService.createSoapNote({
      ...soapNoteInputFromRecord(note),
      ...(amendedBy?.trim() ? { authorId: amendedBy.trim() } : {}),
    });
  },

  async finalizePrescription(
    prescriptionId: string,
    organisationId: string | undefined,
    actor: PrescriptionActor,
  ): Promise<PrescriptionRecord> {
    return ClinicalArtifactService.updatePrescription(
      prescriptionId,
      { status: "COMPLETED" },
      organisationId,
      actor,
    );
  },

  async reopenPrescription(
    prescriptionId: string,
    organisationId: string | undefined,
    actor: PrescriptionActor,
  ): Promise<PrescriptionRecord> {
    return ClinicalArtifactService.updatePrescription(
      prescriptionId,
      { status: "IN_PROGRESS" },
      organisationId,
      actor,
    );
  },

  async amendPrescription(
    prescriptionId: string,
    organisationId: string | undefined,
    actor: PrescriptionActor,
  ): Promise<PrescriptionRecord> {
    await assertActorMayMutatePrescription(
      prescriptionId,
      organisationId,
      actor,
    );
    const record = await ClinicalArtifactService.getPrescription(
      prescriptionId,
      organisationId,
    );
    return ClinicalArtifactService.createPrescription({
      ...prescriptionInputFromRecord(record),
      // The amending clinician owns the new draft; see `amendSoapNote`.
      ...(actor.actorId.trim() ? { authorId: actor.actorId.trim() } : {}),
    });
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
    amendedBy?: string,
  ): Promise<DischargeSummaryRecord> {
    const record = await ClinicalArtifactService.getDischargeSummary(
      dischargeSummaryId,
      organisationId,
    );
    return ClinicalArtifactService.createDischargeSummary({
      ...dischargeSummaryInputFromRecord(record),
      ...(amendedBy?.trim() ? { authorId: amendedBy.trim() } : {}),
    });
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
    amendedBy?: string,
  ): Promise<VitalRecordRecord> {
    const record = await ClinicalArtifactService.getVitalRecord(
      vitalRecordId,
      organisationId,
    );
    return ClinicalArtifactService.createVitalRecord({
      ...vitalRecordInputFromRecord(record),
      ...(amendedBy?.trim() ? { authorId: amendedBy.trim() } : {}),
    });
  },
};
