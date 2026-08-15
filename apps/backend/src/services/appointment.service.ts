import dayjs from "dayjs";
import { AppointmentStatus } from "../models/appointment";
import {
  Appointment,
  AppointmentPaymentStatus,
  AppointmentRequestDTO,
  AppointmentResponseDTO,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
} from "@yosemite-crew/types";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { InvoiceService } from "./invoice.service";
import { roundMoney } from "./finance/pricing";
import { StripeService } from "./stripe.service";
import { NotificationTemplates } from "src/utils/notificationTemplates";
import { NotificationService } from "./notification.service";
import { TaskService } from "./task.service";
import { FormServiceError } from "./form.service";
import { sendEmailTemplate } from "src/utils/email";
import logger from "src/utils/logger";
import { sendFreePlanLimitReachedEmail } from "src/utils/org-usage-notifications";
import { AuditTrailService } from "./audit-trail.service";
import { resolvePaymentCollectionMethod } from "src/utils/payment";
import { assertEmail } from "src/utils/sanitize";
import { CatalogService, CatalogServiceError } from "./catalog.service";
import { CompanionOrganisationService } from "./companion-organisation.service";
import { markFreeLimitReachedAt } from "./shared/org-usage-limit";

export class AppointmentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppointmentServiceError";
  }
}

type LegacyAppointmentStatus = AppointmentStatus | "NO_PAYMENT";

type ParentCancelableAppointment = {
  id: string;
  status: AppointmentStatus;
  organisationId: string;
  patient: Prisma.JsonValue;
  lead: Prisma.JsonValue | null;
  supportStaff: Prisma.JsonValue | null;
  room: Prisma.JsonValue | null;
  appointmentType: Prisma.JsonValue | null;
  appointmentDate: Date;
  startTime: Date;
  timeSlot: string;
  durationMinutes: number;
  endTime: Date;
  isEmergency: boolean;
  concern: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: Prisma.JsonValue | null;
  formIds: string[];
};

const getNestedId = (value: Prisma.JsonValue | null | undefined) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const id = (value as { id?: unknown }).id;
  return typeof id === "string" ? id : undefined;
};

const getParentId = (patient: Prisma.JsonValue | null | undefined) => {
  if (!patient || typeof patient !== "object" || Array.isArray(patient)) {
    return undefined;
  }

  return getNestedId((patient as { parent?: Prisma.JsonValue | null }).parent);
};

const getAppointmentPatientId = (appointment: {
  patient?: Prisma.JsonValue | null;
  companion?: Prisma.JsonValue | null;
}) => getNestedId(appointment.patient) ?? getNestedId(appointment.companion);

const normalizeAppointmentStatus = (
  status: LegacyAppointmentStatus,
): AppointmentStatus => (status === "NO_PAYMENT" ? "REQUESTED" : status);

const APPOINTMENT_STATUS_TRANSITIONS: Record<
  AppointmentStatus,
  AppointmentStatus[]
> = {
  REQUESTED: ["UPCOMING", "CANCELLED"],
  UPCOMING: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "REQUESTED"],
  CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const assertAppointmentStatusTransition = (
  current: LegacyAppointmentStatus,
  next: AppointmentStatus,
  context: string,
) => {
  const normalizedCurrent = normalizeAppointmentStatus(current);
  if (normalizedCurrent === next) return;

  const allowed = APPOINTMENT_STATUS_TRANSITIONS[normalizedCurrent] ?? [];
  if (!allowed.includes(next)) {
    throw new AppointmentServiceError(
      `Appointment cannot transition from ${normalizedCurrent} to ${next} in ${context}.`,
      409,
    );
  }
};

export const buildUsageCounterPayload = (doc: {
  appointmentsUsed?: number | null;
  toolsUsed?: number | null;
  usersActiveCount?: number | null;
  usersBillableCount?: number | null;
  freeAppointmentsLimit?: number | null;
  freeToolsLimit?: number | null;
  freeUsersLimit?: number | null;
  freeLimitReachedAt?: Date | null;
  updatedAt?: Date | null;
}) => ({
  appointmentsUsed: doc.appointmentsUsed ?? 0,
  toolsUsed: doc.toolsUsed ?? 0,
  usersActiveCount: doc.usersActiveCount ?? 0,
  usersBillableCount: doc.usersBillableCount ?? 0,
  freeAppointmentsLimit: doc.freeAppointmentsLimit ?? 120,
  freeToolsLimit: doc.freeToolsLimit ?? 200,
  freeUsersLimit: doc.freeUsersLimit ?? 10,
  freeLimitReachedAt: doc.freeLimitReachedAt ?? undefined,
  updatedAt: doc.updatedAt ?? undefined,
});

const assertRequestedAppointment = (
  status: LegacyAppointmentStatus,
  context: string,
) => {
  const normalizedStatus = normalizeAppointmentStatus(status);
  if (normalizedStatus !== "REQUESTED") {
    throw new AppointmentServiceError(
      "Requested appointment not found or already processed",
      404,
    );
  }
  assertAppointmentStatusTransition(status, "UPCOMING", context);
};

export const resolvePaymentStatusByAppointmentIds = async (
  appointmentIds: string[],
): Promise<Map<string, AppointmentPaymentStatus>> => {
  const uniqueIds = Array.from(new Set(appointmentIds.filter(Boolean)));

  if (uniqueIds.length === 0) {
    return new Map<string, AppointmentPaymentStatus>();
  }

  return resolvePaymentStatusByAppointmentIdsFromPostgres(uniqueIds);
};

export const resolvePaymentStatusByAppointmentIdsFromPostgres = async (
  appointmentIds: string[],
): Promise<Map<string, AppointmentPaymentStatus>> => {
  const invoices = await prisma.invoice.findMany({
    where: {
      appointmentId: { in: appointmentIds },
    },
    select: {
      appointmentId: true,
      status: true,
    },
  });

  return buildAppointmentPaymentStatusMap(invoices);
};

const buildAppointmentPaymentStatusMap = (
  invoices: Array<{
    appointmentId: string | null;
    status: string;
  }>,
) => {
  const statusMap = new Map<string, AppointmentPaymentStatus>();
  const tracker = new Map<string, { hasPaid: boolean; hasUnpaid: boolean }>();

  for (const invoice of invoices) {
    if (!invoice.appointmentId) continue;
    const entry = tracker.get(invoice.appointmentId) ?? {
      hasPaid: false,
      hasUnpaid: false,
    };

    if (invoice.status === "PAID") {
      entry.hasPaid = true;
    }
    if (
      ["PENDING", "AWAITING_PAYMENT", "FAILED", "REFUNDED"].includes(
        invoice.status,
      )
    ) {
      entry.hasUnpaid = true;
    }

    tracker.set(invoice.appointmentId, entry);
  }

  for (const [appointmentId, entry] of tracker) {
    statusMap.set(
      appointmentId,
      entry.hasPaid && !entry.hasUnpaid ? "PAID" : "UNPAID",
    );
  }

  return statusMap;
};

type AppointmentRequestInput = ReturnType<typeof fromAppointmentRequestDTO>;

type DraftInvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  total?: number;
};

type LegacyServiceBridge = {
  name: string;
  cost: number;
  maxDiscount?: number | null;
  serviceType?: string;
  observationToolId?: unknown;
};

const mapCatalogSelectionToDraftItems = (selection: {
  productKind: string;
  name: string;
  billingItems: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    defaultDiscountPercent?: number | null;
  }>;
  finalAmount: number;
}): DraftInvoiceItemInput[] =>
  selection.productKind === "PACKAGE"
    ? [
        {
          description: selection.name,
          quantity: 1,
          unitPrice: roundMoney(selection.finalAmount),
          total: roundMoney(selection.finalAmount),
        },
      ]
    : selection.billingItems.map((item) => ({
        description: item.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountPercent: item.defaultDiscountPercent ?? undefined,
      }));

const mapLegacyServiceToDraftItems = (
  service: Pick<LegacyServiceBridge, "name" | "cost" | "maxDiscount">,
  fallbackName?: string,
): DraftInvoiceItemInput[] => [
  {
    description: fallbackName ?? service.name ?? "Consultation",
    quantity: 1,
    unitPrice: service.cost,
    discountPercent: service.maxDiscount ?? undefined,
  },
];

export const resolveCatalogSelectionSafe = async (
  selectionId: string,
  organisationId: string,
) => {
  try {
    return await CatalogService.resolveSelection(selectionId, organisationId);
  } catch (error) {
    if (error instanceof CatalogServiceError && error.statusCode === 404) {
      return null;
    }
    throw error;
  }
};

/**
 * Resolve the booked selection to a catalog entry and/or legacy service row,
 * rejecting selections that are unknown or not bookable as an outpatient
 * appointment. `invalidServiceMessage` keeps the caller-specific 404 wording.
 */
const resolveBookableOutpatientSelection = async (
  selectionId: string,
  organisationId: string,
  invalidServiceMessage: string,
) => {
  const catalogSelection = await resolveCatalogSelectionSafe(
    selectionId,
    organisationId,
  );
  const legacyServiceId = catalogSelection?.legacyServiceId ?? selectionId;
  const service = await prisma.service.findFirst({
    where: {
      id: legacyServiceId,
      organisationId,
      isActive: true,
    },
  });

  if (!catalogSelection && !service) {
    throw new AppointmentServiceError(invalidServiceMessage, 404);
  }

  if (
    catalogSelection &&
    (!catalogSelection.isBookable ||
      !catalogSelection.appointmentKinds.includes("OUTPATIENT"))
  ) {
    throw new AppointmentServiceError(
      "Selected product is not bookable for outpatient appointments.",
      400,
    );
  }

  return { catalogSelection, service };
};

