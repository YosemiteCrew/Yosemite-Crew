import {
  Prisma,
  ClinicalArtifactKind,
  ClinicalArtifactStatus,
} from "@prisma/client";
import {
  buildRenderedDocumentPdfSnapshot,
  type RenderedDocumentKind,
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

const readPrescriptionItemQuantity = (
  item: Record<string, unknown>,
  keys: string[],
): number | undefined => {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const quantity = Math.trunc(value);
      if (quantity > 0) {
        return quantity;
      }
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        const quantity = Math.trunc(parsed);
        if (quantity > 0) {
          return quantity;
        }
      }
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
      } as PrescriptionItemInput;
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
    } as PrescriptionItemInput;
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

const resolveVitalRecordRecordedByDisplay = async (
  record: Pick<VitalRecordModel, "recordedBy" | "metadata">,
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
  const recordedByDisplay = await resolveVitalRecordRecordedByDisplay(record);

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
      templateKind: renderedDocument.kind as ClinicalArtifactKind,
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
              templateKind: renderedDocument.kind as ClinicalArtifactKind,
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
      pdf: nextPdf as Prisma.InputJsonValue,
    },
  });
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
  }) as Prisma.JsonValue;
};

const hydratePrescriptionRecords = async (
  records: PrescriptionWithArtifact[],
): Promise<PrescriptionRecord[]> => {
  const inventoryItemIds = new Set<string>();
  for (const record of records) {
    const items = Array.isArray(record.items) ? record.items : [];
    for (const item of items) {
      const id = firstNonEmptyString(item.inventoryItemId);
      if (id) {
        inventoryItemIds.add(id);
      }
    }

    if (inventoryItemIds.size > 0) {
      continue;
    }

    if (!Array.isArray(record.medications)) {
      continue;
    }
    for (const med of record.medications) {
      const id = isRecord(med)
        ? firstNonEmptyString(med.inventoryItemId)
        : undefined;
      if (id) {
        inventoryItemIds.add(id);
      }
    }
  }

  const inventoryById = new Map<string, InventoryMedicationFields>();
  if (inventoryItemIds.size > 0) {
    const items = await prisma.inventoryItem.findMany({
      where: { id: { in: [...inventoryItemIds] } },
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
  }

  return records.map((record) =>
    toPrescriptionRecord({
      ...record,
      medications: hydrateMedications(record.medications, inventoryById),
    }),
  );
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

const loadPrescriptionOrThrow = async (prescriptionId: string) => {
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

const advanceCheckedInAppointment = async (
  txPrisma: ClinicalPrisma,
  input: { organisationId: string; appointmentId?: string },
) => {
  if (!input.appointmentId) {
    return;
  }

  await txPrisma.appointment.updateMany({
    where: {
      id: input.appointmentId,
      organisationId: input.organisationId,
      status: "CHECKED_IN",
    },
    data: {
      status: "IN_PROGRESS",
    },
  });
};

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

      await advanceCheckedInAppointment(txPrisma, {
        organisationId,
        appointmentId: input.appointmentId,
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

    if (DOCUMENT_BACKED_CLINICAL_KINDS.has(artifact.artifact.kind)) {
      await persistClinicalArtifactRenderedDocumentPdf(artifact.artifact.id);
    }

    if (shouldCreateDispenseRequestForPrescription(artifact.artifact.status)) {
      await InventoryConsumptionService.createPrescriptionDispenseRequest({
        organisationId,
        prescriptionId: artifact.prescription.id,
        medications: artifact.prescription.medications,
        metadata: artifact.prescription.metadata as
          | Prisma.InputJsonValue
          | undefined,
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
      const hasPrescriptionItemUpdates =
        input.items !== undefined || input.medications !== undefined;
      const prescriptionItems = hasPrescriptionItemUpdates
        ? normalizePrescriptionItemInputs(input.items ?? input.medications)
        : [];
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
          | Prisma.InputJsonValue
          | undefined,
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
            | Prisma.InputJsonValue
            | undefined,
        },
      );
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

      await advanceCheckedInAppointment(txPrisma, {
        organisationId,
        appointmentId: input.appointmentId,
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
