import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { CatalogService, CatalogServiceError } from "./catalog.service";
import { AuditTrailService } from "./audit-trail.service";
import { WorkspaceService } from "./workspace.prisma.service";
import { FinanceEventService } from "./finance/events";
import type {
  Admission as AdmissionDomain,
  AppointmentKind,
  Case as CaseDomain,
  CaseStatus,
  Encounter as EncounterDomain,
  EncounterClass,
  EncounterStatus,
  WorkspaceFinalizationGate,
} from "@yosemite-crew/types";

type CaseRow = {
  id: string;
  organisationId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  appointmentKind: AppointmentKind;
  title: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type EncounterRow = {
  id: string;
  caseId: string;
  organisationId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  encounterClass: string;
  appointmentKind: AppointmentKind;
  title: string | null;
  reason: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AppointmentLinkRow = {
  id: string;
  caseId: string | null;
  encounterId: string | null;
  organisationId: string;
  productItemId?: string | null;
  patient: unknown;
};

type AppointmentLinkLookupDelegate = {
  findUnique(args: {
    where: { id: string };
    select: {
      id: true;
      caseId: true;
      encounterId: true;
      organisationId: true;
      productItemId: true;
      patient: true;
    };
  }): Promise<AppointmentLinkRow | null>;
};

type AdmissionRow = {
  encounterId: string;
  organisationId: string;
  patientId: string;
  unitId: string | null;
  expectedStayDays: number | null;
  admittedAt: Date;
  dischargedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type AdmissionFindManyDelegate = {
  findMany(args: { where: Record<string, unknown> }): Promise<AdmissionRow[]>;
};

type AdmissionMutationDelegate = {
  findUnique(args: {
    where: { encounterId: string };
  }): Promise<AdmissionRow | null>;
  update(args: {
    where: { encounterId: string };
    data: {
      unitId?: string | null;
      dischargedAt?: Date;
    };
  }): Promise<AdmissionRow>;
};

type RoomUnitRow = {
  id: string;
  organisationId: string;
  roomId: string;
  unitGroupId: string | null;
  code: string;
  displayName: string;
  size: string | null;
  speciesConstraints: unknown;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type RoomUnitDelegate = {
  findUnique(args: { where: { id: string } }): Promise<RoomUnitRow | null>;
};

type RoomUnitGroupRow = {
  id: string;
  organisationId: string;
  roomId: string;
  name: string;
  size: string | null;
  unitCount: number;
  speciesConstraints: unknown;
  capabilities: string[];
  isActive: boolean;
};

type RoomUnitGroupDelegate = {
  findUnique(args: { where: { id: string } }): Promise<RoomUnitGroupRow | null>;
};

type CompanionRow = {
  id: string;
  type: string;
  speciesCode: string | null;
};

type CompanionDelegate = {
  findUnique(args: { where: { id: string } }): Promise<CompanionRow | null>;
};

type RoomUnitAssignmentRow = {
  id: string;
  encounterId: string;
  admissionId: string;
  unitId: string;
  assignedAt: Date;
  releasedAt: Date | null;
  assignedBy: string | null;
  reason: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RoomUnitAssignmentDelegate = {
  findFirst(args: {
    where: {
      admissionId?: string;
      unitId?: string;
      releasedAt: null;
    };
    orderBy: { assignedAt: "desc" };
  }): Promise<RoomUnitAssignmentRow | null>;
  findMany(args: {
    where: {
      encounterId?: string;
      admissionId?: string;
      unitId?: string;
      releasedAt?: Date | null;
    };
    orderBy: { assignedAt: "asc" | "desc" };
  }): Promise<RoomUnitAssignmentRow[]>;
  update(args: {
    where: { id: string };
    data: { releasedAt: Date };
  }): Promise<RoomUnitAssignmentRow>;
  create(args: {
    data: {
      encounterId: string;
      admissionId: string;
      unitId: string;
      assignedAt: Date;
      assignedBy: string | null;
      reason: string | null;
    };
  }): Promise<RoomUnitAssignmentRow>;
};

type WorkspaceTreatmentItemRow = {
  productSnapshot: unknown;
};

type WorkspaceTreatmentItemDelegate = {
  findMany(args: {
    where: { organisationId: string; encounterId: string };
  }): Promise<WorkspaceTreatmentItemRow[]>;
  create(args: {
    data: {
      organisationId: string;
      appointmentId?: string | null;
      encounterId: string;
      productId: string;
      productVersion?: number | null;
      productSnapshot: unknown;
      servicePackageKind: string;
      quantity: number;
      priceSnapshot: unknown;
      billingStatus?: string;
      invoiceRowId?: string | null;
      lockState?: unknown;
      prescriptionId?: string | null;
    };
  }): Promise<unknown>;
};

type ClinicalArtifactDelegate = {
  create(args: {
    data: {
      organisationId: string;
      appointmentId?: string | null;
      caseId?: string | null;
      encounterId?: string | null;
      kind: "PRESCRIPTION";
      status: string;
      summary?: string | null;
      authorId?: string | null;
      templateId?: string | null;
      templateVersion?: number | null;
      templateVersionId?: string | null;
    };
  }): Promise<{ id: string; organisationId: string }>;
};

type PrescriptionDelegate = {
  create(args: {
    data: {
      artifactId: string;
      medications: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | null;
      instructions?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | null;
      notes?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | null;
      metadata?: Prisma.InputJsonValue | Prisma.NullTypes.JsonNull | null;
      items?: {
        create: Array<{
          medication: string;
          strength?: string;
          dosage?: string;
          route?: string;
          frequency?: string;
          duration?: string;
          quantity?: string;
          instructions?: string;
          sortOrder?: number;
        }>;
      };
    };
  }): Promise<{ id: string }>;
};

type TemplateInstanceDelegate = {
  findFirst(args: {
    where: {
      organisationId: string;
      templateId: string;
      OR?: Array<{
        appointmentId?: string;
        encounterId?: string;
        caseId?: string;
      }>;
    };
    select: { id: true };
  }): Promise<{ id: string } | null>;
  create(args: {
    data: {
      templateId: string;
      templateVersion: number;
      organisationId: string;
      appointmentId?: string;
      caseId?: string;
      encounterId?: string;
      status?: "DRAFT";
      data: Prisma.InputJsonValue;
      authorId?: string | null;
    };
  }): Promise<{ id: string }>;
};

export class CaseEncounterServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CaseEncounterServiceError";
  }
}

const CASE_STATUSES = new Set<CaseStatus>([
  "planned",
  "waitlist",
  "active",
  "onhold",
  "finished",
  "cancelled",
  "entered-in-error",
]);

const ENCOUNTER_STATUSES = new Set<EncounterStatus>([
  "planned",
  "arrived",
  "triaged",
  "in-progress",
  "onleave",
  "finished",
  "cancelled",
]);

const ENCOUNTER_CLASSES = new Set<EncounterClass>([
  "AMB",
  "IMP",
  "EMER",
  "OBSENC",
  "VR",
]);

const ACTIVE_INPATIENT_STATUSES = new Set<EncounterStatus>([
  "arrived",
  "triaged",
  "in-progress",
  "onleave",
]);

const TERMINAL_ENCOUNTER_STATUSES = new Set<EncounterStatus>([
  "finished",
  "cancelled",
]);

const requireString = (value: string | undefined, field: string) => {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new CaseEncounterServiceError(`${field} is required.`, 400);
  }
  return trimmed;
};

const normalizeOptionalString = (value?: string | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getTransactionDelegate = <TDelegate>(
  tx: Prisma.TransactionClient,
  key: string,
): TDelegate => {
  const delegate = (tx as Record<string, unknown>)[key];

  if (!delegate) {
    throw new CaseEncounterServiceError(
      `Transaction client is missing ${key} delegate.`,
      500,
    );
  }

  return delegate as TDelegate;
};

const resolveAssignableUnitContext = async (params: {
  tx: Prisma.TransactionClient;
  encounter: EncounterRow;
  unitId: string;
}) => {
  const { tx, encounter, unitId } = params;
  const roomUnitDelegate = getTransactionDelegate<RoomUnitDelegate>(
    tx,
    "roomUnit",
  );
  const roomUnitGroupDelegate = getTransactionDelegate<RoomUnitGroupDelegate>(
    tx,
    "roomUnitGroup",
  );
  const companionDelegate = getTransactionDelegate<CompanionDelegate>(
    tx,
    "patient",
  );

  const unit = await roomUnitDelegate.findUnique({
    where: { id: unitId },
  });

  if (!unit) {
    throw new CaseEncounterServiceError("Room unit not found.", 404);
  }

  if (unit.organisationId !== encounter.organisationId) {
    throw new CaseEncounterServiceError("Unit organisation mismatch.", 409);
  }

  if (!unit.isActive) {
    throw new CaseEncounterServiceError("Selected unit is inactive.", 409);
  }

  const companion = await companionDelegate.findUnique({
    where: { id: encounter.patientId },
  });

  if (!companion) {
    throw new CaseEncounterServiceError("Companion not found.", 404);
  }

  assertRoomUnitSpeciesCompatibility(unit, companion);

  if (!unit.unitGroupId) {
    return { unit, companion };
  }

  const group = await roomUnitGroupDelegate.findUnique({
    where: { id: unit.unitGroupId },
  });

  if (!group) {
    throw new CaseEncounterServiceError("Room unit group not found.", 404);
  }

  if (group.organisationId !== encounter.organisationId) {
    throw new CaseEncounterServiceError(
      "Room unit group organisation mismatch.",
      409,
    );
  }

  assertRoomUnitGroupSpeciesCompatibility(group, companion);

  return { unit, companion, group };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toPositiveInteger = (value: number | undefined): number => {
  if (!value || !Number.isFinite(value)) {
    return 1;
  }

  const quantity = Math.trunc(value);
  return quantity > 0 ? quantity : 1;
};

const getPackageProductItemId = (value: unknown): string | undefined => {
  if (!isRecord(value)) return undefined;
  return typeof value.packageProductItemId === "string" &&
    value.packageProductItemId.trim()
    ? value.packageProductItemId.trim()
    : undefined;
};

const getPackageMetadata = (
  item: Record<string, unknown>,
  packageProductItemId: string,
) => ({
  origin: "PACKAGE_EXPANSION" as const,
  packageId: packageProductItemId,
  packageItemId:
    typeof item.packageItemId === "string" && item.packageItemId.trim()
      ? item.packageItemId.trim()
      : item.productItemId,
  productKind:
    typeof item.kind === "string" && item.kind.trim()
      ? item.kind.trim()
      : undefined,
  sourceVersion:
    typeof item.sourceVersion === "number" &&
    Number.isFinite(item.sourceVersion)
      ? item.sourceVersion
      : null,
});

const createPackageTemplateInstances = async (params: {
  tx: {
    templateInstance: TemplateInstanceDelegate;
  };
  organisationId: string;
  appointmentId: string;
  caseId: string;
  encounterId: string;
  selection: Awaited<ReturnType<typeof CatalogService.resolveSelection>>;
}) => {
  const bindings = params.selection.templateBindings.filter(
    (binding) =>
      typeof binding.templateId === "string" && binding.templateId.trim(),
  );

  for (const binding of bindings) {
    const templateId = binding.templateId!.trim();
    const existing = await params.tx.templateInstance.findFirst({
      where: {
        organisationId: params.organisationId,
        templateId,
        OR: [
          { appointmentId: params.appointmentId },
          { encounterId: params.encounterId },
          { caseId: params.caseId },
        ],
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    await params.tx.templateInstance.create({
      data: {
        templateId,
        templateVersion: binding.templateVersion ?? 1,
        organisationId: params.organisationId,
        appointmentId: params.appointmentId,
        caseId: params.caseId,
        encounterId: params.encounterId,
        status: "DRAFT",
        data: {
          origin: "PACKAGE_EXPANSION",
          packageId: params.selection.productItemId,
          packageItemId: params.selection.productItemId,
          productItemId: params.selection.productItemId,
          productKind: params.selection.productKind,
          templateKind: binding.templateKind,
        } as Prisma.InputJsonValue,
        authorId: null,
      },
    });
  }
};

const buildPrescriptionMedicationRows = (
  items: Array<{
    productItemId: string;
    code: string | null;
    name: string;
    kind: string;
    quantity: number;
    packageProductItemId?: string | null;
    isPackageComponent: boolean;
  }>,
) =>
  items.map((item, index) => ({
    medication: item.name,
    strength: item.code ?? undefined,
    dosage: item.kind,
    route: item.isPackageComponent ? "PACKAGE" : undefined,
    frequency: item.packageProductItemId ?? undefined,
    duration: String(toPositiveInteger(item.quantity)),
    quantity: String(toPositiveInteger(item.quantity)),
    instructions: item.isPackageComponent
      ? `Package component from ${item.packageProductItemId ?? item.productItemId}`
      : undefined,
    sortOrder: index,
  }));

const resolveSelectionSafe = async (
  productItemId: string,
  organisationId: string,
) => {
  try {
    return await CatalogService.resolveSelection(productItemId, organisationId);
  } catch (error) {
    if (error instanceof CatalogServiceError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

const loadAppointmentLink = async (
  appointmentDelegate: AppointmentLinkLookupDelegate,
  appointmentId: string,
) =>
  appointmentDelegate.findUnique({
    where: { id: appointmentId },
    select: {
      id: true,
      caseId: true,
      encounterId: true,
      organisationId: true,
      productItemId: true,
      patient: true,
    },
  });

const assertAppointmentMatchesEncounterContext = (
  appointment: AppointmentLinkRow,
  context: {
    caseId: string;
    encounterId?: string;
    organisationId: string;
    patientId: string;
  },
) => {
  if (appointment.organisationId !== context.organisationId) {
    throw new CaseEncounterServiceError(
      "Encounter appointment organisation mismatch.",
      409,
    );
  }

  if (toAppointmentCompanionId(appointment.patient) !== context.patientId) {
    throw new CaseEncounterServiceError(
      "Encounter appointment companion mismatch.",
      409,
    );
  }

  if (appointment.caseId && appointment.caseId !== context.caseId) {
    throw new CaseEncounterServiceError(
      "Appointment is already linked to a different case.",
      409,
    );
  }

  if (
    appointment.encounterId &&
    appointment.encounterId !== context.encounterId
  ) {
    throw new CaseEncounterServiceError(
      "Appointment is already linked to a different encounter.",
      409,
    );
  }
};

const maybeExpandPackageTreatmentItems = async (params: {
  tx: {
    workspaceTreatmentItem: WorkspaceTreatmentItemDelegate;
    clinicalArtifact: ClinicalArtifactDelegate;
    prescription: PrescriptionDelegate;
    templateInstance: TemplateInstanceDelegate;
  };
  organisationId: string;
  appointmentId: string;
  caseId: string;
  encounterId: string;
  selection: Awaited<ReturnType<typeof CatalogService.resolveSelection>>;
}) => {
  if (params.selection.productKind !== "PACKAGE") {
    return;
  }

  await expandPackageTreatmentItems(params);
};

const expandPackageTreatmentItems = async (params: {
  tx: {
    workspaceTreatmentItem: WorkspaceTreatmentItemDelegate;
    clinicalArtifact: ClinicalArtifactDelegate;
    prescription: PrescriptionDelegate;
    templateInstance: TemplateInstanceDelegate;
  };
  organisationId: string;
  appointmentId: string;
  caseId: string;
  encounterId: string;
  selection: Awaited<ReturnType<typeof CatalogService.resolveSelection>>;
}) => {
  const packageProductItemId = params.selection.productItemId;
  const existingItems = await params.tx.workspaceTreatmentItem.findMany({
    where: {
      organisationId: params.organisationId,
      encounterId: params.encounterId,
    },
  });

  if (
    existingItems.some(
      (item) =>
        getPackageProductItemId(item.productSnapshot) === packageProductItemId,
    )
  ) {
    return;
  }

  const items = [
    ...params.selection.billingItems,
    ...params.selection.includedItems,
  ];
  const medicationItems = items.filter((item) => item.kind === "MEDICATION");

  let packagePrescriptionId: string | null = null;
  if (medicationItems.length > 0) {
    const medicationRows = buildPrescriptionMedicationRows(medicationItems);
    const createdArtifact = await params.tx.clinicalArtifact.create({
      data: {
        organisationId: params.organisationId,
        appointmentId: params.appointmentId,
        encounterId: params.encounterId,
        kind: "PRESCRIPTION",
        status: "DRAFT",
        summary: `${params.selection.name} medication package`,
        authorId: null,
      },
    });

    const createdPrescription = await params.tx.prescription.create({
      data: {
        artifactId: createdArtifact.id,
        medications: medicationRows as Prisma.InputJsonValue,
        items: {
          create: medicationRows,
        },
        metadata: {
          origin: "PACKAGE_EXPANSION",
          packageId: packageProductItemId,
          packageItemId: packageProductItemId,
          productKind: params.selection.productKind,
          sourceVersion: null,
        } as Prisma.InputJsonValue,
      },
    });
    packagePrescriptionId = createdPrescription.id;
  }

  await createPackageTemplateInstances({
    tx: params.tx,
    organisationId: params.organisationId,
    appointmentId: params.appointmentId,
    caseId: params.caseId,
    encounterId: params.encounterId,
    selection: params.selection,
  });

  for (const item of items) {
    const included = params.selection.includedItems.some(
      (includedItem) => includedItem.productItemId === item.productItemId,
    );
    const packageMetadata = getPackageMetadata(
      {
        productItemId: item.productItemId,
        code: item.code,
        name: item.name,
        kind: item.kind,
        packageProductItemId: item.packageProductItemId,
        isPackageComponent: item.isPackageComponent,
      },
      packageProductItemId,
    );
    const priceSnapshot = {
      productItemId: item.productItemId,
      code: item.code,
      name: item.name,
      kind: item.kind,
      quantity: item.quantity,
      currency: item.currency,
      unitPrice: included ? 0 : item.unitPrice,
      referenceUnitPrice: item.referenceUnitPrice ?? null,
      defaultDiscountPercent: item.defaultDiscountPercent ?? null,
      maxDiscountPercent: item.maxDiscountPercent ?? null,
      discountPercent: included ? 0 : item.discountPercent,
      grossAmount: included ? 0 : item.grossAmount,
      discountAmount: included ? 0 : item.discountAmount,
      finalAmount: included ? 0 : item.finalAmount,
      isPackageComponent: item.isPackageComponent,
      packageProductItemId,
      ...packageMetadata,
    };

    await params.tx.workspaceTreatmentItem.create({
      data: {
        organisationId: params.organisationId,
        appointmentId: params.appointmentId,
        encounterId: params.encounterId,
        productId: item.productItemId,
        productVersion: null,
        productSnapshot: {
          productItemId: item.productItemId,
          code: item.code,
          name: item.name,
          kind: item.kind,
          packageProductItemId,
          ...packageMetadata,
          isPackageComponent: item.isPackageComponent,
        },
        servicePackageKind: item.kind,
        quantity: item.quantity,
        priceSnapshot,
        billingStatus: "UNBILLED",
        invoiceRowId: null,
        lockState: null,
        prescriptionId:
          packagePrescriptionId && item.kind === "MEDICATION"
            ? packagePrescriptionId
            : null,
      },
    });
  }
};

const toCaseStatus = (status: string): CaseStatus => {
  if (!CASE_STATUSES.has(status as CaseStatus)) {
    throw new CaseEncounterServiceError("Invalid case status.", 400);
  }

  return status as CaseStatus;
};

const toEncounterStatus = (status: string): EncounterStatus => {
  if (!ENCOUNTER_STATUSES.has(status as EncounterStatus)) {
    throw new CaseEncounterServiceError("Invalid encounter status.", 400);
  }

  return status as EncounterStatus;
};

const toEncounterClass = (value: string): EncounterClass => {
  if (!ENCOUNTER_CLASSES.has(value as EncounterClass)) {
    throw new CaseEncounterServiceError("Invalid encounter class.", 400);
  }

  return value as EncounterClass;
};

const assertEncounterIsOpen = (encounter: EncounterRow, operation: string) => {
  if (TERMINAL_ENCOUNTER_STATUSES.has(encounter.status as EncounterStatus)) {
    throw new CaseEncounterServiceError(
      `Cannot ${operation} a closed encounter.`,
      409,
    );
  }
};

const assertEncounterIsOnLeave = (
  encounter: EncounterRow,
  operation: string,
) => {
  if (encounter.status !== "onleave") {
    throw new CaseEncounterServiceError(
      `Cannot ${operation} unless the encounter is ready for discharge.`,
      409,
    );
  }
};

const assertPeriod = (start?: Date, end?: Date) => {
  if (start && Number.isNaN(start.getTime())) {
    throw new CaseEncounterServiceError("Invalid encounter periodStart.", 400);
  }

  if (end && Number.isNaN(end.getTime())) {
    throw new CaseEncounterServiceError("Invalid encounter periodEnd.", 400);
  }

  if (start && end && end < start) {
    throw new CaseEncounterServiceError(
      "periodEnd must be after periodStart.",
      400,
    );
  }
};

const normalizeStringTokens = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .map((item) =>
          typeof item === "string" ? item.trim().toLowerCase() : "",
        )
        .filter((item) => item.length > 0),
    ),
  ];
};

const getCompanionSpeciesTokens = (companion: CompanionRow) => {
  const tokens = new Set<string>();
  const type = companion.type.trim().toLowerCase();

  if (type) {
    tokens.add(type);
  }

  if (companion.speciesCode?.trim()) {
    tokens.add(companion.speciesCode.trim().toLowerCase());
  }

  const aliases: Record<string, string[]> = {
    dog: ["canine"],
    cat: ["feline"],
    horse: ["equine"],
    other: ["other"],
  };

  for (const alias of aliases[type] ?? []) {
    tokens.add(alias);
  }

  return tokens;
};

const assertRoomUnitSpeciesCompatibility = (
  unit: RoomUnitRow,
  companion: CompanionRow,
) => {
  const constraints = normalizeStringTokens(unit.speciesConstraints);
  if (constraints.length === 0) {
    return;
  }

  const allowedSpecies = getCompanionSpeciesTokens(companion);
  const isCompatible = constraints.some((constraint) =>
    allowedSpecies.has(constraint),
  );

  if (!isCompatible) {
    throw new CaseEncounterServiceError(
      "Room unit is not compatible with this companion's species.",
      409,
    );
  }
};

const assertRoomUnitGroupSpeciesCompatibility = (
  group: RoomUnitGroupRow,
  companion: CompanionRow,
) => {
  const constraints = normalizeStringTokens(group.speciesConstraints);
  if (constraints.length === 0) {
    return;
  }

  const allowedSpecies = getCompanionSpeciesTokens(companion);
  const isCompatible = constraints.some((constraint) =>
    allowedSpecies.has(constraint),
  );

  if (!isCompatible) {
    throw new CaseEncounterServiceError(
      "Room unit group is not compatible with this companion's species.",
      409,
    );
  }
};

const toCaseDomain = (row: CaseRow): CaseDomain => ({
  id: row.id,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as CaseStatus,
  appointmentKind: row.appointmentKind,
  title: row.title ?? undefined,
  description: row.description ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toEncounterDomain = (row: EncounterRow): EncounterDomain => ({
  id: row.id,
  caseId: row.caseId,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as EncounterStatus,
  encounterClass: row.encounterClass as EncounterClass,
  appointmentKind: row.appointmentKind,
  title: row.title ?? undefined,
  reason: row.reason ?? undefined,
  periodStart: row.periodStart ?? undefined,
  periodEnd: row.periodEnd ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toAdmissionDomain = (row: AdmissionRow): AdmissionDomain => ({
  encounterId: row.encounterId,
  organisationId: row.organisationId,
  patientId: row.patientId,
  unitId: row.unitId ?? undefined,
  expectedStayDays: row.expectedStayDays ?? undefined,
  admittedAt: row.admittedAt,
  dischargedAt: row.dischargedAt ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toRoomUnitAssignmentDomain = (row: RoomUnitAssignmentRow) => ({
  id: row.id,
  encounterId: row.encounterId,
  admissionId: row.admissionId,
  unitId: row.unitId,
  assignedAt: row.assignedAt,
  releasedAt: row.releasedAt ?? undefined,
  assignedBy: row.assignedBy ?? undefined,
  reason: row.reason ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toAppointmentCompanionId = (value: unknown): string =>
  ((value as { id?: string } | null)?.id ?? "").trim();

const attachEncounterAppointmentIds = async (
  encounters: EncounterDomain[],
): Promise<EncounterDomain[]> => {
  if (encounters.length === 0) {
    return encounters;
  }

  const appointmentLinks = (await prisma.appointment.findMany({
    where: {
      encounterId: {
        in: encounters
          .map((encounter) => encounter.id)
          .filter((value): value is string => Boolean(value)),
      },
    },
    select: {
      id: true,
      encounterId: true,
    },
  })) as Array<{ id: string; encounterId: string | null }>;

  const appointmentIdByEncounterId = new Map<string, string>();
  for (const appointment of appointmentLinks) {
    if (appointment.encounterId) {
      appointmentIdByEncounterId.set(appointment.encounterId, appointment.id);
    }
  }

  const admissionDelegate = (
    prisma as unknown as { admission: AdmissionFindManyDelegate }
  ).admission;

  const admissions = await admissionDelegate.findMany({
    where: {
      encounterId: {
        in: encounters
          .map((encounter) => encounter.id)
          .filter((value): value is string => Boolean(value)),
      },
    },
  });

  const admissionByEncounterId = new Map(
    admissions.map((admission) => [
      admission.encounterId,
      toAdmissionDomain(admission),
    ]),
  );

  return encounters.map((encounter) => ({
    ...encounter,
    appointmentId:
      encounter.id == null
        ? encounter.appointmentId
        : (appointmentIdByEncounterId.get(encounter.id) ??
          encounter.appointmentId),
    admission:
      encounter.id == null
        ? encounter.admission
        : admissionByEncounterId.get(encounter.id),
  }));
};

export const CaseEncounterService = {
  async createCase(input: CaseDomain): Promise<CaseDomain> {
    const organisationId = requireString(
      input.organisationId,
      "organisationId",
    );
    const patientId = requireString(input.patientId, "patientId");
    const status = toCaseStatus(input.status);

    const created = await prisma.case.create({
      data: {
        organisationId,
        patientId,
        parentId: normalizeOptionalString(input.parentId) ?? null,
        status,
        appointmentKind: input.appointmentKind,
        title: normalizeOptionalString(input.title) ?? null,
        description: normalizeOptionalString(input.description) ?? null,
      },
    });

    return toCaseDomain(created as CaseRow);
  },

  async updateCase(
    caseId: string,
    input: Partial<CaseDomain>,
  ): Promise<CaseDomain> {
    const id = requireString(caseId, "caseId");
    const status = input.status ? toCaseStatus(input.status) : undefined;

    const existing = await prisma.case.findUnique({ where: { id } });
    if (!existing) {
      throw new CaseEncounterServiceError("Case not found.", 404);
    }

    const updated = await prisma.case.update({
      where: { id },
      data: {
        status,
        appointmentKind: input.appointmentKind ?? undefined,
        parentId:
          input.parentId === undefined
            ? undefined
            : (normalizeOptionalString(input.parentId) ?? null),
        title:
          input.title === undefined
            ? undefined
            : (normalizeOptionalString(input.title) ?? null),
        description:
          input.description === undefined
            ? undefined
            : (normalizeOptionalString(input.description) ?? null),
      },
    });

    return toCaseDomain(updated as CaseRow);
  },

  async getCaseById(caseId: string): Promise<CaseDomain> {
    const id = requireString(caseId, "caseId");
    const row = await prisma.case.findUnique({ where: { id } });
    if (!row) {
      throw new CaseEncounterServiceError("Case not found.", 404);
    }
    return toCaseDomain(row as CaseRow);
  },

  async listCases(filters: {
    organisationId?: string;
    patientId?: string;
    parentId?: string;
    status?: CaseStatus;
    appointmentKind?: AppointmentKind;
  }) {
    const rows = (await prisma.case.findMany({
      where: {
        organisationId: normalizeOptionalString(filters.organisationId),
        patientId: normalizeOptionalString(filters.patientId),
        parentId: normalizeOptionalString(filters.parentId),
        status: filters.status,
        appointmentKind: filters.appointmentKind,
      },
      orderBy: { updatedAt: "desc" },
    })) as CaseRow[];

    return rows.map(toCaseDomain);
  },

  async createEncounter(input: EncounterDomain): Promise<EncounterDomain> {
    const caseId = requireString(input.caseId, "caseId");
    const organisationId = requireString(
      input.organisationId,
      "organisationId",
    );
    const patientId = requireString(input.patientId, "patientId");
    const status = toEncounterStatus(input.status);
    const encounterClass = toEncounterClass(input.encounterClass);
    assertPeriod(input.periodStart, input.periodEnd);

    const created = await prisma.$transaction(async (tx) => {
      const caseRow = await tx.case.findUnique({ where: { id: caseId } });
      if (!caseRow) {
        throw new CaseEncounterServiceError("Case not found.", 404);
      }

      if (caseRow.organisationId !== organisationId) {
        throw new CaseEncounterServiceError(
          "Encounter organisationId must match case organisationId.",
          409,
        );
      }

      if (caseRow.patientId !== patientId) {
        throw new CaseEncounterServiceError(
          "Encounter patientId must match case patientId.",
          409,
        );
      }

      const appointmentId = normalizeOptionalString(input.appointmentId);
      if (appointmentId) {
        const appointment = await loadAppointmentLink(
          tx.appointment,
          appointmentId,
        );

        if (!appointment) {
          throw new CaseEncounterServiceError("Appointment not found.", 404);
        }

        assertAppointmentMatchesEncounterContext(appointment, {
          caseId,
          organisationId,
          patientId,
        });
      }

      const createdEncounter = await tx.encounter.create({
        data: {
          caseId,
          organisationId,
          patientId,
          parentId: normalizeOptionalString(input.parentId) ?? null,
          status,
          encounterClass,
          appointmentKind: input.appointmentKind,
          title: normalizeOptionalString(input.title) ?? null,
          reason: normalizeOptionalString(input.reason) ?? null,
          periodStart: input.periodStart ?? null,
          periodEnd: input.periodEnd ?? null,
        },
      });

      if (appointmentId) {
        await tx.appointment.update({
          where: { id: appointmentId },
          data: {
            caseId,
            encounterId: createdEncounter.id,
          },
        });

        const appointment = (await tx.appointment.findUnique({
          where: { id: appointmentId },
          select: {
            id: true,
            caseId: true,
            encounterId: true,
            organisationId: true,
            productItemId: true,
            patient: true,
          },
        })) as AppointmentLinkRow | null;

        if (appointment?.productItemId) {
          const selection = await resolveSelectionSafe(
            appointment.productItemId,
            organisationId,
          );

          if (selection) {
            await maybeExpandPackageTreatmentItems({
              tx: tx as unknown as {
                workspaceTreatmentItem: WorkspaceTreatmentItemDelegate;
                clinicalArtifact: ClinicalArtifactDelegate;
                prescription: PrescriptionDelegate;
                templateInstance: TemplateInstanceDelegate;
              },
              organisationId,
              appointmentId,
              caseId,
              encounterId: createdEncounter.id,
              selection,
            });
          }
        }
      }

      return createdEncounter;
    });

    return {
      ...toEncounterDomain(created as EncounterRow),
      appointmentId: normalizeOptionalString(input.appointmentId),
    };
  },

  async updateEncounter(
    encounterId: string,
    input: Partial<EncounterDomain>,
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    const status = input.status ? toEncounterStatus(input.status) : undefined;
    const encounterClass = input.encounterClass
      ? toEncounterClass(input.encounterClass)
      : undefined;
    assertPeriod(input.periodStart, input.periodEnd);

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const row = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;
      if (!row) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      const nextCaseId = normalizeOptionalString(input.caseId) ?? row.caseId;
      const nextOrganisationId =
        normalizeOptionalString(input.organisationId) ?? row.organisationId;
      const nextCompanionId =
        normalizeOptionalString(input.patientId) ?? row.patientId;

      if (
        nextCaseId !== row.caseId ||
        nextOrganisationId !== row.organisationId ||
        nextCompanionId !== row.patientId
      ) {
        throw new CaseEncounterServiceError(
          "caseId, organisationId and patientId cannot be changed for an encounter.",
          400,
        );
      }

      const currentAppointment = (await tx.appointment.findFirst({
        where: { encounterId: id },
        select: {
          id: true,
          caseId: true,
          encounterId: true,
          organisationId: true,
          patient: true,
        },
      })) as AppointmentLinkRow | null;

      const nextAppointmentId =
        input.appointmentId === undefined
          ? undefined
          : (normalizeOptionalString(input.appointmentId) ?? null);

      if (
        nextAppointmentId !== undefined &&
        nextAppointmentId !== currentAppointment?.id
      ) {
        if (currentAppointment) {
          await tx.appointment.update({
            where: { id: currentAppointment.id },
            data: {
              encounterId: null,
            },
          });
        }

        if (nextAppointmentId) {
          const nextAppointment = await loadAppointmentLink(
            tx.appointment,
            nextAppointmentId,
          );

          if (!nextAppointment) {
            throw new CaseEncounterServiceError("Appointment not found.", 404);
          }

          assertAppointmentMatchesEncounterContext(nextAppointment, {
            caseId: row.caseId,
            encounterId: id,
            organisationId: row.organisationId,
            patientId: row.patientId,
          });

          await tx.appointment.update({
            where: { id: nextAppointmentId },
            data: {
              caseId: row.caseId,
              encounterId: id,
            },
          });
        }
      }

      return (await tx.encounter.update({
        where: { id },
        data: {
          status,
          encounterClass,
          appointmentKind: input.appointmentKind ?? undefined,
          parentId:
            input.parentId === undefined
              ? undefined
              : (normalizeOptionalString(input.parentId) ?? null),
          title:
            input.title === undefined
              ? undefined
              : (normalizeOptionalString(input.title) ?? null),
          reason:
            input.reason === undefined
              ? undefined
              : (normalizeOptionalString(input.reason) ?? null),
          periodStart: input.periodStart ?? undefined,
          periodEnd: input.periodEnd ?? undefined,
        },
      })) as EncounterRow;
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async dischargeEncounter(
    encounterId: string,
    input?: {
      dischargedAt?: Date;
      periodEnd?: Date;
      overrideReason?: string;
      actorUserId?: string | null;
    },
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    assertPeriod(undefined, input?.dischargedAt);
    assertPeriod(undefined, input?.periodEnd);
    let finalizationGate: WorkspaceFinalizationGate | null = null;

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const encounter = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;

      if (!encounter) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      const admissionDelegate = (
        tx as unknown as { admission: AdmissionMutationDelegate }
      ).admission;
      const admission = await admissionDelegate.findUnique({
        where: { encounterId: id },
      });

      if (!admission) {
        throw new CaseEncounterServiceError(
          "Admission not found for encounter.",
          404,
        );
      }

      if (admission.dischargedAt) {
        throw new CaseEncounterServiceError(
          "Admission is already discharged.",
          409,
        );
      }

      finalizationGate = await WorkspaceService.getEncounterFinalizationGate({
        organisationId: encounter.organisationId,
        encounterId: id,
      });
      const overrideReason = input?.overrideReason?.trim();
      if (!finalizationGate.enabled && !overrideReason) {
        throw new CaseEncounterServiceError(
          finalizationGate.disabledReason ??
            "Encounter finalization gate is blocking discharge.",
          409,
        );
      }

      const dischargedAt = input?.dischargedAt ?? new Date();
      const nextPeriodEnd = input?.periodEnd ?? dischargedAt;
      assertPeriod(encounter.periodStart ?? undefined, nextPeriodEnd);

      const activeAssignment = await (
        tx as unknown as { roomUnitAssignment: RoomUnitAssignmentDelegate }
      ).roomUnitAssignment.findFirst({
        where: {
          admissionId: id,
          releasedAt: null,
        },
        orderBy: { assignedAt: "desc" },
      });

      if (activeAssignment) {
        await (
          tx as unknown as { roomUnitAssignment: RoomUnitAssignmentDelegate }
        ).roomUnitAssignment.update({
          where: { id: activeAssignment.id },
          data: {
            releasedAt: dischargedAt,
          },
        });
      }

      await admissionDelegate.update({
        where: { encounterId: id },
        data: {
          dischargedAt,
          unitId: null,
        },
      });

      return (await tx.encounter.update({
        where: { id },
        data: {
          status: "finished",
          periodEnd: nextPeriodEnd,
        },
      })) as EncounterRow;
    });

    const overrideReason = input?.overrideReason?.trim();
    const resolvedFinalizationGate = finalizationGate;

    if (overrideReason) {
      await AuditTrailService.recordSafely({
        organisationId: updatedEncounter.organisationId,
        patientId: updatedEncounter.patientId,
        eventType: "ENCOUNTER_DISCHARGE_OVERRIDDEN",
        actorType: input?.actorUserId ? "PMS_USER" : "SYSTEM",
        actorId: input?.actorUserId ?? null,
        entityType: "ENCOUNTER",
        entityId: updatedEncounter.id,
        metadata: {
          encounterId: updatedEncounter.id,
          overrideReason,
          finalizationGate: resolvedFinalizationGate,
        },
        occurredAt: input?.dischargedAt ?? new Date(),
      });
    }

    await AuditTrailService.recordSafely({
      organisationId: updatedEncounter.organisationId,
      patientId: updatedEncounter.patientId,
      eventType: "ENCOUNTER_DISCHARGED",
      actorType: input?.actorUserId ? "PMS_USER" : "SYSTEM",
      actorId: input?.actorUserId ?? null,
      entityType: "ENCOUNTER",
      entityId: updatedEncounter.id,
      metadata: {
        encounterId: updatedEncounter.id,
        dischargedAt: input?.dischargedAt?.toISOString?.() ?? undefined,
        periodEnd: input?.periodEnd?.toISOString?.() ?? undefined,
        overrideReason,
        finalizationGate: resolvedFinalizationGate,
      },
      occurredAt: input?.dischargedAt ?? new Date(),
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async assignUnit(
    encounterId: string,
    input: {
      unitId: string;
      assignedAt?: Date;
      assignedBy?: string;
      reason?: string;
    },
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    const unitId = requireString(input.unitId, "unitId");
    const assignedAt = input.assignedAt ?? new Date();

    if (Number.isNaN(assignedAt.getTime())) {
      throw new CaseEncounterServiceError("Invalid assignedAt.", 400);
    }

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const encounter = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;

      if (!encounter) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      const admissionDelegate = (
        tx as unknown as { admission: AdmissionMutationDelegate }
      ).admission;
      const assignmentDelegate = (
        tx as unknown as { roomUnitAssignment: RoomUnitAssignmentDelegate }
      ).roomUnitAssignment;

      const admission = await admissionDelegate.findUnique({
        where: { encounterId: id },
      });

      if (!admission) {
        throw new CaseEncounterServiceError(
          "Admission not found for encounter.",
          404,
        );
      }

      if (admission.dischargedAt) {
        throw new CaseEncounterServiceError(
          "Cannot assign unit to a discharged admission.",
          409,
        );
      }

      await resolveAssignableUnitContext({
        tx,
        encounter,
        unitId,
      });

      const conflictingAssignment = await assignmentDelegate.findFirst({
        where: {
          unitId,
          releasedAt: null,
        },
        orderBy: { assignedAt: "desc" },
      });

      if (conflictingAssignment && conflictingAssignment.admissionId !== id) {
        throw new CaseEncounterServiceError(
          "Room unit is already occupied.",
          409,
        );
      }

      const activeAssignment = await assignmentDelegate.findFirst({
        where: {
          admissionId: id,
          releasedAt: null,
        },
        orderBy: { assignedAt: "desc" },
      });

      if (activeAssignment && activeAssignment.unitId !== unitId) {
        await assignmentDelegate.update({
          where: { id: activeAssignment.id },
          data: { releasedAt: assignedAt },
        });
      }

      if (activeAssignment?.unitId !== unitId) {
        await assignmentDelegate.create({
          data: {
            encounterId: id,
            admissionId: id,
            unitId,
            assignedAt,
            assignedBy: normalizeOptionalString(input.assignedBy) ?? null,
            reason: normalizeOptionalString(input.reason) ?? null,
          },
        });
      }

      await admissionDelegate.update({
        where: { encounterId: id },
        data: {
          unitId,
        },
      });

      return encounter;
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async listUnitAssignments(filters: {
    encounterId?: string;
    admissionId?: string;
    unitId?: string;
    activeOnly?: boolean;
  }) {
    const assignmentDelegate = (
      prisma as unknown as { roomUnitAssignment: RoomUnitAssignmentDelegate }
    ).roomUnitAssignment;

    const rows = await assignmentDelegate.findMany({
      where: {
        encounterId: normalizeOptionalString(filters.encounterId),
        admissionId: normalizeOptionalString(filters.admissionId),
        unitId: normalizeOptionalString(filters.unitId),
        releasedAt: filters.activeOnly ? null : undefined,
      },
      orderBy: { assignedAt: "asc" },
    });

    return rows.map(toRoomUnitAssignmentDomain);
  },

  async listAdmissionUnitAssignments(admissionId: string) {
    const id = requireString(admissionId, "admissionId");
    const admission = await prisma.admission.findUnique({
      where: { encounterId: id },
    });

    if (!admission) {
      throw new CaseEncounterServiceError(
        "Admission not found for encounter.",
        404,
      );
    }

    const assignmentDelegate = (
      prisma as unknown as { roomUnitAssignment: RoomUnitAssignmentDelegate }
    ).roomUnitAssignment;

    const rows = await assignmentDelegate.findMany({
      where: {
        admissionId: id,
      },
      orderBy: { assignedAt: "asc" },
    });

    return rows.map(toRoomUnitAssignmentDomain);
  },

  async startEncounter(
    encounterId: string,
    input?: { startedAt?: Date },
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    const startedAt = input?.startedAt ?? new Date();

    if (Number.isNaN(startedAt.getTime())) {
      throw new CaseEncounterServiceError("Invalid startedAt.", 400);
    }

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const encounter = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;

      if (!encounter) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      assertEncounterIsOpen(encounter, "start");

      return (await tx.encounter.update({
        where: { id },
        data: {
          status: "in-progress",
          periodStart: encounter.periodStart ?? startedAt,
        },
      })) as EncounterRow;
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async markEncounterReadyForDischarge(
    encounterId: string,
    actorUserId?: string,
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const encounter = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;

      if (!encounter) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      assertEncounterIsOpen(encounter, "mark ready for discharge");

      return (await tx.encounter.update({
        where: { id },
        data: {
          status: "onleave",
        },
      })) as EncounterRow;
    });

    await FinanceEventService.recordReadinessEvent({
      organisationId: updatedEncounter.organisationId,
      eventType: "ENCOUNTER_READY_FOR_DISCHARGE",
      entityType: "ENCOUNTER",
      entityId: id,
      actorUserId,
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async markEncounterNotReadyForDischarge(
    encounterId: string,
  ): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");

    const updatedEncounter = await prisma.$transaction(async (tx) => {
      const encounter = (await tx.encounter.findUnique({
        where: { id },
      })) as EncounterRow | null;

      if (!encounter) {
        throw new CaseEncounterServiceError("Encounter not found.", 404);
      }

      assertEncounterIsOnLeave(encounter, "undo ready for discharge");

      return (await tx.encounter.update({
        where: { id },
        data: {
          status: "in-progress",
        },
      })) as EncounterRow;
    });

    return (
      await attachEncounterAppointmentIds([toEncounterDomain(updatedEncounter)])
    )[0];
  },

  async listActiveInpatientEncounters(filters: { organisationId?: string }) {
    const organisationId = requireString(
      filters.organisationId,
      "organisationId",
    );

    const admissionDelegate = (
      prisma as unknown as { admission: AdmissionFindManyDelegate }
    ).admission;

    const admissions = await admissionDelegate.findMany({
      where: {
        organisationId,
        dischargedAt: null,
      },
    });

    if (admissions.length === 0) {
      return [];
    }

    const encounterIds = admissions.map((admission) => admission.encounterId);
    const rows = (await prisma.encounter.findMany({
      where: {
        id: {
          in: encounterIds,
        },
        organisationId,
        appointmentKind: "INPATIENT",
        status: {
          in: [...ACTIVE_INPATIENT_STATUSES],
        },
      },
      orderBy: { periodStart: "asc" },
    })) as EncounterRow[];

    const encounterById = new Map(
      rows.map((row) => [row.id, toEncounterDomain(row)]),
    );

    const orderedEncounters = admissions
      .map((admission) => encounterById.get(admission.encounterId))
      .filter((value): value is EncounterDomain => Boolean(value));

    return attachEncounterAppointmentIds(orderedEncounters);
  },

  async getEncounterById(encounterId: string): Promise<EncounterDomain> {
    const id = requireString(encounterId, "encounterId");
    const row = await prisma.encounter.findUnique({ where: { id } });
    if (!row) {
      throw new CaseEncounterServiceError("Encounter not found.", 404);
    }
    return (
      await attachEncounterAppointmentIds([
        toEncounterDomain(row as EncounterRow),
      ])
    )[0];
  },

  async listEncounters(filters: {
    organisationId?: string;
    caseId?: string;
    patientId?: string;
    parentId?: string;
    status?: EncounterStatus;
    appointmentKind?: AppointmentKind;
  }) {
    const rows = (await prisma.encounter.findMany({
      where: {
        organisationId: normalizeOptionalString(filters.organisationId),
        caseId: normalizeOptionalString(filters.caseId),
        patientId: normalizeOptionalString(filters.patientId),
        parentId: normalizeOptionalString(filters.parentId),
        status: filters.status,
        appointmentKind: filters.appointmentKind,
      },
      orderBy: { updatedAt: "desc" },
    })) as EncounterRow[];

    return attachEncounterAppointmentIds(rows.map(toEncounterDomain));
  },
};