const assertParentCanCancelAppointment = (params: {
  appointment: ParentCancelableAppointment;
  parentId: string;
  context: string;
}) => {
  const { appointment, parentId, context } = params;

  if (getParentId(appointment.patient) !== parentId) {
    throw new AppointmentServiceError("Not your appointment", 403);
  }

  const normalizedStatus = normalizeAppointmentStatus(appointment.status);
  if (!["REQUESTED", "UPCOMING"].includes(normalizedStatus)) {
    throw new AppointmentServiceError(
      "Only requested or upcoming appointments can be cancelled",
      400,
    );
  }

  assertAppointmentStatusTransition(appointment.status, "CANCELLED", context);
};

const cancelAppointmentFromParentPrisma = async (params: {
  appointment: ParentCancelableAppointment;
  parentId: string;
  reason: string;
}) => {
  const { appointment, parentId, reason } = params;

  const result = await InvoiceService.handleAppointmentCancellation(
    appointment.id,
    reason,
  );

  if (!result) {
    throw new AppointmentServiceError("Not able to cancle appointment", 400);
  }

  const updated = (await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: "CANCELLED", updatedAt: new Date() },
  })) as ParentCancelableAppointment;
  const patientId = getAppointmentPatientId(updated) ?? parentId;

  await AuditTrailService.recordSafely({
    organisationId: updated.organisationId,
    patientId,
    eventType: "APPOINTMENT_CANCELLED",
    actorType: "PARENT",
    actorId: parentId,
    entityType: "APPOINTMENT",
    entityId: updated.id,
    metadata: {
      status: updated.status,
      reason,
    },
  });

  if (getNestedId(appointment.lead)) {
    await prisma.occupancy.deleteMany({
      where: {
        referenceId: appointment.id,
        sourceType: "APPOINTMENT",
      },
    });
  }

  return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
};

export const requireBaseAppointmentInput = (
  input: AppointmentRequestInput,
  messages: {
    organisation: string;
    patient: string;
    timing: string;
  },
) => {
  if (!input.organisationId) {
    throw new AppointmentServiceError(messages.organisation, 400);
  }
  if (!input.patient?.id || !input.patient.parent?.id) {
    throw new AppointmentServiceError(messages.patient, 400);
  }
  if (!input.startTime || !input.endTime || !input.durationMinutes) {
    throw new AppointmentServiceError(messages.timing, 400);
  }
};

export const validateRequestedFromMobileInput = (
  input: AppointmentRequestInput,
) => {
  requireBaseAppointmentInput(input, {
    organisation: "organisationId is required",
    patient: "Companion and parent details are required",
    timing: "startTime, endTime, durationMinutes required",
  });
};

export const validateAppointmentFromPmsInput = (
  input: AppointmentRequestInput,
) => {
  requireBaseAppointmentInput(input, {
    organisation: "organisationId is required.",
    patient: "Companion and parent information is required.",
    timing: "startTime, endTime and durationMinutes are required.",
  });
  if (!input.lead?.id) {
    throw new AppointmentServiceError(
      "Lead veterinarian (vet) is required.",
      400,
    );
  }
  if (!input.appointmentType?.id) {
    throw new AppointmentServiceError(
      "Service (appointmentType.id) is required.",
      400,
    );
  }
};

type ParsedPmsAppointmentUpdate = {
  startTimeFromDto?: Date;
  endTimeFromDto?: Date;
  durationMinutesFromDto?: number;
  statusProvided: boolean;
  concernProvided: boolean;
  nextConcern?: string;
  startTimeProvided: boolean;
};

const parsePmsAppointmentUpdate = (
  dto: AppointmentRequestDTO,
  extracted: ReturnType<typeof fromAppointmentRequestDTO>,
): ParsedPmsAppointmentUpdate => {
  const parseOptionalDate = (value: unknown): Date | undefined => {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? undefined : parsed;
    }
    return undefined;
  };

  const dtoAny = dto as unknown as Record<string, unknown>;
  const startTimeFromDto = parseOptionalDate(dtoAny.startTime ?? dtoAny.start);
  const endTimeFromDto = parseOptionalDate(dtoAny.endTime ?? dtoAny.end);

  let durationMinutesFromDto: number | undefined;
  if (typeof dtoAny.durationMinutes === "number") {
    durationMinutesFromDto = dtoAny.durationMinutes;
  } else if (typeof dtoAny.minutesDuration === "number") {
    durationMinutesFromDto = dtoAny.minutesDuration;
  }

  const concernProvided =
    typeof dtoAny.concern === "string" ||
    typeof dtoAny.description === "string";
  let nextConcern: string | undefined;
  if (concernProvided) {
    nextConcern =
      typeof dtoAny.concern === "string" ? dtoAny.concern : extracted.concern;
  }

  const statusProvided = typeof dtoAny.status === "string";

  return {
    startTimeFromDto,
    endTimeFromDto,
    durationMinutesFromDto,
    statusProvided,
    concernProvided,
    nextConcern,
    startTimeProvided: startTimeFromDto != null,
  };
};

const resolvePmsAppointmentEventType = (args: {
  rescheduled: boolean;
  concernChanged: boolean;
  emergencyChanged: boolean;
  nextStatus: AppointmentStatus;
  previousStatus: LegacyAppointmentStatus;
}):
  | "APPOINTMENT_RESCHEDULED"
  | "APPOINTMENT_CHECKED_IN"
  | "APPOINTMENT_APPROVED" => {
  const normalizedPrev = normalizeAppointmentStatus(args.previousStatus);
  if (args.rescheduled || args.concernChanged || args.emergencyChanged) {
    return "APPOINTMENT_RESCHEDULED";
  }
  if (args.nextStatus === "CHECKED_IN") {
    return "APPOINTMENT_CHECKED_IN";
  }
  if (args.nextStatus === "UPCOMING" && normalizedPrev === "REQUESTED") {
    return "APPOINTMENT_APPROVED";
  }
  return "APPOINTMENT_RESCHEDULED";
};

const assertPmsUpdatableStatus = (
  status: LegacyAppointmentStatus,
  context: string,
) => {
  const allowedStatuses: AppointmentStatus[] = [
    "REQUESTED",
    "UPCOMING",
    "CHECKED_IN",
    "IN_PROGRESS",
  ];
  const normalizedStatus = normalizeAppointmentStatus(status);
  if (!allowedStatuses.includes(normalizedStatus)) {
    throw new AppointmentServiceError(
      `Appointment cannot be updated in status ${status} (${context})`,
      409,
    );
  }
};

type UpdateAppointmentPmsArgs = {
  appointmentId: string;
  extracted: AppointmentRequestInput;
  parsed: ParsedPmsAppointmentUpdate;
};

type PmsUpdatePlan = {
  sameVet: boolean;
  sameSlot: boolean;
  timesProvided: boolean;
  nextStartTime: Date;
  nextEndTime: Date;
  nextDurationMinutes: number;
  nextStatus: AppointmentStatus;
  statusChanged: boolean;
  shouldUpdateEmergency: boolean;
  nextIsEmergency: boolean;
  previousConcern?: string;
  nextConcernValue?: string;
  concernChanged: boolean;
  emergencyChanged: boolean;
  rescheduled: boolean;
};

const buildPmsUpdatePlanFromPrisma = (args: {
  appointment: {
    status: LegacyAppointmentStatus;
    lead: unknown;
    startTime: Date;
    endTime: Date;
    durationMinutes: number;
    concern: unknown;
    isEmergency: boolean;
  };
  extracted: AppointmentRequestInput;
  parsed: ParsedPmsAppointmentUpdate;
}): PmsUpdatePlan => {
  const currentLeadId =
    typeof args.appointment.lead === "object" && args.appointment.lead
      ? (args.appointment.lead as { id?: string }).id
      : undefined;
  const sameVet = currentLeadId === args.extracted.lead?.id;

  const nextStartTime =
    args.parsed.startTimeFromDto ?? args.appointment.startTime;
  const nextEndTime = args.parsed.endTimeFromDto ?? args.appointment.endTime;

  const timesProvided =
    args.parsed.startTimeFromDto !== undefined ||
    args.parsed.endTimeFromDto !== undefined;
  let sameSlot = true;
  if (timesProvided) {
    sameSlot =
      args.appointment.startTime.getTime() === nextStartTime.getTime() &&
      args.appointment.endTime.getTime() === nextEndTime.getTime();
  }

  const nextDurationMinutes =
    args.parsed.durationMinutesFromDto ??
    args.extracted.durationMinutes ??
    (args.parsed.startTimeFromDto != null && args.parsed.endTimeFromDto != null
      ? dayjs(nextEndTime).diff(dayjs(nextStartTime), "minute")
      : args.appointment.durationMinutes);

  const currentStatus = normalizeAppointmentStatus(args.appointment.status);
  const nextStatus = normalizeAppointmentStatus(
    args.parsed.statusProvided
      ? (args.extracted.status ?? args.appointment.status)
      : args.appointment.status,
  );
  const statusChanged =
    args.parsed.statusProvided && nextStatus !== currentStatus;

  const shouldUpdateEmergency = typeof args.extracted.isEmergency === "boolean";
  const nextIsEmergency = shouldUpdateEmergency
    ? (args.extracted.isEmergency as boolean)
    : args.appointment.isEmergency;

  const previousConcern =
    typeof args.appointment.concern === "string"
      ? args.appointment.concern
      : undefined;
  const nextConcernValue = args.parsed.concernProvided
    ? args.parsed.nextConcern
    : (previousConcern ?? undefined);

  const rescheduled =
    timesProvided &&
    (args.appointment.startTime.getTime() !== nextStartTime.getTime() ||
      args.appointment.endTime.getTime() !== nextEndTime.getTime());
  const concernChanged =
    args.parsed.concernProvided &&
    nextConcernValue !== (previousConcern ?? undefined);
  const emergencyChanged =
    shouldUpdateEmergency && nextIsEmergency !== args.appointment.isEmergency;

  return {
    sameVet,
    sameSlot,
    timesProvided,
    nextStartTime,
    nextEndTime,
    nextDurationMinutes,
    nextStatus,
    statusChanged,
    shouldUpdateEmergency,
    nextIsEmergency,
    previousConcern,
    nextConcernValue,
    concernChanged,
    emergencyChanged,
    rescheduled,
  };
};

