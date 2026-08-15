import { AppointmentService } from "src/services/appointment.service";
import { TaskService } from "src/services/task.service";
import { FormService } from "src/services/form.service";
import { DocumentService } from "src/services/document.service";
import { LabResultService } from "src/services/lab-result.service";
import { LabOrderService } from "src/services/lab-order.service";
import { InvoiceService } from "src/services/invoice.service";
import { CompanionService } from "src/services/companion.service";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { type AppointmentResponseDTO } from "@yosemite-crew/types";
import type { DocumentDto } from "src/services/document.service";

type LabOrderSummary = {
  idexxOrderId?: string | null;
  appointmentId?: string | null;
  pdfUrl?: string | null;
};

type LabResultSummary = Awaited<
  ReturnType<typeof LabResultService.list>
>[number];

export class CompanionHistoryServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionHistoryServiceError";
  }
}

type HistoryEntryType =
  | "APPOINTMENT"
  | "TASK"
  | "FORM_SUBMISSION"
  | "DOCUMENT"
  | "LAB_RESULT"
  | "INVOICE";

type HistoryEntryStatus =
  | "REQUESTED"
  | "UPCOMING"
  | "CHECKED_IN"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW"
  | "PENDING"
  | "SIGNED"
  | "FAILED"
  | "PAID"
  | "ACTIVE"
  | "UNKNOWN";

type HistoryEntryActor = {
  id?: string;
  name?: string;
  role?: "VET" | "STAFF" | "PARENT" | "SYSTEM";
};

type HistoryEntryLink = {
  kind:
    | "appointment"
    | "task"
    | "form_submission"
    | "document"
    | "lab_result"
    | "invoice";
  id: string;
  appointmentId?: string;
  patientId: string;
};

type HistoryEntry = {
  id: string;
  type: HistoryEntryType;
  occurredAt: string;
  status?: HistoryEntryStatus;
  title: string;
  subtitle?: string;
  summary?: string;
  actor?: HistoryEntryActor;
  tags?: string[];
  link: HistoryEntryLink;
  source: "APPOINTMENT" | "TASK" | "FORM" | "DOCUMENT" | "LAB" | "INVOICE";
  payload: Record<string, unknown>;
};

type CompanionHistoryResponse = {
  entries: HistoryEntry[];
  nextCursor: string | null;
  summary: {
    totalReturned: number;
    countsByType: Record<HistoryEntryType, number>;
  };
};

type HistoryCursor = {
  occurredAt: string;
  id: string;
};

const ALL_HISTORY_TYPES = new Set<HistoryEntryType>([
  "APPOINTMENT",
  "TASK",
  "FORM_SUBMISSION",
  "DOCUMENT",
  "LAB_RESULT",
  "INVOICE",
]);

const DEFAULT_HISTORY_TYPES: HistoryEntryType[] = [
  "APPOINTMENT",
  "TASK",
  "FORM_SUBMISSION",
  "DOCUMENT",
  "INVOICE",
];

const SOAP_CATEGORIES = new Set([
  "SOAP-Subjective",
  "SOAP-Objective",
  "SOAP-Assessment",
  "SOAP-Plan",
  "Discharge",
]);

const EXT_APPOINTMENT_PAYMENT_STATUS =
  "https://yosemitecrew.com/fhir/StructureDefinition/appointment-payment-status";

const ensureSafeString = (value: unknown, field: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new CompanionHistoryServiceError(`${field} is required`, 400);
  }
  if (value.includes("$") || value.includes(".")) {
    throw new CompanionHistoryServiceError(`Invalid ${field}`, 400);
  }
  return value.trim();
};

const resolveLimit = (value?: number) => {
  if (value == null) return 50;
  if (!Number.isFinite(value)) {
    throw new CompanionHistoryServiceError("Invalid limit", 400);
  }
  const normalized = Math.floor(value);
  if (normalized <= 0) {
    throw new CompanionHistoryServiceError("Invalid limit", 400);
  }
  return Math.min(normalized, 100);
};

