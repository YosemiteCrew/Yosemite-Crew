import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { ClinicalArtifactService } from "./clinical-artifact.service";
import { FormAssignmentService } from "./form-assignment.service";
import type {
  Case,
  Encounter,
  WorkspaceBootstrapInput,
  WorkspaceBootstrapResponse,
  WorkspaceDiagnosticQueueItem,
  WorkspaceDocumentRow,
  WorkspaceLabSummary,
  WorkspaceLockState,
  WorkspacePermissionSnapshot,
  WorkspaceFormRow,
  WorkspacePrimaryAction,
  WorkspaceSummaryItem,
  WorkspaceTreatmentItem,
  WorkspaceTreatmentItemCreateInput,
  WorkspaceTreatmentItemUpdateInput,
} from "@yosemite-crew/types";

export class WorkspaceServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "WorkspaceServiceError";
  }
}

type AppointmentRow = {
  id: string;
  organisationId: string;
  status: string;
  appointmentKind: string;
  concern: string | null;
  encounterId: string | null;
  caseId: string | null;
  patient: unknown;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  updatedAt: Date;
};

type EncounterRow = {
  id: string;
  organisationId: string;
  caseId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  encounterClass: string;
  appointmentKind: string;
  title: string | null;
  reason: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type CaseRow = {
  id: string;
  organisationId: string;
  patientId: string;
  parentId: string | null;
  status: string;
  appointmentKind: string;
  title: string | null;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type PatientRow = {
  id: string;
  name: string;
  type: string;
  status: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ParentRow = {
  id: string;
  firstName: string;
  lastName: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RenderedDocumentRow = {
  id: string;
  sourceKind: string;
  sourceId: string;
  templateId: string | null;
  templateVersion: number | null;
  kind: string;
  title: string;
  status: string;
  pdfUrl: string | null;
  signing: unknown;
  createdAt: Date;
  updatedAt: Date;
  templateInstance: {
    appointmentId: string | null;
    encounterId: string | null;
  } | null;
  clinicalArtifact: {
    appointmentId: string | null;
    encounterId: string | null;
  } | null;
};

type WorkspaceContext = {
  appointment: AppointmentRow | null;
  encounter: Encounter | null;
  episodeOfCare: Case | null;
  companion: PatientRow | null;
  client: ParentRow | null;
};

type OrganizationLockWindowRow = {
  appointmentLockWindowOutpatientMinutes: number | null;
  appointmentLockWindowInpatientMinutes: number | null;
};

type InvoiceVisitBillingStage = "DRAFT" | "READY_FOR_BILLING" | "SETTLED";

type WorkspaceBootstrapBillingState = {
  invoice: {
    id: string;
    visitBillingStage: InvoiceVisitBillingStage;
  } | null;
  visitBillingStage: InvoiceVisitBillingStage | null;
  readyForBilling: boolean;
  readyForDischarge: boolean;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

const getPatientIdFromAppointment = (patient: unknown): string | undefined => {
  if (!isRecord(patient)) return undefined;
  return getString(patient.id);
};

const getParentIdFromAppointment = (patient: unknown): string | undefined => {
  if (!isRecord(patient) || !isRecord(patient.parent)) return undefined;
  return getString(patient.parent.id);
};

const buildWorkspaceSummaryItem = (input: {
  id: string;
  name: string | null;
  status: string | null;
  kind: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceSummaryItem => input;

const normalizeAppointmentKind = (
  value: string | undefined,
): "OUTPATIENT" | "INPATIENT" =>
  value === "INPATIENT" ? "INPATIENT" : "OUTPATIENT";

const mapEncounterRow = (row: EncounterRow): Encounter => ({
  id: row.id,
  caseId: row.caseId,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as Encounter["status"],
  encounterClass: row.encounterClass as Encounter["encounterClass"],
  appointmentKind: row.appointmentKind as Encounter["appointmentKind"],
  title: row.title ?? undefined,
  reason: row.reason ?? undefined,
  periodStart: row.periodStart ?? undefined,
  periodEnd: row.periodEnd ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const mapCaseRow = (row: CaseRow): Case => ({
  id: row.id,
  organisationId: row.organisationId,
  patientId: row.patientId,
  parentId: row.parentId ?? undefined,
  status: row.status as Case["status"],
  appointmentKind: row.appointmentKind as Case["appointmentKind"],
  title: row.title ?? undefined,
  description: row.description ?? undefined,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const buildPermissionSnapshot = (
  permissions: string[] | undefined,
): WorkspacePermissionSnapshot => {
  const resolved = [
    ...new Set((permissions ?? []).filter((permission) => permission.trim())),
  ];
  const canEditSoap = resolved.includes("forms:edit:any");
  const canPrescribe = resolved.includes("prescription:edit:any");
  const canSignDocuments =
    resolved.includes("document:edit:any") ||
    resolved.includes("forms:edit:any") ||
    resolved.includes("prescription:edit:any");
  const canDischarge = resolved.includes("forms:edit:any");
  const canAssignTasks =
    resolved.includes("tasks:edit:any") || resolved.includes("tasks:edit:own");
  const canResumeSchedules = canAssignTasks;
  const canCancelSchedules = canAssignTasks;
  return {
    permissions: resolved,
    canViewAppointments:
      resolved.includes("appointments:view:any") ||
      resolved.includes("appointments:view:own"),
    canViewTasks:
      resolved.includes("tasks:view:any") ||
      resolved.includes("tasks:view:own"),
    canViewDocuments: resolved.includes("document:view:any"),
    canViewForms: resolved.includes("forms:view:any"),
    canViewPrescriptions:
      resolved.includes("prescription:view:any") ||
      resolved.includes("prescription:view:own"),
    canViewLabs: resolved.includes("labs:view:any"),
    canEditSoap,
    canPrescribe,
    canSignDocuments,
    canDischarge,
    canAssignTasks,
    canResumeSchedules,
    canCancelSchedules,
  };
};

const resolveLockWindowMinutes = (
  organisation: OrganizationLockWindowRow | null,
  appointmentKind: string | undefined,
): number | null => {
  if (!organisation) {
    return null;
  }

  const normalizedKind = normalizeAppointmentKind(appointmentKind);
  const windowMinutes =
    normalizedKind === "INPATIENT"
      ? organisation.appointmentLockWindowInpatientMinutes
      : organisation.appointmentLockWindowOutpatientMinutes;

  return typeof windowMinutes === "number" ? windowMinutes : null;
};

const resolveWorkspaceLock = (input: {
  appointment: AppointmentRow | null;
  encounter: Encounter | null;
  organisation: OrganizationLockWindowRow | null;
  now?: Date;
}): boolean => {
  const startAt = input.appointment?.startTime ?? input.encounter?.periodStart;
  const windowMinutes = resolveLockWindowMinutes(
    input.organisation,
    input.appointment?.appointmentKind ?? input.encounter?.appointmentKind,
  );

  if (!startAt || windowMinutes == null || windowMinutes < 0) {
    return false;
  }

  const lockAt = startAt.getTime() + windowMinutes * 60 * 1000;
  return (input.now ?? new Date()).getTime() >= lockAt;
};

const loadBootstrapBillingState = async (input: {
  organisationId: string;
  appointmentId?: string;
  encounter: Encounter | null;
}): Promise<WorkspaceBootstrapBillingState> => {
  const readyForDischarge = input.encounter?.status === "onleave";

  if (!input.appointmentId) {
    return {
      invoice: null,
      visitBillingStage: null,
      readyForBilling: false,
      readyForDischarge,
    };
  }

  const invoice = (await prisma.invoice.findFirst({
    where: {
      organisationId: input.organisationId,
      appointmentId: input.appointmentId,
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })) as {
    id: string;
    visitBillingStage: InvoiceVisitBillingStage;
  } | null;

  const visitBillingStage = invoice?.visitBillingStage ?? null;

  return {
    invoice:
      invoice != null
        ? {
            id: invoice.id,
            visitBillingStage: invoice.visitBillingStage,
          }
        : null,
    visitBillingStage,
    readyForBilling: visitBillingStage === "READY_FOR_BILLING",
    readyForDischarge,
  };
};

const buildLocks = (locked: boolean): WorkspaceLockState => ({
  appointment: locked,
  encounter: locked,
  episodeOfCare: locked,
  templateInstances: locked,
  clinicalArtifacts: locked,
  prescriptions: locked,
  documents: locked,
  treatmentItems: locked,
});

const buildPrimaryAction = (input: {
  forms: Array<{ status: "completed" | "pending" }>;
  tasks: Array<{ status: string }>;
  clinicalArtifacts: Array<{ status: string }>;
  labSummary: WorkspaceLabSummary;
}): WorkspacePrimaryAction => {
  if (input.forms.some((form) => form.status === "pending")) {
    return {
      kind: "COMPLETE_FORMS",
      label: "Complete forms",
      detail: "There are outstanding forms to finish before continuing.",
    };
  }

  if (
    input.tasks.some(
      (task) => task.status !== "COMPLETED" && task.status !== "CANCELLED",
    )
  ) {
    return {
      kind: "REVIEW_TASKS",
      label: "Review tasks",
      detail: "There are active tasks that still need attention.",
    };
  }

  if (
    input.clinicalArtifacts.some(
      (artifact) =>
        artifact.status === "DRAFT" || artifact.status === "IN_PROGRESS",
    )
  ) {
    return {
      kind: "CONTINUE_CHARTING",
      label: "Continue charting",
      detail: "An open clinical record can be resumed.",
    };
  }

  if (input.labSummary.pendingCount > 0) {
    return {
      kind: "VIEW_LABS",
      label: "Review labs",
      detail: "There are pending lab items to review.",
    };
  }

  return {
    kind: "VIEW_SUMMARY",
    label: "View summary",
    detail: "No outstanding action was detected for this workspace.",
  };
};

const OPEN_LAB_ORDER_STATUSES = new Set([
  "CREATED",
  "SUBMITTED",
  "AT_THE_LAB",
  "PARTIAL",
  "RUNNING",
]);

const RESULTED_LAB_STATUSES = new Set(["RESULTED", "COMPLETE", "FINAL"]);

const FAILED_LAB_STATUSES = new Set(["FAILED", "ERROR", "CANCELLED"]);

const buildLabSummary = (
  orders: Array<{
    provider?: string | null;
    status?: string | null;
    updatedAt?: Date;
  }>,
  results: Array<{
    provider?: string | null;
    status?: string | null;
    updatedAt?: Date;
  }>,
): WorkspaceLabSummary => {
  const providers = [
    ...new Set(
      [...orders, ...results]
        .map((item) => item.provider?.trim())
        .filter((provider): provider is string => Boolean(provider)),
    ),
  ];

  const pendingCount = orders.filter((order) =>
    OPEN_LAB_ORDER_STATUSES.has((order.status ?? "").toUpperCase()),
  ).length;
  const resultedCount = results.filter((result) =>
    RESULTED_LAB_STATUSES.has((result.status ?? "").toUpperCase()),
  ).length;
  const failedCount =
    orders.filter((order) =>
      FAILED_LAB_STATUSES.has((order.status ?? "").toUpperCase()),
    ).length +
    results.filter((result) =>
      FAILED_LAB_STATUSES.has((result.status ?? "").toUpperCase()),
    ).length;

  const latestEvent = [...orders, ...results]
    .filter((item) => item.updatedAt instanceof Date)
    .sort(
      (left, right) =>
        (right.updatedAt?.getTime() ?? 0) - (left.updatedAt?.getTime() ?? 0),
    )[0];

  const latestStatus =
    !orders.length && !results.length
      ? "NONE"
      : latestEvent && typeof latestEvent.status === "string"
        ? FAILED_LAB_STATUSES.has(latestEvent.status.toUpperCase())
          ? "FAILED"
          : RESULTED_LAB_STATUSES.has(latestEvent.status.toUpperCase())
            ? "RESULTED"
            : latestEvent.status.toUpperCase() === "CREATED"
              ? "QUEUED"
              : pendingCount > 0 && resultedCount > 0
                ? "PARTIAL"
                : "ORDERED"
        : pendingCount > 0 && resultedCount > 0
          ? "PARTIAL"
          : resultedCount > 0
            ? "RESULTED"
            : pendingCount > 0
              ? "ORDERED"
              : "NONE";

  return {
    hasLabs: orders.length > 0 || results.length > 0,
    orders,
    results,
    pendingCount,
    resultedCount,
    failedCount,
    requiredPendingCount: pendingCount,
    providers,
    latestStatus,
    blockingFinalization: pendingCount > 0 || failedCount > 0,
  };
};

const buildDiagnosticQueue = (
  orders: Array<{
    id: string;
    provider: string;
    status: string;
    tests?: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>,
  results: Array<{
    id: string;
    provider: string;
    status?: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
  preloadedTests: Array<{
    id: string;
    provider: string;
    providerTestCode: string;
    label: string;
    sourceKind: "PRODUCT_ITEM" | "PACKAGE_ITEM";
    sourceId: string;
    sourceProductId: string;
    sourcePackageId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>,
): WorkspaceDiagnosticQueueItem[] => {
  const orderItems = orders.map((order) => ({
    id: order.id,
    kind: "LAB_ORDER" as const,
    provider: order.provider,
    providerTestCode: null,
    status: order.status,
    label:
      Array.isArray(order.tests) && order.tests.length > 0
        ? "Lab order with tests"
        : "Lab order",
    sourceKind: "LAB_ORDER" as const,
    sourceId: order.id,
    sourceProductId: null,
    sourcePackageId: null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  }));

  const resultItems = results.map((result) => ({
    id: result.id,
    kind: "LAB_RESULT" as const,
    provider: result.provider,
    providerTestCode: null,
    status: result.status ?? null,
    label: "Lab result",
    sourceKind: "LAB_RESULT" as const,
    sourceId: result.id,
    sourceProductId: null,
    sourcePackageId: null,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }));

  const preloadItems = preloadedTests.map((test) => ({
    id: test.id,
    kind: "PROVIDER_TEST" as const,
    provider: test.provider,
    providerTestCode: test.providerTestCode,
    status: "AVAILABLE" as const,
    label: test.label,
    sourceKind: test.sourceKind,
    sourceId: test.sourceId,
    sourceProductId: test.sourceProductId,
    sourcePackageId: test.sourcePackageId,
    createdAt: test.createdAt,
    updatedAt: test.updatedAt,
  }));

  const seen = new Set<string>();
  return [...orderItems, ...resultItems, ...preloadItems].filter((item) => {
    const key = [
      item.kind,
      item.provider ?? "",
      item.providerTestCode ?? "",
      item.sourceId,
      item.sourceProductId ?? "",
      item.sourcePackageId ?? "",
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

type TreatmentItemRow = {
  id: string;
  organisationId: string;
  appointmentId: string | null;
  encounterId: string;
  productId: string;
  productVersion: number | null;
  productSnapshot: unknown;
  servicePackageKind: string;
  quantity: number;
  priceSnapshot: unknown;
  billingStatus: string;
  invoiceRowId: string | null;
  lockState: unknown;
  prescriptionId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type ProductItemRow = {
  id: string;
  organisationId: string;
  name: string;
  code: string | null;
  kind: string;
  createdAt: Date;
  updatedAt: Date;
  package: {
    items: Array<{
      id: string;
      sortOrder: number;
      childProductItem: {
        id: string;
        name: string;
        code: string | null;
        kind: string;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
  } | null;
};

const mapTreatmentItemRow = (
  row: TreatmentItemRow,
): WorkspaceTreatmentItem => ({
  id: row.id,
  organisationId: row.organisationId,
  appointmentId: row.appointmentId,
  encounterId: row.encounterId,
  productId: row.productId,
  productVersion: row.productVersion,
  productSnapshot:
    typeof row.productSnapshot === "object" &&
    row.productSnapshot !== null &&
    !Array.isArray(row.productSnapshot)
      ? (row.productSnapshot as Record<string, unknown>)
      : {},
  servicePackageKind: row.servicePackageKind,
  quantity: row.quantity,
  priceSnapshot:
    typeof row.priceSnapshot === "object" &&
    row.priceSnapshot !== null &&
    !Array.isArray(row.priceSnapshot)
      ? (row.priceSnapshot as Record<string, unknown>)
      : {},
  billingStatus: row.billingStatus,
  invoiceRowId: row.invoiceRowId,
  lockState:
    typeof row.lockState === "string"
      ? row.lockState
      : typeof row.lockState === "object" &&
          row.lockState !== null &&
          !Array.isArray(row.lockState)
        ? (row.lockState as Record<string, unknown>)
        : null,
  prescriptionId: row.prescriptionId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const buildTreatmentItemsFromPrescriptions = (
  prescriptions: Array<{
    artifact: { id: string; status: string; createdAt: Date; updatedAt: Date };
    prescription: { medications: unknown };
  }>,
  locked = false,
): WorkspaceTreatmentItem[] =>
  prescriptions.map((record) => {
    const medications = Array.isArray(record.prescription.medications)
      ? record.prescription.medications
      : [];
    const firstMedication = medications.find((entry) => isRecord(entry)) as
      | Record<string, unknown>
      | undefined;
    const productId =
      (firstMedication &&
        typeof firstMedication.inventoryItemId === "string" &&
        firstMedication.inventoryItemId) ||
      (firstMedication &&
        typeof firstMedication.inventoryItemSku === "string" &&
        firstMedication.inventoryItemSku) ||
      record.artifact.id;
    return {
      id: record.artifact.id,
      organisationId: "",
      appointmentId: null,
      encounterId: "",
      productId,
      productVersion: null,
      productSnapshot: {
        prescriptionId: record.artifact.id,
        medications,
      },
      servicePackageKind: "PRESCRIPTION",
      quantity: (() => {
        let total = 0;
        for (const medication of medications) {
          if (!isRecord(medication)) continue;
          const amount =
            typeof medication.quantity === "number" ? medication.quantity : 1;
          total += amount;
        }
        return total;
      })(),
      priceSnapshot: {},
      billingStatus: "UNBILLED",
      invoiceRowId: null,
      lockState: { locked },
      prescriptionId: record.artifact.id,
      name: medications.length ? "Treatment items" : "Prescription",
      medicationCount: medications.length,
      status: record.artifact.status,
      createdAt: record.artifact.createdAt,
      updatedAt: record.artifact.updatedAt,
    };
  });

const buildDiagnosticPreloadItems = (
  products: ProductItemRow[],
): Array<{
  id: string;
  provider: string;
  providerTestCode: string;
  label: string;
  sourceKind: "PRODUCT_ITEM" | "PACKAGE_ITEM";
  sourceId: string;
  sourceProductId: string;
  sourcePackageId: string | null;
  createdAt: Date;
  updatedAt: Date;
}> => {
  const items: Array<{
    id: string;
    provider: string;
    providerTestCode: string;
    label: string;
    sourceKind: "PRODUCT_ITEM" | "PACKAGE_ITEM";
    sourceId: string;
    sourceProductId: string;
    sourcePackageId: string | null;
    createdAt: Date;
    updatedAt: Date;
  }> = [];

  for (const product of products) {
    if (product.kind === "DIAGNOSTIC" || product.kind === "LAB_TEST") {
      if (!product.code) continue;
      items.push({
        id: `provider-test:${product.id}`,
        provider: "IDEXX",
        providerTestCode: product.code,
        label: product.name,
        sourceKind: "PRODUCT_ITEM",
        sourceId: product.id,
        sourceProductId: product.id,
        sourcePackageId: null,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      });
      continue;
    }

    if (product.kind !== "PACKAGE" || !product.package?.items?.length) {
      continue;
    }

    for (const item of product.package.items) {
      const child = item.childProductItem;
      if (child.kind !== "DIAGNOSTIC" && child.kind !== "LAB_TEST") {
        continue;
      }
      if (!child.code) continue;

      items.push({
        id: `provider-test:${product.id}:${item.id}`,
        provider: "IDEXX",
        providerTestCode: child.code,
        label: child.name,
        sourceKind: "PACKAGE_ITEM",
        sourceId: item.id,
        sourceProductId: child.id,
        sourcePackageId: product.id,
        createdAt: child.createdAt,
        updatedAt: child.updatedAt,
      });
    }
  }

  return items;
};

const mapDocumentRow = (input: {
  documentId: string;
  sourceKind: string;
  sourceId: string;
  appointmentId: string | null;
  encounterId: string | null;
  companionId: string | null;
  templateId: string | null;
  templateVersion: number | null;
  title: string;
  kind: string;
  status: string;
  signingStatus: string;
  pdfUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}): WorkspaceDocumentRow => input;

const mapRenderedDocumentRow = (
  document: RenderedDocumentRow,
): WorkspaceDocumentRow => ({
  documentId: document.id,
  sourceKind: document.sourceKind,
  sourceId: document.sourceId,
  appointmentId:
    document.templateInstance?.appointmentId ??
    document.clinicalArtifact?.appointmentId ??
    null,
  encounterId:
    document.templateInstance?.encounterId ??
    document.clinicalArtifact?.encounterId ??
    null,
  companionId: null,
  templateId: document.templateId,
  templateVersion: document.templateVersion,
  title: document.title,
  kind: document.kind,
  status: document.status,
  signingStatus:
    isRecord(document.signing) && typeof document.signing.status === "string"
      ? String(document.signing.status)
      : document.status === "SIGNED"
        ? "SIGNED"
        : "NOT_STARTED",
  pdfUrl: document.pdfUrl,
  createdAt: document.createdAt,
  updatedAt: document.updatedAt,
});

const dedupeDocumentRows = (
  rows: WorkspaceDocumentRow[],
): WorkspaceDocumentRow[] => {
  const seen = new Map<string, WorkspaceDocumentRow>();
  for (const row of rows) {
    if (!seen.has(row.documentId)) {
      seen.set(row.documentId, row);
    }
  }
  return [...seen.values()];
};

const MEDICAL_RECORD_KINDS = new Set([
  "SOAP_NOTE",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "VITAL_RECORD",
]);

const buildContext = async (
  input: WorkspaceBootstrapInput,
): Promise<WorkspaceContext> => {
  const appointment =
    input.appointmentId != null
      ? ((await prisma.appointment.findFirst({
          where: {
            id: input.appointmentId,
            organisationId: input.organisationId,
          },
        })) as AppointmentRow | null)
      : null;

  const encounterAppointment =
    appointment == null && input.encounterId != null
      ? ((await prisma.appointment.findFirst({
          where: {
            encounterId: input.encounterId,
            organisationId: input.organisationId,
          },
        })) as AppointmentRow | null)
      : null;

  const resolvedAppointment = appointment ?? encounterAppointment;

  const encounterRow =
    input.encounterId != null
      ? ((await prisma.encounter.findFirst({
          where: {
            id: input.encounterId,
            organisationId: input.organisationId,
          },
        })) as EncounterRow | null)
      : appointment?.encounterId
        ? ((await prisma.encounter.findFirst({
            where: {
              id: appointment.encounterId,
              organisationId: input.organisationId,
            },
          })) as EncounterRow | null)
        : null;

  const encounter = encounterRow != null ? mapEncounterRow(encounterRow) : null;

  const caseId = encounter?.caseId ?? resolvedAppointment?.caseId ?? undefined;
  const caseRow = caseId
    ? ((await prisma.case.findFirst({
        where: {
          id: caseId,
          organisationId: input.organisationId,
        },
      })) as CaseRow | null)
    : null;
  const episodeOfCare = caseRow != null ? mapCaseRow(caseRow) : null;

  const companionId =
    encounter?.patientId ??
    getPatientIdFromAppointment(resolvedAppointment?.patient) ??
    undefined;

  const parentId =
    encounter?.parentId ??
    getParentIdFromAppointment(resolvedAppointment?.patient) ??
    episodeOfCare?.parentId ??
    undefined;

  const [companion, client] = await Promise.all([
    companionId
      ? (prisma.patient.findFirst({
          where: {
            id: companionId,
          },
        }) as Promise<PatientRow | null>)
      : Promise.resolve(null),
    parentId
      ? (prisma.parent.findFirst({
          where: { id: parentId },
        }) as Promise<ParentRow | null>)
      : Promise.resolve(null),
  ]);

  return {
    appointment: resolvedAppointment,
    encounter,
    episodeOfCare,
    companion,
    client,
  };
};

const loadForms = async (
  organisationId: string,
  appointmentId: string | undefined,
) => {
  if (!appointmentId) {
    return {
      appointmentId: undefined,
      items: [] as WorkspaceFormRow[],
    };
  }

  const items = await FormAssignmentService.listAppointmentFormSummaries(
    organisationId,
    appointmentId,
  );

  return {
    appointmentId,
    items,
  };
};

const loadClinicalArtifacts = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
}) => {
  const appointmentId = params.appointmentId ?? "";
  const encounterId = params.encounterId ?? "";

  const [soapNotes, prescriptions, dischargeSummaries, vitalRecords] =
    encounterId
      ? await Promise.all([
          ClinicalArtifactService.listSoapNotesForEncounter(
            params.organisationId,
            encounterId,
          ),
          ClinicalArtifactService.listPrescriptionsForEncounter(
            params.organisationId,
            encounterId,
          ),
          ClinicalArtifactService.listDischargeSummariesForEncounter(
            params.organisationId,
            encounterId,
          ),
          ClinicalArtifactService.listVitalRecordsForEncounter(
            params.organisationId,
            encounterId,
          ),
        ])
      : await Promise.all([
          ClinicalArtifactService.listSoapNotesForAppointment(
            params.organisationId,
            appointmentId,
          ),
          ClinicalArtifactService.listPrescriptionsForAppointment(
            params.organisationId,
            appointmentId,
          ),
          ClinicalArtifactService.listDischargeSummariesForAppointment(
            params.organisationId,
            appointmentId,
          ),
          ClinicalArtifactService.listVitalRecordsForAppointment(
            params.organisationId,
            appointmentId,
          ),
        ]);

  return {
    soapNotes,
    prescriptions,
    dischargeSummaries,
    vitalRecords,
    clinicalArtifacts: [
      ...soapNotes,
      ...prescriptions,
      ...dischargeSummaries,
      ...vitalRecords,
    ],
  };
};

const loadTreatmentItems = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
}) =>
  (await prisma.workspaceTreatmentItem.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.encounterId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.encounterId
                ? [{ encounterId: params.encounterId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
  })) as TreatmentItemRow[];

const loadDiagnosticPreloads = async (params: {
  organisationId: string;
  treatmentItems: TreatmentItemRow[];
}) => {
  const productIds = [
    ...new Set(
      params.treatmentItems.map((item) => item.productId).filter(Boolean),
    ),
  ];

  if (!productIds.length) {
    return [];
  }

  const products = (await prisma.productItem.findMany({
    where: {
      organisationId: params.organisationId,
      id: { in: productIds },
    },
    include: {
      package: {
        include: {
          items: {
            include: {
              childProductItem: {
                select: {
                  id: true,
                  name: true,
                  code: true,
                  kind: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  })) as ProductItemRow[];

  return buildDiagnosticPreloadItems(products);
};

const loadTasks = async (params: {
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
}) =>
  prisma.task.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.companionId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { dueAt: "asc" },
  });

const loadSchedules = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
}) =>
  prisma.taskSchedule.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.encounterId || params.companionId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.encounterId
                ? [{ encounterId: params.encounterId }]
                : []),
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

const loadTemplateInstances = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  caseId?: string;
}) =>
  prisma.templateInstance.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.encounterId || params.caseId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.encounterId
                ? [{ encounterId: params.encounterId }]
                : []),
              ...(params.caseId ? [{ caseId: params.caseId }] : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

const loadOrdersAndResults = async (params: {
  organisationId: string;
  appointmentId?: string;
  companionId?: string;
}) => {
  const orders = await prisma.labOrder.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.appointmentId || params.companionId
        ? {
            OR: [
              ...(params.appointmentId
                ? [{ appointmentId: params.appointmentId }]
                : []),
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  const results = await prisma.labResult.findMany({
    where: {
      organisationId: params.organisationId,
      ...(params.companionId || orders.some((order) => order.idexxOrderId)
        ? {
            OR: [
              ...(params.companionId
                ? [{ patientId: params.companionId }]
                : []),
              ...orders
                .filter((order) => order.idexxOrderId)
                .map((order) => ({ orderId: order.idexxOrderId })),
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
  });

  return { orders, results };
};

const loadDocuments = async (params: {
  organisationId: string;
  appointmentId?: string;
  encounterId?: string;
  companionId?: string;
}) => {
  const renderedDocumentConditions = [
    ...(params.appointmentId
      ? [
          {
            templateInstance: {
              is: { appointmentId: params.appointmentId },
            },
          },
          {
            clinicalArtifact: {
              is: { appointmentId: params.appointmentId },
            },
          },
        ]
      : []),
    ...(params.encounterId
      ? [
          {
            templateInstance: {
              is: { encounterId: params.encounterId },
            },
          },
          {
            clinicalArtifact: {
              is: { encounterId: params.encounterId },
            },
          },
        ]
      : []),
  ];

  const [documents, renderedDocuments] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(params.appointmentId
          ? { appointmentId: params.appointmentId }
          : {}),
        ...(params.companionId ? { patientId: params.companionId } : {}),
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.renderedDocument.findMany({
      where: {
        organisationId: params.organisationId,
        ...(renderedDocumentConditions.length
          ? { OR: renderedDocumentConditions }
          : {}),
      },
      include: {
        templateInstance: {
          select: {
            appointmentId: true,
            encounterId: true,
          },
        },
        clinicalArtifact: {
          select: {
            appointmentId: true,
            encounterId: true,
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }) as Promise<RenderedDocumentRow[]>,
  ]);

  const rows: WorkspaceDocumentRow[] = [
    ...documents.map((document) =>
      mapDocumentRow({
        documentId: document.id,
        sourceKind: "DOCUMENT",
        sourceId: document.id,
        appointmentId: document.appointmentId ?? null,
        encounterId: null,
        companionId: document.patientId ?? null,
        templateId: null,
        templateVersion: null,
        title: document.title,
        kind: document.category,
        status: document.pmsVisible ? "SIGNED" : "DRAFT",
        signingStatus: document.pmsVisible ? "SIGNED" : "NOT_STARTED",
        pdfUrl: null,
        createdAt: document.createdAt,
        updatedAt: document.updatedAt,
      }),
    ),
    ...renderedDocuments.map(mapRenderedDocumentRow),
  ];

  return rows;
};

const buildBootstrapAggregate = async (
  input: WorkspaceBootstrapInput,
  permissions?: string[],
  options?: { requireAppointment?: boolean },
): Promise<WorkspaceBootstrapResponse> => {
  const context = await buildContext(input);
  const organisation = (await prisma.organization.findUnique({
    where: { id: input.organisationId },
    select: {
      appointmentLockWindowOutpatientMinutes: true,
      appointmentLockWindowInpatientMinutes: true,
    },
  })) as OrganizationLockWindowRow | null;

  if (options?.requireAppointment && !context.appointment) {
    throw new WorkspaceServiceError("Appointment not found", 404);
  }

  const appointmentId = context.appointment?.id;
  const encounterId = context.encounter?.id;
  const companionId = context.companion?.id;
  const caseId = context.episodeOfCare?.id;

  const [
    forms,
    clinical,
    treatmentItems,
    tasks,
    schedules,
    templateInstances,
    documents,
    ordersAndResults,
  ] = await Promise.all([
    loadForms(input.organisationId, appointmentId),
    loadClinicalArtifacts({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
    }),
    loadTreatmentItems({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
    }),
    loadTasks({
      organisationId: input.organisationId,
      appointmentId,
      companionId,
    }),
    loadSchedules({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
      companionId,
    }),
    loadTemplateInstances({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
      caseId,
    }),
    loadDocuments({
      organisationId: input.organisationId,
      appointmentId,
      encounterId,
      companionId,
    }),
    loadOrdersAndResults({
      organisationId: input.organisationId,
      appointmentId,
      companionId,
    }),
  ]);

  const diagnosticPreloads = await loadDiagnosticPreloads({
    organisationId: input.organisationId,
    treatmentItems,
  });

  const labSummary = buildLabSummary(
    ordersAndResults.orders,
    ordersAndResults.results,
  );
  const locked = resolveWorkspaceLock({
    appointment: context.appointment,
    encounter: context.encounter,
    organisation,
  });
  const billingState = await loadBootstrapBillingState({
    organisationId: input.organisationId,
    appointmentId,
    encounter: context.encounter,
  });

  return {
    organisationId: input.organisationId,
    appointment: context.appointment
      ? buildWorkspaceSummaryItem({
          id: context.appointment.id,
          name: context.appointment.concern,
          status: context.appointment.status,
          kind: context.appointment.appointmentKind,
          createdAt: context.appointment.createdAt,
          updatedAt: context.appointment.updatedAt,
        })
      : null,
    encounter: context.encounter,
    episodeOfCare: context.episodeOfCare,
    companion: context.companion
      ? buildWorkspaceSummaryItem({
          id: context.companion.id,
          name: context.companion.name,
          status: context.companion.status,
          kind: context.companion.type,
          createdAt: context.companion.createdAt,
          updatedAt: context.companion.updatedAt,
        })
      : null,
    client: context.client
      ? buildWorkspaceSummaryItem({
          id: context.client.id,
          name: [context.client.firstName, context.client.lastName]
            .filter(Boolean)
            .join(" ")
            .trim(),
          status: null,
          kind: "CLIENT",
          createdAt: context.client.createdAt,
          updatedAt: context.client.updatedAt,
        })
      : null,
    templateInstances,
    clinicalArtifacts: clinical.clinicalArtifacts,
    vitals: clinical.vitalRecords,
    prescriptions: clinical.prescriptions,
    treatmentItems: [
      ...buildTreatmentItemsFromPrescriptions(
        clinical.prescriptions as never,
        locked,
      ).map((item) => ({
        ...item,
        organisationId: input.organisationId,
        appointmentId: appointmentId ?? null,
        encounterId: encounterId ?? appointmentId ?? "",
      })),
      ...treatmentItems.map(mapTreatmentItemRow),
    ],
    diagnosticQueue: buildDiagnosticQueue(
      ordersAndResults.orders as never,
      ordersAndResults.results as never,
      diagnosticPreloads,
    ),
    labSummary,
    tasks,
    schedules,
    forms: forms.items,
    documents,
    locks: buildLocks(locked),
    permissions: buildPermissionSnapshot(permissions),
    invoice: billingState.invoice,
    visitBillingStage: billingState.visitBillingStage,
    readyForBilling: billingState.readyForBilling,
    readyForDischarge: billingState.readyForDischarge,
    primaryAction: buildPrimaryAction({
      forms: forms.items,
      tasks,
      clinicalArtifacts: clinical.clinicalArtifacts.map((artifact) => ({
        status:
          (artifact as { artifact?: { status?: string } }).artifact?.status ??
          (artifact as { status?: string }).status ??
          "DRAFT",
      })),
      labSummary,
    }),
  } as WorkspaceBootstrapResponse;
};

export const WorkspaceService = {
  async getAppointmentBootstrap(
    input: WorkspaceBootstrapInput,
    permissions?: string[],
  ): Promise<WorkspaceBootstrapResponse> {
    return buildBootstrapAggregate(input, permissions, {
      requireAppointment: true,
    });
  },

  async getEncounterBootstrap(
    input: WorkspaceBootstrapInput,
    permissions?: string[],
  ): Promise<WorkspaceBootstrapResponse> {
    const context = await buildContext({
      organisationId: input.organisationId,
      encounterId: input.encounterId,
    });

    if (!context.encounter) {
      throw new WorkspaceServiceError("Encounter not found", 404);
    }

    return buildBootstrapAggregate(
      {
        organisationId: input.organisationId,
        appointmentId: context.appointment?.id,
        encounterId: context.encounter.id,
      },
      permissions,
    );
  },

  async getAppointmentDocuments(
    input: WorkspaceBootstrapInput,
    permissions?: string[],
  ): Promise<WorkspaceDocumentRow[]> {
    return (await WorkspaceService.getAppointmentBootstrap(input, permissions))
      .documents;
  },

  async getEncounterDocuments(
    input: WorkspaceBootstrapInput,
    permissions?: string[],
  ): Promise<WorkspaceDocumentRow[]> {
    return (await WorkspaceService.getEncounterBootstrap(input, permissions))
      .documents;
  },

  async getEncounterTreatmentItems(
    input: WorkspaceBootstrapInput,
  ): Promise<WorkspaceTreatmentItem[]> {
    const encounterId = input.encounterId?.trim();
    if (!encounterId) {
      throw new WorkspaceServiceError("Encounter is required", 400);
    }

    const items = (await prisma.workspaceTreatmentItem.findMany({
      where: {
        organisationId: input.organisationId,
        encounterId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    })) as TreatmentItemRow[];

    return items.map(mapTreatmentItemRow);
  },

  async createEncounterTreatmentItem(
    input: WorkspaceTreatmentItemCreateInput,
  ): Promise<WorkspaceTreatmentItem> {
    const encounterId = input.encounterId?.trim();
    if (!encounterId) {
      throw new WorkspaceServiceError("Encounter is required", 400);
    }

    const created = (await prisma.workspaceTreatmentItem.create({
      data: {
        organisationId: input.organisationId,
        appointmentId: input.appointmentId ?? undefined,
        encounterId,
        productId: input.productId,
        productVersion: input.productVersion ?? undefined,
        productSnapshot: input.productSnapshot as Prisma.InputJsonValue,
        servicePackageKind: input.servicePackageKind,
        quantity: input.quantity,
        priceSnapshot: input.priceSnapshot as Prisma.InputJsonValue,
        billingStatus: input.billingStatus ?? "UNBILLED",
        invoiceRowId: input.invoiceRowId ?? undefined,
        lockState:
          input.lockState === undefined
            ? undefined
            : (input.lockState as Prisma.InputJsonValue),
      },
    })) as TreatmentItemRow;

    return mapTreatmentItemRow(created);
  },

  async updateTreatmentItem(
    itemId: string,
    organisationId: string,
    input: WorkspaceTreatmentItemUpdateInput,
  ): Promise<WorkspaceTreatmentItem> {
    const existing = (await prisma.workspaceTreatmentItem.findFirst({
      where: { id: itemId, organisationId },
    })) as TreatmentItemRow | null;

    if (!existing) {
      throw new WorkspaceServiceError("Treatment item not found", 404);
    }

    const updated = (await prisma.workspaceTreatmentItem.update({
      where: { id: itemId },
      data: {
        appointmentId:
          input.appointmentId === undefined ? undefined : input.appointmentId,
        productId: input.productId ?? undefined,
        productVersion:
          input.productVersion === undefined ? undefined : input.productVersion,
        productSnapshot:
          input.productSnapshot === undefined
            ? undefined
            : (input.productSnapshot as Prisma.InputJsonValue),
        servicePackageKind: input.servicePackageKind ?? undefined,
        quantity: input.quantity ?? undefined,
        priceSnapshot:
          input.priceSnapshot === undefined
            ? undefined
            : (input.priceSnapshot as Prisma.InputJsonValue),
        billingStatus: input.billingStatus ?? undefined,
        invoiceRowId:
          input.invoiceRowId === undefined ? undefined : input.invoiceRowId,
        lockState:
          input.lockState === undefined
            ? undefined
            : (input.lockState as Prisma.InputJsonValue),
      },
    })) as TreatmentItemRow;

    return mapTreatmentItemRow(updated);
  },

  async deleteTreatmentItem(
    itemId: string,
    organisationId: string,
  ): Promise<void> {
    const existing = await prisma.workspaceTreatmentItem.findFirst({
      where: { id: itemId, organisationId },
      select: { id: true },
    });

    if (!existing) {
      throw new WorkspaceServiceError("Treatment item not found", 404);
    }

    await prisma.workspaceTreatmentItem.delete({ where: { id: itemId } });
  },

  async getCompanionDocuments(input: {
    organisationId: string;
    companionId: string;
  }): Promise<WorkspaceDocumentRow[]> {
    const companion = await prisma.patient.findFirst({
      where: { id: input.companionId },
    });

    if (!companion) {
      throw new WorkspaceServiceError("Companion not found", 404);
    }

    const encounters = await prisma.encounter.findMany({
      where: {
        organisationId: input.organisationId,
        patientId: input.companionId,
      },
      select: { id: true },
    });

    const encounterDocuments = await Promise.all(
      encounters.map(async (encounter) =>
        WorkspaceService.getEncounterDocuments({
          organisationId: input.organisationId,
          encounterId: encounter.id,
        }),
      ),
    );

    const directDocuments = await loadDocuments({
      organisationId: input.organisationId,
      companionId: input.companionId,
    });

    return dedupeDocumentRows([
      ...encounterDocuments.flat(),
      ...directDocuments,
    ]);
  },

  async getCompanionMedicalRecords(input: {
    organisationId: string;
    companionId: string;
  }): Promise<WorkspaceDocumentRow[]> {
    const documents = await WorkspaceService.getCompanionDocuments(input);

    return documents.filter((document) =>
      MEDICAL_RECORD_KINDS.has(document.kind),
    );
  },
};