const updateAppointmentPMSFromPostgresRow = async ({
  appointmentId,
  extracted,
  parsed,
}: UpdateAppointmentPmsArgs): Promise<AppointmentResponseDTO> => {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    throw new AppointmentServiceError("Appointment not found", 404);
  }

  assertPmsUpdatableStatus(appointment.status, "updateAppointmentPMS");

  const plan = buildPmsUpdatePlanFromPrisma({ appointment, extracted, parsed });
  const organisationId = appointment.organisationId;

  await prisma.$transaction(async (tx) => {
    if (!plan.sameVet || !plan.sameSlot) {
      await tx.occupancy.deleteMany({
        where: {
          organisationId,
          sourceType: "APPOINTMENT",
          referenceId: appointment.id,
        },
      });

      const overlapping = await tx.occupancy.findFirst({
        where: {
          userId: extracted.lead?.id,
          organisationId,
          startTime: { lt: plan.nextEndTime },
          endTime: { gt: plan.nextStartTime },
        },
      });

      if (overlapping) {
        throw new AppointmentServiceError(
          "Selected vet is not available for this slot",
          409,
        );
      }

      await tx.occupancy.create({
        data: {
          userId: extracted.lead?.id ?? "",
          organisationId,
          startTime: plan.nextStartTime,
          endTime: plan.nextEndTime,
          sourceType: "APPOINTMENT",
          referenceId: appointment.id,
        },
      });
    }

    if (plan.statusChanged) {
      assertAppointmentStatusTransition(
        appointment.status,
        plan.nextStatus,
        "updateAppointmentPMS",
      );
    }

    await tx.appointment.update({
      where: { id: appointment.id },
      data: {
        status: plan.nextStatus,
        lead: {
          id: extracted.lead?.id,
          name: extracted.lead?.name ?? "Vet",
        },
        supportStaff: extracted.supportStaff ?? [],
        room: extracted.room as unknown as Prisma.InputJsonValue,
        startTime: plan.nextStartTime,
        endTime: plan.nextEndTime,
        appointmentDate: parsed.startTimeProvided
          ? plan.nextStartTime
          : appointment.appointmentDate,
        timeSlot: parsed.startTimeProvided
          ? dayjs(plan.nextStartTime).format("HH:mm")
          : appointment.timeSlot,
        durationMinutes: plan.nextDurationMinutes,
        concern: plan.nextConcernValue ?? undefined,
        isEmergency: plan.nextIsEmergency ?? false,
        updatedAt: new Date(),
      },
    });
  });

  const updated = await prisma.appointment.findUnique({
    where: { id: appointment.id },
  });
  if (!updated) {
    throw new AppointmentServiceError("Appointment not found", 404);
  }

  if (
    plan.rescheduled ||
    plan.statusChanged ||
    plan.concernChanged ||
    plan.emergencyChanged
  ) {
    const appointmentDomain = toDomainFromPrisma(appointment);
    const eventType = resolvePmsAppointmentEventType({
      rescheduled: plan.rescheduled,
      concernChanged: plan.concernChanged,
      emergencyChanged: plan.emergencyChanged,
      nextStatus: plan.nextStatus,
      previousStatus: appointment.status,
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: appointmentDomain.patient.id,
      eventType,
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        source: "PMS",
        status: plan.nextStatus,
        previousStatus: appointment.status,
        startTime: plan.nextStartTime,
        endTime: plan.nextEndTime,
        concern: plan.nextConcernValue ?? undefined,
      },
    });
  }

  return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
};

const getConsentFormForParentSafe = async (
  organisationId: string,
  serviceId: string,
) => {
  try {
    const form = await prisma.form.findFirst({
      where: {
        orgId: organisationId,
        status: "published",
        visibilityType: "External",
        category: "Consent",
        ...(serviceId ? { serviceId: { has: serviceId } } : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!form) {
      return null;
    }

    const version = await prisma.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { version: "desc" },
    });

    if (!version) {
      return null;
    }

    return { id: form.id };
  } catch (err) {
    if (err instanceof FormServiceError && err.statusCode === 404) {
      return null; // expected case
    }
    throw err; // real error
  }
};

const sendCheckoutEmailIfNeeded = async ({
  checkout,
  invoice,
  appointment,
  organisationName,
}: {
  checkout?: { url?: string | null };
  invoice: { totalAmount?: number; currency: string };
  appointment: Appointment;
  organisationName?: string | null;
}) => {
  if (!checkout?.url) return;

  const parent = await prisma.parent.findUnique({
    where: { id: appointment.patient.parent.id },
    select: { email: true, firstName: true, lastName: true },
  });
  if (!parent?.email) return;

  let recipientEmail: string;
  try {
    recipientEmail = assertEmail(parent.email);
  } catch (error) {
    logger.error("Skipping checkout email for invalid parent email.", error);
    return;
  }

  const parentName = [parent.firstName, parent.lastName]
    .filter(Boolean)
    .join(" ");
  const amountText =
    typeof invoice.totalAmount === "number"
      ? `${invoice.currency.toUpperCase()} ${invoice.totalAmount.toFixed(2)}`
      : undefined;
  const appointmentTime = dayjs(appointment.startTime).format(
    "MMM D, YYYY h:mm A",
  );

  try {
    await sendEmailTemplate({
      to: recipientEmail,
      templateId: "appointmentPaymentCheckout",
      templateData: {
        parentName: parentName || undefined,
        companionName: appointment.patient.name,
        organisationName: organisationName ?? undefined,
        appointmentTime,
        amountText,
        checkoutUrl: checkout.url,
        ctaUrl: checkout.url,
        ctaLabel: "Pay Now",
        supportEmail: SUPPORT_EMAIL_ADDRESS,
      },
    });
  } catch (error) {
    logger.error("Failed to send appointment checkout email.", error);
  }
};

const recordFormAttachmentAudit = async (
  appointment: Appointment,
  appointmentId: string,
) => {
  if (!appointment.formIds?.length) return;

  for (const formId of appointment.formIds) {
    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      patientId: appointment.patient.id,
      eventType: "FORM_ATTACHED",
      actorType: "SYSTEM",
      entityType: "FORM",
      entityId: formId,
      metadata: {
        appointmentId,
      },
    });
  }
};

const resolveObservationToolId = (value: unknown) => {
  if (typeof value === "string" && value) return value;
  return undefined;
};

const maybeCreateObservationToolTask = async (
  service: { serviceType?: string; observationToolId?: unknown },
  appointment: Appointment,
  appointmentId: string,
) => {
  if (service.serviceType !== "OBSERVATION_TOOL") return;
  const observationToolId = resolveObservationToolId(service.observationToolId);
  if (!observationToolId) return;

  await createObservationToolTaskForAppointment({
    appointmentId,
    organisationId: appointment.organisationId,
    patientId: appointment.patient.id,
    parentId: appointment.patient.parent.id,
    observationToolId,
    appointmentStartTime: appointment.startTime,
  });
};

const ensureOrgUsageCounters = async (orgId: string) =>
  prisma.organizationUsageCounter.upsert({
    where: { orgId },
    create: { orgId },
    update: {},
  });

const rollbackCreatedPmsAppointment = async (params: {
  appointmentId?: string;
  invoiceId?: string;
  organisationId: string;
  leadId?: string;
}) => {
  if (params.invoiceId) {
    try {
      await InvoiceService.updateStatus(params.invoiceId, "CANCELLED");
    } catch (error) {
      logger.error("Failed to cancel PMS invoice after rollback.", error);
    }
  }

  if (params.appointmentId) {
    await prisma.occupancy.deleteMany({
      where: {
        organisationId: params.organisationId,
        referenceId: params.appointmentId,
        ...(params.leadId ? { userId: params.leadId } : {}),
      },
    });

    await prisma.appointment.deleteMany({
      where: { id: params.appointmentId },
    });
  }
};