const parseCursor = (cursor?: string): HistoryCursor | null => {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded) as Partial<HistoryCursor>;
    if (!parsed || typeof parsed !== "object") {
      throw new TypeError("Invalid cursor");
    }
    if (
      typeof parsed.occurredAt !== "string" ||
      typeof parsed.id !== "string"
    ) {
      throw new TypeError("Invalid cursor");
    }
    const parsedDate = new Date(parsed.occurredAt);
    if (Number.isNaN(parsedDate.getTime())) {
      throw new TypeError("Invalid cursor");
    }
    return { occurredAt: parsed.occurredAt, id: parsed.id };
  } catch {
    throw new CompanionHistoryServiceError("Invalid cursor", 400);
  }
};

const buildCursor = (entry: HistoryEntry): string =>
  Buffer.from(
    JSON.stringify({ occurredAt: entry.occurredAt, id: entry.id }),
    "utf-8",
  ).toString("base64");

const compareEntries = (a: HistoryEntry, b: HistoryEntry) => {
  const timeA = new Date(a.occurredAt).getTime();
  const timeB = new Date(b.occurredAt).getTime();
  if (timeA !== timeB) return timeB - timeA;
  if (a.id === b.id) return 0;
  return a.id > b.id ? -1 : 1;
};

const isAfterCursor = (entry: HistoryEntry, cursor: HistoryCursor) => {
  const entryTime = new Date(entry.occurredAt).getTime();
  const cursorTime = new Date(cursor.occurredAt).getTime();
  if (entryTime < cursorTime) return true;
  if (entryTime > cursorTime) return false;
  return entry.id < cursor.id;
};

const formatDateSubtitle = (value?: string, roomName?: string) => {
  if (!value) return roomName ?? undefined;
  const date = new Date(value);
  const dateLabel = Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  if (!roomName) return dateLabel;
  return `${dateLabel} • ${roomName}`;
};

const resolveAppointmentParticipants = (
  appointment: AppointmentResponseDTO,
) => {
  const participants = appointment.participant ?? [];
  const participantHasTypeCode = (
    participant: NonNullable<AppointmentResponseDTO["participant"]>[number],
    code: string,
  ) => {
    for (const type of participant.type ?? []) {
      for (const coding of type.coding ?? []) {
        if (coding.code === code) return true;
      }
    }
    return false;
  };
  const findByTypeCode = (code: string) =>
    participants.find((p) => participantHasTypeCode(p, code));

  const lead = findByTypeCode("PPRF");
  const room = findByTypeCode("LOC");
  const support = participants.filter((p) => participantHasTypeCode(p, "SPRF"));

  return { lead, room, support };
};

const resolveAppointmentPaymentStatus = (
  appointment: AppointmentResponseDTO,
): string | undefined =>
  appointment.extension?.find(
    (ext) => ext.url === EXT_APPOINTMENT_PAYMENT_STATUS,
  )?.valueString;

type TaskSummaryTask = {
  medication?: unknown;
  description?: string | null;
  additionalNotes?: string | null;
};

const readDoseField = (
  dose: Record<string, unknown> | undefined,
  field: "dosage" | "frequency" | "time",
) => {
  const value = dose?.[field];
  return typeof value === "string" ? value : undefined;
};

const buildMedicationSummary = (medication: unknown): string | undefined => {
  if (!medication || typeof medication !== "object") return undefined;

  const medObj = medication as Record<string, unknown>;
  const name = typeof medObj.name === "string" ? medObj.name : undefined;
  if (!name) return undefined;

  const doses = Array.isArray(medObj.doses)
    ? (medObj.doses as Array<Record<string, unknown>>)
    : [];
  const dose = doses[0];
  const parts = [
    name,
    readDoseField(dose, "dosage"),
    readDoseField(dose, "frequency"),
    readDoseField(dose, "time"),
  ].filter(Boolean);
  return parts.join(" ");
};

const buildTaskSummary = (task: TaskSummaryTask) =>
  buildMedicationSummary(task.medication) ??
  task.description ??
  task.additionalNotes ??
  undefined;

const buildDocumentSummary = (doc: DocumentDto) => {
  const attachmentCount = doc.attachments?.length ?? 0;
  let attachmentLabel: string | undefined;
  if (attachmentCount) {
    const suffix = attachmentCount === 1 ? "" : "s";
    attachmentLabel = `${attachmentCount} attachment${suffix}`;
  }
  const pieces = [doc.issuingBusinessName, attachmentLabel].filter(Boolean);
  return pieces.length ? pieces.join(" • ") : undefined;
};

const buildLabSummary = (result: LabResultSummary) => {
  if (result.status) return result.status;
  return "Result available";
};

const resolveAnswersPreview = (answers?: Record<string, unknown>) => {
  if (!answers) return undefined;
  const entries = Object.values(answers)
    .map((value) =>
      typeof value === "string" ? value.trim() : JSON.stringify(value),
    )
    .filter(Boolean);
  if (!entries.length) return undefined;
  return entries.slice(0, 3).join(" • ");
};

const ensureCompanionVisible = async (
  organisationId: string,
  patientId: string,
) => {
  const link = await prisma.patientOrganisation.findFirst({
    where: {
      organisationId,
      patientId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { id: true },
  });
  return Boolean(link);
};

const getAppointmentIdSet = async (
  patientId: string,
  organisationId: string,
) => {
  const appointments =
    await AppointmentService.getAppointmentsForCompanionByOrganisation(
      patientId,
      organisationId,
    );

  return new Set(
    appointments
      .map((appointment) => appointment.id)
      .filter((id): id is string => Boolean(id)),
  );
};

const appendAppointmentHistoryEntries = async (params: {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
}) => {
  const appointments =
    await AppointmentService.getAppointmentsForCompanionByOrganisation(
      params.patientId,
      params.organisationId,
    );

  for (const appointment of appointments) {
    const { lead, room, support } = resolveAppointmentParticipants(appointment);
    const appointmentType = appointment.serviceType?.[0]?.coding?.[0];
    const speciality = appointment.specialty?.[0]?.coding?.[0];
    const paymentStatus = resolveAppointmentPaymentStatus(appointment);

    const appointmentId = appointment.id ?? "";
    const occurredAt = appointment.start ?? new Date().toISOString();

    params.entries.push({
      id: `APPOINTMENT:${appointmentId}`,
      type: "APPOINTMENT",
      occurredAt,
      status: appointment.status as HistoryEntryStatus,
      title: appointmentType?.display ?? "Appointment",
      subtitle: formatDateSubtitle(
        occurredAt,
        room?.actor?.display ?? undefined,
      ),
      summary: appointment.description ?? undefined,
      actor: lead?.actor?.reference
        ? {
            id: lead.actor.reference.split("/")[1],
            name: lead.actor.display ?? undefined,
            role: "VET",
          }
        : undefined,
      link: {
        kind: "appointment",
        id: appointmentId,
        patientId: params.patientId,
      },
      source: "APPOINTMENT",
      payload: {
        appointmentId,
        serviceName: appointmentType?.display ?? undefined,
        specialityName: speciality?.display ?? undefined,
        reason: appointment.description ?? undefined,
        roomName: room?.actor?.display ?? undefined,
        leadName: lead?.actor?.display ?? undefined,
        supportStaffNames: support
          .map((member) => member.actor?.display)
          .filter(Boolean),
        paymentStatus: paymentStatus ?? undefined,
      },
    });
  }
};

const appendTaskHistoryEntries = async (params: {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
}) => {
  const tasks = await TaskService.listForCompanion({
    patientId: params.patientId,
    organisationId: params.organisationId,
  });
  for (const task of tasks) {
    // The query is organisation-scoped; re-checking each row keeps a history
    // timeline from leaking another tenant's task if that scope ever regresses.
    if (task.organisationId && task.organisationId !== params.organisationId) {
      continue;
    }

    const taskId = task.id;
    const occurredAt =
      task.completedAt?.toISOString() ??
      task.dueAt?.toISOString() ??
      task.createdAt?.toISOString() ??
      new Date().toISOString();

    params.entries.push({
      id: `TASK:${taskId}`,
      type: "TASK",
      occurredAt,
      status: task.status,
      title: task.name,
      subtitle: [task.category, task.audience].filter(Boolean).join(" • "),
      summary: buildTaskSummary(task),
      actor: task.assignedTo
        ? { id: task.assignedTo, role: "STAFF" }
        : undefined,
      link: {
        kind: "task",
        id: taskId,
        patientId: params.patientId,
        appointmentId: task.appointmentId ?? undefined,
      },
      source: "TASK",
      payload: {
        taskId,
        appointmentId: task.appointmentId ?? undefined,
        audience: task.audience,
        category: task.category,
        dueAt: task.dueAt?.toISOString(),
        completedAt: task.completedAt?.toISOString(),
        medication: task.medication ?? undefined,
      },
    });
  }
};

const appendFormSubmissionHistoryEntries = async (params: {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
}) => {
  const submissions =
    await FormService.listSubmissionsForCompanionInOrganisation({
      organisationId: params.organisationId,
      patientId: params.patientId,
    });

  for (const submission of submissions) {
    const occurredAt =
      submission.submittedAt?.toISOString() ?? new Date().toISOString();
    const tags =
      submission.formCategory && SOAP_CATEGORIES.has(submission.formCategory)
        ? ["SOAP", submission.formCategory]
        : undefined;

    params.entries.push({
      id: `FORM_SUBMISSION:${submission.id}`,
      type: "FORM_SUBMISSION",
      occurredAt,
      status: submission.signing?.status === "SIGNED" ? "SIGNED" : "COMPLETED",
      title: submission.formName ?? "Form submission",
      subtitle: submission.formCategory ?? undefined,
      summary: resolveAnswersPreview(submission.answers) ?? "Submitted",
      actor: submission.submittedBy
        ? { id: submission.submittedBy, role: "PARENT" }
        : undefined,
      tags,
      link: {
        kind: "form_submission",
        id: submission.id,
        patientId: params.patientId,
        appointmentId: submission.appointmentId ?? undefined,
      },
      source: "FORM",
      payload: {
        submissionId: submission.id,
        formId: submission.formId,
        formVersion: submission.formVersion,
        formName: submission.formName ?? undefined,
        formCategory: submission.formCategory ?? undefined,
        appointmentId: submission.appointmentId ?? undefined,
        signing: submission.signing ?? undefined,
        answers: submission.answers ?? undefined,
      },
    });
  }
};

const appendDocumentHistoryEntries = async (params: {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
  ensureAppointmentIds: () => Promise<Set<string>>;
}) => {
  const documents = await DocumentService.listForPms({
    patientId: params.patientId,
    organisationId: params.organisationId,
  });
  const appointmentIds = documents
    .map((doc) => doc.appointmentId ?? undefined)
    .filter(Boolean) as string[];
  const appointmentIdsInOrg =
    appointmentIds.length > 0 ? await params.ensureAppointmentIds() : null;

  for (const doc of documents) {
    if (
      doc.appointmentId &&
      appointmentIdsInOrg &&
      !appointmentIdsInOrg.has(doc.appointmentId)
    ) {
      continue;
    }
    const occurredAt = doc.issueDate ?? doc.createdAt ?? undefined;
    const normalizedOccurredAt = occurredAt ?? new Date().toISOString();

    params.entries.push({
      id: `DOCUMENT:${doc.id}`,
      type: "DOCUMENT",
      occurredAt: normalizedOccurredAt,
      status: "COMPLETED",
      title: doc.title,
      subtitle: [doc.category, doc.subcategory].filter(Boolean).join(" • "),
      summary: buildDocumentSummary(doc),
      link: {
        kind: "document",
        id: doc.id,
        patientId: params.patientId,
        appointmentId: doc.appointmentId ?? undefined,
      },
      source: "DOCUMENT",
      payload: {
        documentId: doc.id,
        appointmentId: doc.appointmentId ?? undefined,
        category: doc.category,
        subcategory: doc.subcategory ?? undefined,
        issueDate: doc.issueDate ?? undefined,
        issuingBusinessName: doc.issuingBusinessName ?? undefined,
        attachmentCount: doc.attachments?.length ?? 0,
        openable: (doc.attachments?.length ?? 0) > 0,
      },
    });
  }
};

const appendLabResultHistoryEntries = async (params: {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
}) => {
  const results = await LabResultService.list({
    organisationId: params.organisationId,
    provider: "IDEXX",
    patientId: params.patientId,
  });

  const orders = await LabOrderService.listOrders({
    organisationId: params.organisationId,
    patientId: params.patientId,
    provider: "IDEXX",
  });
  const orderMap = new Map<string, LabOrderSummary>();
  orders.forEach((order) => {
    if (!order.idexxOrderId) return;
    orderMap.set(order.idexxOrderId, order);
  });

  for (const result of results) {
    const occurredAt =
      result.updatedAt?.toISOString() ??
      result.createdAt?.toISOString() ??
      new Date().toISOString();
    const order = result.orderId ? orderMap.get(result.orderId) : undefined;

    params.entries.push({
      id: `LAB_RESULT:${result.resultId}`,
      type: "LAB_RESULT",
      occurredAt,
      status: result.status ? "COMPLETED" : "PENDING",
      title: `${result.provider ?? "Lab"} Result`,
      subtitle: result.status ?? undefined,
      summary: buildLabSummary(result),
      link: {
        kind: "lab_result",
        id: result.resultId,
        patientId: params.patientId,
        appointmentId: order?.appointmentId?.toString(),
      },
      source: "LAB",
      payload: {
        resultId: result.resultId,
        orderId: result.orderId ?? undefined,
        patientName: result.patientName ?? undefined,
        status: result.status ?? undefined,
        accessionId: result.accessionId ?? undefined,
        pdfUrl: order?.pdfUrl ?? undefined,
        pdfAvailable: Boolean(order?.pdfUrl ?? result.rawPayload),
      },
    });
  }
};

const appendInvoiceHistoryEntries = async (params: {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
}) => {
  const invoices = await InvoiceService.listForCompanion(
    params.patientId,
    params.organisationId,
  );
  for (const invoice of invoices) {
    const occurredAt =
      invoice.paidAt?.toISOString() ??
      invoice.createdAt?.toISOString() ??
      new Date().toISOString();

    params.entries.push({
      id: `INVOICE:${invoice.id ?? ""}`,
      type: "INVOICE",
      occurredAt,
      status: invoice.status as HistoryEntryStatus,
      title: "Invoice",
      subtitle: invoice.status,
      summary: `${invoice.totalAmount} ${invoice.currency}`,
      link: {
        kind: "invoice",
        id: invoice.id ?? "",
        patientId: params.patientId,
        appointmentId: invoice.appointmentId ?? undefined,
      },
      source: "INVOICE",
      payload: {
        invoiceId: invoice.id ?? undefined,
        appointmentId: invoice.appointmentId ?? undefined,
        status: invoice.status,
        totalAmount: invoice.totalAmount,
        currency: invoice.currency,
        paymentCollectionMethod: invoice.paymentCollectionMethod,
        paidAt: invoice.paidAt?.toISOString(),
      },
    });
  }
};

type HistorySectionContext = {
  entries: HistoryEntry[];
  patientId: string;
  organisationId: string;
  ensureAppointmentIds: () => Promise<Set<string>>;
};

const HISTORY_SECTION_LOADERS: Array<{
  type: HistoryEntryType;
  failureLabel: string;
  append: (ctx: HistorySectionContext) => Promise<void>;
}> = [
  {
    type: "APPOINTMENT",
    failureLabel: "appointments",
    append: async (ctx) => {
      await appendAppointmentHistoryEntries(ctx);
      await ctx.ensureAppointmentIds();
    },
  },
  { type: "TASK", failureLabel: "tasks", append: appendTaskHistoryEntries },
  {
    type: "FORM_SUBMISSION",
    failureLabel: "form submissions",
    append: appendFormSubmissionHistoryEntries,
  },
  {
    type: "DOCUMENT",
    failureLabel: "documents",
    append: appendDocumentHistoryEntries,
  },
  {
    type: "LAB_RESULT",
    failureLabel: "lab results",
    append: appendLabResultHistoryEntries,
  },
  {
    type: "INVOICE",
    failureLabel: "invoices",
    append: appendInvoiceHistoryEntries,
  },
];

const appendRequestedHistorySections = async (
  types: HistoryEntryType[],
  ctx: HistorySectionContext,
) => {
  for (const loader of HISTORY_SECTION_LOADERS) {
    if (!types.includes(loader.type)) continue;
    try {
      await loader.append(ctx);
    } catch (error) {
      // No patientId: the failure label plus the organisation is enough to
      // locate the fault, and the log must not carry a patient identifier.
      logger.warn(`Companion history ${loader.failureLabel} failed`, {
        error,
        organisationId: ctx.organisationId,
      });
    }
  }
};

export const CompanionHistoryService = {
  async listForCompanion(params: {
    organisationId: string;
    patientId: string;
    limit?: number;
    cursor?: string;
    types?: HistoryEntryType[];
  }): Promise<CompanionHistoryResponse> {
    const organisationId = ensureSafeString(
      params.organisationId,
      "organisationId",
    );
    const patientId = ensureSafeString(params.patientId, "patientId");
    const limit = resolveLimit(params.limit);
    const cursor = parseCursor(params.cursor);

    const types = params.types?.length ? params.types : DEFAULT_HISTORY_TYPES;
    const invalidType = types.some((type) => !ALL_HISTORY_TYPES.has(type));
    if (invalidType) {
      throw new CompanionHistoryServiceError("Invalid types filter", 400);
    }

    const companion = await CompanionService.getById(patientId);
    if (!companion?.response) {
      throw new CompanionHistoryServiceError("Companion not found", 404);
    }

    const isVisible = await ensureCompanionVisible(organisationId, patientId);
    if (!isVisible) {
      throw new CompanionHistoryServiceError("Companion not found", 404);
    }

    const entries: HistoryEntry[] = [];
    let appointmentIdSet: Set<string> | null = null;
    const ensureAppointmentIds = async () => {
      if (appointmentIdSet) return appointmentIdSet;
      appointmentIdSet = await getAppointmentIdSet(patientId, organisationId);
      return appointmentIdSet;
    };

    await appendRequestedHistorySections(types, {
      entries,
      patientId,
      organisationId,
      ensureAppointmentIds,
    });

    const sorted = [...entries].sort(compareEntries);
    const filtered = cursor
      ? sorted.filter((entry) => isAfterCursor(entry, cursor))
      : sorted;

    const paged = filtered.slice(0, limit);
    const nextCursor =
      paged.length === limit ? buildCursor(paged.at(-1)!) : null;

    const countsByType = paged.reduce(
      (acc, entry) => {
        acc[entry.type] = (acc[entry.type] ?? 0) + 1;
        return acc;
      },
      {
        APPOINTMENT: 0,
        TASK: 0,
        FORM_SUBMISSION: 0,
        DOCUMENT: 0,
        LAB_RESULT: 0,
        INVOICE: 0,
      } as Record<HistoryEntryType, number>,
    );

    return {
      entries: paged,
      nextCursor,
      summary: {
        totalReturned: paged.length,
        countsByType,
      },
    };
  },
};

export type {
  HistoryEntry,
  HistoryEntryType,
  HistoryEntryStatus,
  HistoryEntryActor,
  HistoryEntryLink,
  CompanionHistoryResponse,
};