const isFreePlan = async (orgId: string) => {
  const billing = await prisma.organizationBilling.findUnique({
    where: { orgId },
    select: { plan: true },
  });
  return !billing || billing.plan === "free";
};

const SUPPORT_EMAIL_ADDRESS =
  process.env.SUPPORT_EMAIL ??
  process.env.SUPPORT_EMAIL_ADDRESS ??
  process.env.HELP_EMAIL ??
  "support@yosemitecrew.com";
const DEFAULT_PMS_URL =
  process.env.PMS_BASE_URL ??
  process.env.FRONTEND_BASE_URL ??
  process.env.APP_URL ??
  "https://app.yosemitecrew.com";

const buildDisplayName = (user?: { firstName?: string; lastName?: string }) => {
  if (!user) return undefined;
  const parts = [user.firstName, user.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : undefined;
};

const getOrganisationName = async (
  organisationId?: string,
): Promise<string | undefined> => {
  if (!organisationId) return undefined;
  const organisation = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { name: true },
  });
  return organisation?.name ?? undefined;
};

const getOrganisationType = async (
  organisationId?: string,
): Promise<"HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER" | undefined> => {
  if (!organisationId) return undefined;
  const organisation = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { type: true },
  });
  return organisation?.type ?? undefined;
};

const linkPatientToOrganisationFromMobile = async (params: {
  parentId: string;
  patientId: string;
  organisationId: string;
}) => {
  const organisationType = await getOrganisationType(params.organisationId);

  if (!organisationType) {
    throw new AppointmentServiceError(
      "Unable to resolve organisation type for appointment booking.",
      404,
    );
  }

  await CompanionOrganisationService.linkByParent({
    parentId: params.parentId,
    patientId: params.patientId,
    organisationId: params.organisationId,
    organisationType,
  });
};

const sendAppointmentAssignmentEmails = async (
  appointment: Appointment,
  organisationName?: string,
) => {
  try {
    const staff = [
      appointment.lead
        ? { id: appointment.lead.id, name: appointment.lead.name }
        : undefined,
      ...(appointment.supportStaff ?? []).map((member) => ({
        id: member.id,
        name: member.name,
      })),
    ].filter(Boolean) as Array<{ id: string; name?: string }>;

    if (!staff.length) return;

    const staffIds = [...new Set(staff.map((member) => member.id))];
    const users = await prisma.user.findMany({
      where: { userId: { in: staffIds } },
      select: {
        userId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });

    const userById = new Map(users.map((user) => [user.userId, user]));
    const nameById = new Map(staff.map((member) => [member.id, member.name]));
    const appointmentTime = dayjs(appointment.startTime).format(
      "MMM D, YYYY h:mm A",
    );

    await Promise.all(
      staffIds.map(async (userId) => {
        const user = userById.get(userId);
        const email = user?.email;
        if (!email) return;

        const employeeName =
          buildDisplayName({
            firstName: user?.firstName ?? undefined,
            lastName: user?.lastName ?? undefined,
          }) ??
          nameById.get(userId) ??
          undefined;

        try {
          await sendEmailTemplate({
            to: email,
            templateId: "appointmentAssigned",
            templateData: {
              employeeName,
              companionName: appointment.patient.name,
              appointmentType: appointment.appointmentType?.name,
              appointmentTime,
              organisationName,
              locationName: appointment.room?.name,
              ctaUrl: DEFAULT_PMS_URL,
              ctaLabel: "Open PMS",
              supportEmail: SUPPORT_EMAIL_ADDRESS,
            },
          });
        } catch (error) {
          logger.error("Failed to send appointment assignment email.", error);
        }
      }),
    );
  } catch (error) {
    logger.error("Failed to prepare appointment assignment emails.", error);
  }
};

type AppointmentUsageIncrement = {
  appointmentsUsed: number;
  toolsUsed?: number;
};

const reserveAppointmentUsage = async (
  orgId: string,
  isObservationTool: boolean,
) => {
  await ensureOrgUsageCounters(orgId);

  const inc: AppointmentUsageIncrement = { appointmentsUsed: 1 };
  if (isObservationTool) {
    inc.toolsUsed = 1;
  }

  if (await isFreePlan(orgId)) {
    const updated = await prisma.$transaction(
      async (tx) => {
        const current = await tx.organizationUsageCounter.findUnique({
          where: { orgId },
        });
        if (!current) {
          throw new AppointmentServiceError("Usage counter missing", 500);
        }

        const toolsLimitReached =
          isObservationTool &&
          (current.toolsUsed ?? 0) >= (current.freeToolsLimit ?? 0);
        const appointmentsLimitReached =
          (current.appointmentsUsed ?? 0) >=
          (current.freeAppointmentsLimit ?? 0);

        if (toolsLimitReached || appointmentsLimitReached) {
          const message = toolsLimitReached
            ? "Free plan observation tool appointment limit reached."
            : "Free plan appointment limit reached.";
          throw new AppointmentServiceError(message, 403);
        }

        return tx.organizationUsageCounter.update({
          where: { orgId },
          data: {
            appointmentsUsed: { increment: 1 },
            toolsUsed: isObservationTool ? { increment: 1 } : undefined,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    const didReachLimit = await markFreeLimitReachedAt(updated, (counters) => ({
      orgId: counters.orgId,
    }));
    if (didReachLimit) {
      void sendFreePlanLimitReachedEmail({
        orgId,
        usage: updated,
      });
    }

    return { orgId, inc };
  }

  await prisma.organizationUsageCounter.update({
    where: { orgId },
    data: {
      appointmentsUsed: { increment: 1 },
      toolsUsed: isObservationTool ? { increment: 1 } : undefined,
    },
  });

  return { orgId, inc };
};

const releaseAppointmentUsage = async (reservation: {
  orgId: string;
  inc: AppointmentUsageIncrement;
}) => {
  const data: Prisma.OrganizationUsageCounterUpdateInput = {};
  if (typeof reservation.inc.appointmentsUsed === "number") {
    data.appointmentsUsed = {
      decrement: reservation.inc.appointmentsUsed,
    };
  }
  if (typeof reservation.inc.toolsUsed === "number") {
    data.toolsUsed = { decrement: reservation.inc.toolsUsed };
  }
  await prisma.organizationUsageCounter.update({
    where: { orgId: reservation.orgId },
    data,
  });
};

const buildAppointmentDomain = (input: {
  id?: string;
  patient: Appointment["patient"];
  companion?: NonNullable<Appointment["companion"]>;
  lead?: NonNullable<Appointment["lead"]>;
  supportStaff?: NonNullable<Appointment["supportStaff"]>;
  room?: NonNullable<Appointment["room"]>;
  appointmentType?: NonNullable<Appointment["appointmentType"]>;
  organisationId: string;
  appointmentDate: Date;
  startTime: Date;
  timeSlot: string;
  durationMinutes: number;
  endTime: Date;
  status: LegacyAppointmentStatus;
  isEmergency?: boolean;
  concern?: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments?: NonNullable<Appointment["attachments"]>;
  formIds?: string[];
}): Appointment => ({
  id: input.id,
  patient: input.patient,
  companion: input.companion ?? input.patient,
  lead: input.lead ?? undefined,
  supportStaff: input.supportStaff ?? [],
  room: input.room ?? undefined,
  appointmentType: input.appointmentType ?? undefined,
  organisationId: input.organisationId,
  appointmentDate: input.appointmentDate,
  startTime: input.startTime,
  timeSlot: input.timeSlot,
  durationMinutes: input.durationMinutes,
  endTime: input.endTime,
  status: normalizeAppointmentStatus(input.status),
  isEmergency: input.isEmergency ?? undefined,
  concern: input.concern ?? undefined,
  createdAt: input.createdAt,
  updatedAt: input.updatedAt,
  attachments: input.attachments,
  formIds: input.formIds ?? [],
});

const toDomainFromPrisma = (row: {
  id: string;
  patient: unknown;
  lead: unknown;
  supportStaff: unknown;
  room: unknown;
  appointmentType: unknown;
  organisationId: string;
  appointmentDate: Date;
  startTime: Date;
  timeSlot: string;
  durationMinutes: number;
  endTime: Date;
  status: AppointmentStatus;
  isEmergency: boolean;
  concern: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: unknown;
  formIds: string[];
}): Appointment =>
  buildAppointmentDomain({
    id: row.id,
    patient: row.patient as Appointment["patient"],
    lead: (row.lead ?? undefined) as Appointment["lead"] | undefined,
    supportStaff: (row.supportStaff ?? []) as Appointment["supportStaff"],
    room: (row.room ?? undefined) as Appointment["room"] | undefined,
    appointmentType: (row.appointmentType ?? undefined) as
      Appointment["appointmentType"] | undefined,
    organisationId: row.organisationId,
    appointmentDate: row.appointmentDate,
    startTime: row.startTime,
    timeSlot: row.timeSlot,
    durationMinutes: row.durationMinutes,
    endTime: row.endTime,
    status: row.status,
    isEmergency: row.isEmergency ?? undefined,
    concern: row.concern ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    attachments: (row.attachments ?? undefined) as
      Appointment["attachments"] | undefined,
    formIds: row.formIds ?? [],
  });

const buildAppointmentFromInput = (
  input: AppointmentRequestInput,
  status: AppointmentStatus,
  overrides?: Partial<Pick<Appointment, "lead" | "supportStaff" | "room">>,
): Appointment => ({
  id: undefined,
  organisationId: input.organisationId,
  patient: input.patient,
  companion: input.patient,
  appointmentType: input.appointmentType,
  appointmentDate: input.startTime,
  startTime: input.startTime,
  endTime: input.endTime,
  timeSlot: dayjs(input.startTime).format("HH:mm"),
  durationMinutes: input.durationMinutes,
  status,
  concern: input.concern,
  isEmergency: input.isEmergency,
  lead: overrides?.lead,
  supportStaff: overrides?.supportStaff ?? [],
  room: overrides?.room ?? undefined,
  attachments: input.attachments,
  formIds: input.formIds ?? [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Batch-load the inpatient ward/unit for a set of appointment rows so the
// appointments list can show "Room / Unit" without opening the workspace. The
// link is Appointment.encounterId -> Encounter.admission -> RoomUnit.
const buildInpatientUnitMapForAppointments = async (
  rows: Array<{ id: string }>,
): Promise<Map<string, { id: string; displayName: string; code: string }>> => {
  const encounterIds = Array.from(
    new Set(
      rows
        .map((row) => (row as { encounterId?: string | null }).encounterId)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const unitByEncounter = new Map<
    string,
    { id: string; displayName: string; code: string }
  >();
  if (encounterIds.length === 0) {
    return unitByEncounter;
  }
  const admissions = await prisma.admission.findMany({
    where: { encounterId: { in: encounterIds } },
    select: {
      encounterId: true,
      currentUnit: { select: { id: true, displayName: true, code: true } },
    },
  });
  for (const admission of admissions) {
    if (admission.currentUnit) {
      unitByEncounter.set(admission.encounterId, admission.currentUnit);
    }
  }
  return unitByEncounter;
};

const mapAppointmentsFromPrisma = async (
  rows: Array<{ id: string }>,
): Promise<AppointmentResponseDTO[]> => {
  const [paymentStatusMap, unitByEncounter] = await Promise.all([
    buildPaymentStatusMapForAppointments(rows.map((row) => row.id)),
    buildInpatientUnitMapForAppointments(rows),
  ]);

  return rows.map((row) => {
    const domain = attachPaymentStatus(
      toDomainFromPrisma(
        row as unknown as Parameters<typeof toDomainFromPrisma>[0],
      ),
      paymentStatusMap.get(row.id) ?? "UNPAID",
    );
    const encounterId = (row as { encounterId?: string | null }).encounterId;
    const unit = encounterId ? unitByEncounter.get(encounterId) : undefined;
    const withUnit =
      unit && domain.room
        ? {
            ...domain,
            room: {
              ...domain.room,
              unitId: unit.id,
              unitName: unit.displayName,
              unit: {
                id: unit.id,
                name: unit.displayName,
                displayName: unit.displayName,
                code: unit.code,
              },
            },
          }
        : domain;
    return toAppointmentResponseDTO(withUnit);
  });
};

export const attachPaymentStatus = (
  appointment: Appointment,
  paymentStatus: AppointmentPaymentStatus | undefined,
): Appointment => {
  if (paymentStatus) {
    appointment.paymentStatus = paymentStatus;
  }
  return appointment;
};

export const buildPaymentStatusMapForAppointments = async (
  appointmentIds: string[],
): Promise<Map<string, AppointmentPaymentStatus>> =>
  resolvePaymentStatusByAppointmentIds(appointmentIds);

export const resolvePaymentStatusForAppointment = async (
  appointmentId: string,
): Promise<AppointmentPaymentStatus> => {
  const map = await resolvePaymentStatusByAppointmentIds([appointmentId]);
  return map.get(appointmentId) ?? "UNPAID";
};

const toAppointmentResponseDTOWithPaymentStatusFromPrisma = async (row: {
  id: string;
  patient: Prisma.JsonValue;
  lead: Prisma.JsonValue | null;
  supportStaff: Prisma.JsonValue | null;
  room: Prisma.JsonValue | null;
  appointmentType: Prisma.JsonValue | null;
  organisationId: string;
  appointmentDate: Date;
  startTime: Date;
  timeSlot: string;
  durationMinutes: number;
  endTime: Date;
  status: AppointmentStatus;
  isEmergency: boolean;
  concern: string | null;
  createdAt: Date;
  updatedAt: Date;
  attachments: Prisma.JsonValue | null;
  formIds: string[];
}): Promise<AppointmentResponseDTO> => {
  const paymentStatus = await resolvePaymentStatusForAppointment(row.id);
  const domain = attachPaymentStatus(toDomainFromPrisma(row), paymentStatus);
  return toAppointmentResponseDTO(domain);
};

function extractApprovalFieldsFromFHIR(dto: AppointmentRequestDTO) {
  const leadParticipant = dto.participant?.find((p) =>
    p.type?.some((t) => t.coding?.some((c) => c.code === "PPRF")),
  );

  const supportStaff = dto.participant
    ?.filter((p) =>
      p.type?.some((t) => t.coding?.some((c) => c.code === "SPRF")),
    )
    .map((p) => ({
      id: p.actor?.reference?.split("/")[1] ?? "",
      name: p.actor?.display ?? "",
    }));

  const roomParticipant = dto.participant?.find((p) =>
    p.type?.some((t) => t.coding?.some((c) => c.code === "LOC")),
  );

  return {
    leadVetId: leadParticipant?.actor?.reference?.split("/")[1],
    leadVetName: leadParticipant?.actor?.display,

    supportStaff,
    room: roomParticipant
      ? {
          id: roomParticipant.actor?.reference?.split("/")[1] ?? "",
          name: roomParticipant.actor?.display ?? "",
        }
      : undefined,
  };
}

export const AppointmentService = {
  // Request an appointment from Parent

  async createRequestedFromMobile(dto: AppointmentRequestDTO) {
    const input = fromAppointmentRequestDTO(dto);

    validateRequestedFromMobileInput(input);

    const selectionId = input.appointmentType?.id;
    if (!selectionId) {
      throw new AppointmentServiceError("serviceId is required", 400);
    }
    const { catalogSelection, service } =
      await resolveBookableOutpatientSelection(
        selectionId,
        input.organisationId,
        "Invalid service selected",
      );

    const usageReservation = await reserveAppointmentUsage(
      input.organisationId,
      service?.serviceType === "OBSERVATION_TOOL",
    );

    const consentForm = service
      ? await getConsentFormForParentSafe(input.organisationId, service.id)
      : null;

    if (consentForm?.id) {
      input.formIds?.push(consentForm.id);
    }

    const appointment = buildAppointmentFromInput(input, "REQUESTED");
    await linkPatientToOrganisationFromMobile({
      parentId: appointment.patient.parent.id,
      patientId: appointment.patient.id,
      organisationId: appointment.organisationId,
    });

    let created;
    try {
      created = await prisma.appointment.create({
        data: {
          patient: appointment.patient,
          lead: appointment.lead as unknown as Prisma.InputJsonValue,
          supportStaff: appointment.supportStaff ?? [],
          room: appointment.room as unknown as Prisma.InputJsonValue,
          appointmentType:
            appointment.appointmentType as unknown as Prisma.InputJsonValue,
          productItemId: catalogSelection?.productItemId ?? undefined,
          organisationId: appointment.organisationId,
          appointmentDate: appointment.appointmentDate,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          timeSlot: appointment.timeSlot,
          durationMinutes: appointment.durationMinutes,
          status: appointment.status,
          isEmergency: appointment.isEmergency ?? false,
          concern: appointment.concern ?? undefined,
          attachments: (appointment.attachments ??
            undefined) as unknown as Prisma.InputJsonValue,
          formIds: appointment.formIds ?? [],
          expiresAt: undefined,
        },
      });
    } catch (error) {
      await releaseAppointmentUsage(usageReservation);
      throw error;
    }

    await AuditTrailService.recordSafely({
      organisationId: appointment.organisationId,
      patientId: appointment.patient.id,
      eventType: "APPOINTMENT_REQUESTED",
      actorType: "PARENT",
      actorId: appointment.patient.parent.id,
      entityType: "APPOINTMENT",
      entityId: created.id,
      metadata: {
        status: created.status,
        formIds: appointment.formIds ?? [],
      },
    });

    await recordFormAttachmentAudit(appointment, created.id);

    const invoice = await InvoiceService.getOrCreateDraftForAppointment({
      appointmentId: created.id,
      parentId: appointment.patient.parent.id,
      patientId: appointment.patient.id,
      organisationId: appointment.organisationId,
      items: catalogSelection
        ? mapCatalogSelectionToDraftItems(catalogSelection)
        : mapLegacyServiceToDraftItems(
            service as LegacyServiceBridge,
            appointment.appointmentType?.name,
          ),
      notes: appointment.concern ?? undefined,
      paymentCollectionMethod: "PAYMENT_INTENT",
    });

    const invoiceId =
      typeof (invoice as { id?: string }).id === "string"
        ? (invoice as { id: string }).id
        : undefined;

    if (invoiceId) {
      await InvoiceService.setInvoiceDepositTarget(
        invoiceId,
        invoice.totalAmount,
      );
    }

    const paymentIntent = invoiceId
      ? await StripeService.createPaymentIntentForInvoice(invoiceId, {
          organisationId: appointment.organisationId,
        })
      : undefined;

    if (service) {
      await maybeCreateObservationToolTask(service, appointment, created.id);
    }

    return {
      appointment:
        await toAppointmentResponseDTOWithPaymentStatusFromPrisma(created),
      invoice,
      paymentIntent,
    };
  },

  // Create an appointment from PMS with paynow and paylater

  async createAppointmentFromPms(
    dto: AppointmentRequestDTO,
    createPayment: boolean,
    paymentCollectionMethod?: string,
  ) {
    const input = fromAppointmentRequestDTO(dto);

    // 1️⃣ Validate required fields
    validateAppointmentFromPmsInput(input);

    const resolvedPaymentCollectionMethod =
      resolvePaymentCollectionMethod(paymentCollectionMethod, (message) => {
        return new AppointmentServiceError(message, 400);
      }) ?? "PAYMENT_LINK";

    if (
      resolvedPaymentCollectionMethod === "PAYMENT_AT_CLINIC" &&
      createPayment
    ) {
      throw new AppointmentServiceError(
        "Cannot create online payment for in-clinic collection.",
        400,
      );
    }

    const { catalogSelection, service } =
      await resolveBookableOutpatientSelection(
        input.appointmentType!.id,
        input.organisationId,
        "Invalid or inactive service for this organisation.",
      );

    const usageReservation = await reserveAppointmentUsage(
      input.organisationId,
      service?.serviceType === "OBSERVATION_TOOL",
    );

    const consentForm = service
      ? await getConsentFormForParentSafe(input.organisationId, service.id)
      : null;

    if (consentForm?.id) {
      input.formIds?.push(consentForm.id);
    }

    const appointment = buildAppointmentFromInput(input, "UPCOMING", {
      lead: input.lead,
      supportStaff: input.supportStaff ?? [],
      room: input.room ?? undefined,
    });

    let appointmentRowId: string | undefined;
    let invoiceId: string | undefined;

    try {
      const appointmentRow = await prisma.$transaction(async (tx) => {
        const overlapping = await tx.occupancy.findFirst({
          where: {
            organisationId: appointment.organisationId,
            userId: appointment.lead!.id,
            startTime: { lt: appointment.endTime },
            endTime: { gt: appointment.startTime },
          },
        });

        if (overlapping) {
          throw new AppointmentServiceError(
            "Selected vet is not available for this time slot.",
            409,
          );
        }

        const created = await tx.appointment.create({
          data: {
            patient: appointment.patient,
            lead: appointment.lead,
            supportStaff: appointment.supportStaff ?? [],
            room: appointment.room,
            appointmentType: appointment.appointmentType,
            productItemId: catalogSelection?.productItemId ?? undefined,
            organisationId: appointment.organisationId,
            appointmentDate: appointment.appointmentDate,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            timeSlot: appointment.timeSlot,
            durationMinutes: appointment.durationMinutes,
            status: appointment.status,
            isEmergency: appointment.isEmergency ?? false,
            concern: appointment.concern ?? undefined,
            attachments: appointment.attachments ?? undefined,
            formIds: appointment.formIds ?? [],
            expiresAt: undefined,
          },
        });

        await tx.occupancy.create({
          data: {
            userId: appointment.lead!.id,
            organisationId: appointment.organisationId,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            sourceType: "APPOINTMENT",
            referenceId: created.id,
          },
        });

        return created;
      });
      appointmentRowId = appointmentRow.id;

      const invoice = await InvoiceService.createDraftForAppointment({
        appointmentId: appointmentRow.id,
        parentId: appointment.patient.parent.id,
        patientId: appointment.patient.id,
        organisationId: appointment.organisationId,
        items: catalogSelection
          ? mapCatalogSelectionToDraftItems(catalogSelection)
          : mapLegacyServiceToDraftItems(
              service as LegacyServiceBridge,
              appointment.appointmentType?.name,
            ),
        notes: appointment.concern,
        paymentCollectionMethod: resolvedPaymentCollectionMethod,
      });

      invoiceId =
        typeof (invoice as { id?: string }).id === "string"
          ? (invoice as { id: string }).id
          : undefined;

      let checkout;

      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        patientId: appointment.patient.id,
        eventType: "APPOINTMENT_CREATED",
        actorType: "SYSTEM",
        entityType: "APPOINTMENT",
        entityId: appointmentRow.id,
        metadata: {
          status: appointmentRow.status,
          formIds: appointment.formIds ?? [],
        },
      });

      await recordFormAttachmentAudit(appointment, appointmentRow.id);

      if (createPayment === true) {
        if (invoiceId) {
          checkout =
            await StripeService.createCheckoutSessionForInvoice(invoiceId);
        }
      }

      if (service) {
        await maybeCreateObservationToolTask(
          service,
          appointment,
          appointmentRow.id,
        );
      }

      const notificationPayload = NotificationTemplates.Appointment.APPROVED(
        appointment.patient.name,
        appointment.startTime.toDateString(),
      );

      await NotificationService.sendToUser(
        appointment.patient.parent.id,
        notificationPayload,
      );

      const organisationName = await getOrganisationName(
        appointment.organisationId,
      );
      await sendAppointmentAssignmentEmails(appointment, organisationName);

      await sendCheckoutEmailIfNeeded({
        checkout,
        invoice,
        appointment,
        organisationName,
      });

      return {
        appointment:
          await toAppointmentResponseDTOWithPaymentStatusFromPrisma(
            appointmentRow,
          ),
        invoice,
        checkout,
      };
    } catch (err) {
      await rollbackCreatedPmsAppointment({
        appointmentId: appointmentRowId,
        invoiceId,
        organisationId: appointment.organisationId,
        leadId: appointment.lead?.id,
      });
      await releaseAppointmentUsage(usageReservation);
      if (err instanceof AppointmentServiceError) throw err;
      throw new AppointmentServiceError("Unable to create appointment", 500);
    }
  },

  // Aprprove Appointment from PMS (REUQUESTED -> UPCOMING)

  async approveRequestedFromPms(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentServiceError("Appointment ID missing", 400);
    }

    const extracted = extractApprovalFieldsFromFHIR(dto);

    if (!extracted.leadVetId) {
      throw new AppointmentServiceError(
        "Lead vet (Practitioner with code=PPRF) is required",
        400,
      );
    }
    const leadVetId = extracted.leadVetId;

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new AppointmentServiceError(
        "Requested appointment not found or already processed",
        404,
      );
    }

    assertRequestedAppointment(appointment.status, "approveRequestedFromPms");

    const overlapping = await prisma.occupancy.findFirst({
      where: {
        userId: extracted.leadVetId,
        organisationId: appointment.organisationId,
        startTime: { lt: appointment.endTime },
        endTime: { gt: appointment.startTime },
      },
    });

    if (overlapping) {
      throw new AppointmentServiceError(
        "Selected vet is not available for this slot",
        409,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.occupancy.create({
        data: {
          userId: leadVetId,
          organisationId: appointment.organisationId,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          sourceType: "APPOINTMENT",
          referenceId: appointment.id,
        },
      });

      const leadProfile = await tx.userProfile.findFirst({
        where: { userId: leadVetId },
        select: { personalDetails: true },
      });
      const profileUrl =
        typeof leadProfile?.personalDetails === "object" &&
        leadProfile.personalDetails &&
        "profilePictureUrl" in leadProfile.personalDetails
          ? String(
              (leadProfile.personalDetails as Record<string, unknown>)
                .profilePictureUrl,
            )
          : `https://ui-avatars.com/api/?name=${extracted.leadVetName}`;

      return tx.appointment.update({
        where: { id: appointment.id },
        data: {
          lead: {
            id: leadVetId,
            name: extracted.leadVetName ?? "Vet",
            profileUrl,
          },
          supportStaff: extracted.supportStaff ?? [],
          room: extracted.room as unknown as Prisma.InputJsonValue,
          status: "UPCOMING",
          updatedAt: new Date(),
        },
      });
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: (updated.patient as { id: string }).id,
      eventType: "APPOINTMENT_APPROVED",
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        status: updated.status,
      },
    });

    const appointmentDomain = toDomainFromPrisma(updated);
    const notificationPayload = NotificationTemplates.Appointment.APPROVED(
      appointmentDomain.patient.name,
      appointmentDomain.startTime.toDateString(),
    );

    const parentId = appointmentDomain.patient.parent.id;
    await NotificationService.sendToUser(parentId, notificationPayload);

    const organisationName = await getOrganisationName(
      appointmentDomain.organisationId,
    );
    await sendAppointmentAssignmentEmails(appointmentDomain, organisationName);

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  // Cancel appointment from PMS or Mobile

  async cancelAppointment(appointmentId: string, reason?: string) {
    const appointment = (await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })) as ParentCancelableAppointment | null;
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    if (appointment.status === "CANCELLED") {
      return toAppointmentResponseDTOWithPaymentStatusFromPrisma(appointment);
    }

    await InvoiceService.handleAppointmentCancellation(
      appointmentId,
      reason ?? "Cancelled",
    );

    assertAppointmentStatusTransition(
      appointment.status,
      "CANCELLED",
      "cancelAppointment",
    );

    const updated = (await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        status: "CANCELLED",
        concern: reason ?? appointment.concern ?? undefined,
        updatedAt: new Date(),
      },
    })) as ParentCancelableAppointment;

    const leadId = getNestedId(appointment.lead);
    if (leadId) {
      await prisma.occupancy.deleteMany({
        where: {
          organisationId: appointment.organisationId,
          userId: leadId,
          referenceId: appointment.id,
        },
      });
    }

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: (updated.patient as { id: string }).id,
      eventType: "APPOINTMENT_CANCELLED",
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        reason: updated.concern ?? reason,
      },
    });

    const appointmentDomain = toDomainFromPrisma(updated);
    const notificationPayload = NotificationTemplates.Appointment.CANCELLED(
      appointmentDomain.patient.name,
    );
    const parentId = appointmentDomain.patient.parent.id;
    await NotificationService.sendToUser(parentId, notificationPayload);

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  async cancelAppointmentFromParent(
    appointmentId: string,
    parentId: string,
    reason: string,
  ) {
    const appointment = (await prisma.appointment.findUnique({
      where: { id: appointmentId },
    })) as ParentCancelableAppointment | null;
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }
    assertParentCanCancelAppointment({
      appointment,
      parentId,
      context: "cancelAppointmentFromParent",
    });

    return cancelAppointmentFromParentPrisma({
      appointment,
      parentId,
      reason: reason ?? "Cancelled",
    });
  },

  // PMS Rejects appointment request

  async rejectRequestedAppointment(appointmentId: string, reason?: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found.", 404);
    }

    const normalizedStatus = normalizeAppointmentStatus(appointment.status);
    if (normalizedStatus !== "REQUESTED") {
      throw new AppointmentServiceError(
        "Only REQUESTED appointments can be rejected.",
        400,
      );
    }
    assertAppointmentStatusTransition(
      appointment.status,
      "CANCELLED",
      "rejectRequestedAppointment",
    );

    const rejectReason = reason || "Rejected by organisation";

    await InvoiceService.handleAppointmentCancellation(
      appointmentId,
      rejectReason,
    );

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        status: "CANCELLED",
        concern: rejectReason,
        updatedAt: new Date(),
      },
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: (updated.patient as { id: string }).id,
      eventType: "APPOINTMENT_CANCELLED",
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        reason: rejectReason,
      },
    });

    const appointmentDomain = toDomainFromPrisma(updated);
    const notificationPayload = NotificationTemplates.Appointment.CANCELLED(
      appointmentDomain.patient.name,
    );

    const parentId = appointmentDomain.patient.parent.id;
    await NotificationService.sendToUser(parentId, notificationPayload);

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  // Update appointment from PMS

  async updateAppointmentPMS(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentServiceError(
        "Appointment ID missing in FHIR payload",
        400,
      );
    }

    const extracted = fromAppointmentRequestDTO(dto);
    const parsed = parsePmsAppointmentUpdate(dto, extracted);

    if (extracted.status === "CANCELLED") {
      return this.cancelAppointment(appointmentId, extracted.concern);
    }

    if (!extracted.lead?.id) {
      throw new AppointmentServiceError(
        "Lead vet (Practitioner with code=PPRF) is required",
        400,
      );
    }

    return updateAppointmentPMSFromPostgresRow({
      appointmentId,
      extracted,
      parsed,
    });
  },

  async attachFormsToAppointment(
    organisationId: string,
    appointmentId: string,
    formIds: string[],
  ): Promise<AppointmentResponseDTO> {
    if (!organisationId) {
      throw new AppointmentServiceError("Organisation ID is required", 400);
    }

    if (!appointmentId) {
      throw new AppointmentServiceError("Appointment ID is required", 400);
    }

    if (!Array.isArray(formIds) || formIds.length === 0) {
      throw new AppointmentServiceError("formIds are required", 400);
    }

    const uniqueFormIds = Array.from(
      new Set(formIds.map((id) => id?.trim()).filter(Boolean)),
    );

    if (uniqueFormIds.length === 0) {
      throw new AppointmentServiceError("formIds are required", 400);
    }

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }
    if (appointment.organisationId !== organisationId) {
      throw new AppointmentServiceError(
        "Appointment does not belong to organisation",
        403,
      );
    }

    const forms = await prisma.form.findMany({
      where: {
        id: { in: uniqueFormIds },
        orgId: appointment.organisationId,
      },
      select: { id: true },
    });

    const foundIds = new Set(forms.map((f) => f.id));
    const missing = uniqueFormIds.filter((id) => !foundIds.has(id));

    if (missing.length > 0) {
      throw new AppointmentServiceError(
        `Forms not found: ${missing.join(", ")}`,
        404,
      );
    }

    const existingIds = new Set((appointment.formIds ?? []).map(String));
    const newIds = uniqueFormIds.filter((id) => !existingIds.has(id));

    if (newIds.length === 0) {
      return toAppointmentResponseDTOWithPaymentStatusFromPrisma(appointment);
    }

    const merged = Array.from(
      new Set([...(appointment.formIds ?? []), ...newIds]),
    );

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: {
        formIds: merged,
        updatedAt: new Date(),
      },
    });

    for (const formId of newIds) {
      await AuditTrailService.recordSafely({
        organisationId: appointment.organisationId,
        patientId: (appointment.patient as { id: string }).id,
        eventType: "FORM_ATTACHED",
        actorType: "SYSTEM",
        entityType: "FORM",
        entityId: formId,
        metadata: {
          appointmentId: appointment.id,
        },
      });
    }

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  async checkInAppointmentParent(appointmentId: string, parentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    const appointmentDomain = toDomainFromPrisma(appointment);

    if (appointmentDomain.patient.parent.id !== parentId) {
      throw new AppointmentServiceError("Not your appointment", 403);
    }

    if (appointment.status !== "UPCOMING") {
      throw new AppointmentServiceError(
        "Only upcoming appointments can be checked in",
        400,
      );
    }

    assertAppointmentStatusTransition(
      appointment.status,
      "CHECKED_IN",
      "checkInAppointmentParent",
    );

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CHECKED_IN", updatedAt: new Date() },
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: appointmentDomain.patient.id,
      eventType: "APPOINTMENT_CHECKED_IN",
      actorType: "PARENT",
      actorId: parentId,
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        status: updated.status,
      },
    });

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  async checkInAppointment(appointmentId: string) {
    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!appointment) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    if (appointment.status !== "UPCOMING") {
      throw new AppointmentServiceError(
        "Only upcoming appointments can be checked in",
        400,
      );
    }

    assertAppointmentStatusTransition(
      appointment.status,
      "CHECKED_IN",
      "checkInAppointment",
    );

    const updated = await prisma.appointment.update({
      where: { id: appointment.id },
      data: { status: "CHECKED_IN", updatedAt: new Date() },
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: (updated.patient as { id: string }).id,
      eventType: "APPOINTMENT_CHECKED_IN",
      actorType: "SYSTEM",
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        status: updated.status,
      },
    });

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  async rescheduleFromParent(
    appointmentId: string,
    parentId: string,
    changes: {
      startTime: string | Date;
      endTime: string | Date;
      durationMinutes?: number;
      concern?: string;
      isEmergency?: boolean;
    },
  ) {
    const newStart =
      changes.startTime instanceof Date
        ? changes.startTime
        : new Date(changes.startTime);
    const newEnd =
      changes.endTime instanceof Date
        ? changes.endTime
        : new Date(changes.endTime);

    if (Number.isNaN(newStart.getTime()) || Number.isNaN(newEnd.getTime())) {
      throw new AppointmentServiceError("Invalid startTime/endTime", 400);
    }
    if (newStart >= newEnd) {
      throw new AppointmentServiceError(
        "startTime must be before endTime",
        400,
      );
    }

    const existing = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });

    if (!existing) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }

    const appointmentDomain = toDomainFromPrisma(existing);
    const existingParentId = appointmentDomain.patient.parent.id;

    if (!existingParentId || existingParentId !== parentId) {
      throw new AppointmentServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    const normalizedStatus = normalizeAppointmentStatus(existing.status);
    if (normalizedStatus === "COMPLETED" || normalizedStatus === "CANCELLED") {
      throw new AppointmentServiceError(
        "Completed or cancelled appointments cannot be rescheduled.",
        400,
      );
    }

    let newStatus = normalizedStatus;
    let leadValue = existing.lead;
    let supportStaffValue = existing.supportStaff;
    let roomValue = existing.room;

    if (normalizedStatus === "UPCOMING") {
      assertAppointmentStatusTransition(
        existing.status,
        "REQUESTED",
        "rescheduleFromParent",
      );
      newStatus = "REQUESTED";

      leadValue = null;
      supportStaffValue = [] as Prisma.JsonValue;
      roomValue = null;

      await prisma.occupancy.deleteMany({
        where: {
          referenceId: appointmentId,
          sourceType: "APPOINTMENT",
        },
      });
    }

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        startTime: newStart,
        endTime: newEnd,
        appointmentDate: newStart,
        timeSlot: dayjs(newStart).format("HH:mm"),
        durationMinutes:
          changes.durationMinutes ??
          dayjs(newEnd).diff(dayjs(newStart), "minute"),
        concern:
          typeof changes.concern === "string"
            ? changes.concern
            : (existing.concern ?? undefined),
        isEmergency:
          typeof changes.isEmergency === "boolean"
            ? changes.isEmergency
            : existing.isEmergency,
        status: newStatus,
        lead: leadValue === null ? Prisma.DbNull : leadValue,
        supportStaff:
          supportStaffValue === null ? Prisma.DbNull : supportStaffValue,
        room: roomValue === null ? Prisma.DbNull : roomValue,
        updatedAt: new Date(),
      },
    });

    await AuditTrailService.recordSafely({
      organisationId: updated.organisationId,
      patientId: appointmentDomain.patient.id,
      eventType: "APPOINTMENT_RESCHEDULED",
      actorType: "PARENT",
      actorId: parentId,
      entityType: "APPOINTMENT",
      entityId: updated.id,
      metadata: {
        status: updated.status,
        startTime: updated.startTime,
        endTime: updated.endTime,
      },
    });

    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(updated);
  },

  async getAppointmentsForCompanion(patientId: string) {
    if (!patientId) {
      throw new AppointmentServiceError("patientId is required", 400);
    }

    const rows = await prisma.appointment.findMany({
      where: {
        patient: { path: ["id"], equals: patientId },
      },
      orderBy: { startTime: "desc" },
    });

    if (!rows.length) return [];

    const orgIds = [
      ...new Set(rows.map((row) => row.organisationId).filter(Boolean)),
    ];
    const organisations = await prisma.organization.findMany({
      where: { id: { in: orgIds } },
      include: { address: true },
    });
    const orgMap = new Map(organisations.map((org) => [org.id, org]));

    const paymentStatusMap = await buildPaymentStatusMapForAppointments(
      rows.map((row) => row.id),
    );

    return rows.map((row) => {
      const domainObj = toDomainFromPrisma(row);
      const dto = toAppointmentResponseDTO(
        attachPaymentStatus(
          domainObj,
          paymentStatusMap.get(row.id) ?? "UNPAID",
        ),
      );

      const org = orgMap.get(row.organisationId) ?? null;

      return {
        appointment: dto,
        organisation: org
          ? {
              _id: org.id,
              name: org.name,
              imageURL: org.imageUrl ?? null,
              address: org.address ?? null,
              phoneNo: org.phoneNo ?? null,
              googlePlacesId: org.googlePlacesId ?? null,
              appointmentCheckInBufferMinutes:
                org.appointmentCheckInBufferMinutes ?? 5,
              appointmentCheckInRadiusMeters:
                org.appointmentCheckInRadiusMeters ?? 200,
            }
          : null,
      };
    });
  },

  async getAppointmentsForCompanionByOrganisation(
    patientId: string,
    organisationId: string,
  ) {
    if (!patientId) {
      throw new AppointmentServiceError("patientId is required", 400);
    }
    if (!organisationId) {
      throw new AppointmentServiceError("organisationId is required", 400);
    }

    const rows = await prisma.appointment.findMany({
      where: {
        organisationId,
        patient: { path: ["id"], equals: patientId },
      },
      orderBy: { startTime: "desc" },
    });

    return mapAppointmentsFromPrisma(rows);
  },

  async getById(appointmentId: string): Promise<AppointmentResponseDTO> {
    if (!appointmentId)
      throw new AppointmentServiceError("Appointment ID is required", 400);

    const row = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!row) {
      throw new AppointmentServiceError("Appointment not found", 404);
    }
    return toAppointmentResponseDTOWithPaymentStatusFromPrisma(row);
  },

  async getAppointmentsForParent(
    parentId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!parentId) {
      throw new AppointmentServiceError("parentId is required", 400);
    }

    const rows = await prisma.appointment.findMany({
      where: {
        patient: { path: ["parent", "id"], equals: parentId },
      },
      orderBy: { startTime: "desc" },
    });

    return mapAppointmentsFromPrisma(rows);
  },

  async getAppointmentsForOrganisation(
    organisationId: string,
    filters?: {
      status?: AppointmentStatus[];
      startDate?: Date;
      endDate?: Date;
    },
  ): Promise<AppointmentResponseDTO[]> {
    if (!organisationId) {
      throw new AppointmentServiceError("organisationId is required", 400);
    }

    const where: Prisma.AppointmentWhereInput = { organisationId };
    if (filters?.status?.length) {
      where.status = { in: filters.status };
    }
    if (filters?.startDate || filters?.endDate) {
      where.startTime = {
        gte: filters.startDate ?? undefined,
        lte: filters.endDate ?? undefined,
      };
    }

    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    });

    return mapAppointmentsFromPrisma(rows);
  },

  async getAppointmentsForLead(
    leadId: string,
    organisationId?: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!leadId) {
      throw new AppointmentServiceError("leadId is required", 400);
    }

    const where: Prisma.AppointmentWhereInput = {
      lead: { path: ["id"], equals: leadId },
      organisationId: organisationId ?? undefined,
    };
    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    });

    return mapAppointmentsFromPrisma(rows);
  },

  async getAppointmentsForSupportStaff(
    staffId: string,
    organisationId?: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!staffId) {
      throw new AppointmentServiceError("staffId is required", 400);
    }

    const where: Prisma.AppointmentWhereInput = {
      supportStaff: {
        array_contains: [{ id: staffId }] as unknown as Prisma.InputJsonValue,
      },
      organisationId: organisationId ?? undefined,
    };

    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    });

    return mapAppointmentsFromPrisma(rows);
  },

  async getAppointmentsByDateRange(
    organisationId: string,
    startDate: Date,
    endDate: Date,
    status?: AppointmentStatus[],
  ): Promise<AppointmentResponseDTO[]> {
    const where: Prisma.AppointmentWhereInput = {
      organisationId,
      startTime: { gte: startDate, lte: endDate },
    };
    if (status?.length) {
      where.status = { in: status };
    }

    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "asc" },
    });

    const paymentStatusMap = await buildPaymentStatusMapForAppointments(
      rows.map((row) => row.id),
    );

    return rows.map((row) => {
      const domain = attachPaymentStatus(
        toDomainFromPrisma(row),
        paymentStatusMap.get(row.id) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async searchAppointments(filter: {
    patientId?: string;
    parentId?: string;
    organisationId?: string;
    leadId?: string;
    staffId?: string;
    status?: AppointmentStatus[];
    startDate?: Date;
    endDate?: Date;
  }): Promise<AppointmentResponseDTO[]> {
    const where: Prisma.AppointmentWhereInput = {};
    const andFilters: Prisma.AppointmentWhereInput[] = [];
    if (filter.organisationId) where.organisationId = filter.organisationId;
    if (filter.status?.length) where.status = { in: filter.status };
    if (filter.startDate || filter.endDate) {
      where.startTime = {
        gte: filter.startDate ?? undefined,
        lte: filter.endDate ?? undefined,
      };
    }
    if (filter.patientId) {
      andFilters.push({
        patient: { path: ["id"], equals: filter.patientId },
      });
    }
    if (filter.parentId) {
      andFilters.push({
        patient: { path: ["parent", "id"], equals: filter.parentId },
      });
    }
    if (filter.leadId) {
      andFilters.push({
        lead: { path: ["id"], equals: filter.leadId },
      });
    }
    if (filter.staffId) {
      andFilters.push({
        supportStaff: {
          array_contains: [
            { id: filter.staffId },
          ] as unknown as Prisma.InputJsonValue,
        },
      });
    }
    if (andFilters.length) {
      where.AND = andFilters;
    }

    const rows = await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "asc" },
    });

    const paymentStatusMap = await buildPaymentStatusMapForAppointments(
      rows.map((row) => row.id),
    );

    return rows.map((row) => {
      const domain = attachPaymentStatus(
        toDomainFromPrisma(row),
        paymentStatusMap.get(row.id) ?? "UNPAID",
      );
      return toAppointmentResponseDTO(domain);
    });
  },

  async markNoShowAppointments(params?: { graceMinutes?: number }) {
    const graceMinutes = params?.graceMinutes ?? 15;

    const now = new Date();
    const cutoffTime = new Date(now.getTime() - graceMinutes * 60 * 1000);

    /**
     * We ONLY mark:
     * - UPCOMING appointments
     * - whose endTime + grace < now
     */
    const result = await prisma.appointment.updateMany({
      where: {
        status: "UPCOMING",
        endTime: { lt: cutoffTime },
      },
      data: {
        status: "NO_SHOW",
        updatedAt: new Date(),
      },
    });

    return {
      matched: result.count,
      modified: result.count,
    };
  },
};

const createObservationToolTaskForAppointment = async ({
  appointmentId,
  organisationId,
  patientId,
  parentId,
  observationToolId,
  appointmentStartTime,
}: {
  appointmentId: string;
  organisationId: string;
  patientId: string;
  parentId: string;
  observationToolId: string;
  appointmentStartTime: Date;
}) => {
  const dueAt = dayjs(appointmentStartTime).subtract(2, "hour").toDate();

  return TaskService.createCustom({
    organisationId,
    appointmentId,

    patientId,

    createdBy: parentId,
    assignedBy: parentId,
    assignedTo: parentId,

    audience: "PARENT_TASK",

    category: "Observation Tool",
    name: "Complete observation before appointment",
    description:
      "Please complete the observation tool before your scheduled appointment.",
    additionalNotes:
      "This task must be completed before the appointment for proper evaluation.",

    observationToolId,

    dueAt,
    timezone: "UTC",

    reminder: {
      enabled: true,
      offsetMinutes: 60, // remind 1 hour before task due
    },
  });
};
