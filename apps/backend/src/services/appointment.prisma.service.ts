import dayjs from "dayjs";
import { Prisma } from "@prisma/client";
import {
  Appointment as AppointmentDomain,
  AppointmentKind,
  AppointmentPaymentStatus,
  AppointmentRequestDTO,
  AppointmentResponseDTO,
  type CatalogTemplateBinding,
  fromAppointmentRequestDTO,
  toAppointmentResponseDTO,
  type TemplateKind,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { CatalogService, CatalogServiceError } from "./catalog.service";

type AppointmentStatus = AppointmentDomain["status"];

type AppointmentRow = {
  id: string;
  companion: Prisma.JsonValue;
  lead: Prisma.JsonValue | null;
  supportStaff: Prisma.JsonValue | null;
  room: Prisma.JsonValue | null;
  appointmentType: Prisma.JsonValue | null;
  appointmentKind: AppointmentKind;
  caseId: string | null;
  encounterId: string | null;
  productItemId: string | null;
  organisationId: string;
  appointmentDate: Date;
  startTime: Date;
  endTime: Date;
  timeSlot: string;
  durationMinutes: number;
  status: AppointmentStatus;
  isEmergency: boolean;
  concern: string | null;
  attachments: Prisma.JsonValue | null;
  formIds: string[];
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export class AppointmentPrismaServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "AppointmentPrismaServiceError";
  }
}

type RescheduleChanges = {
  startTime: string | Date;
  endTime: string | Date;
  concern?: string;
  isEmergency?: boolean;
  durationMinutes?: number;
};

type CatalogSelection = Awaited<
  ReturnType<typeof CatalogService.resolveSelection>
>;
type AppointmentTemplateDefault = NonNullable<
  AppointmentDomain["templateDefaults"]
>[number];
type TransactionClient = Prisma.TransactionClient;
type AdmissionUpsertDelegate = {
  upsert(args: {
    where: { encounterId: string };
    update: Record<string, never>;
    create: {
      encounterId: string;
      organisationId: string;
      companionId: string;
      admittedAt: Date;
    };
  }): Promise<unknown>;
};
type CaseRow = {
  id: string;
  organisationId: string;
  companionId: string;
};
type EncounterLinkRow = {
  id: string;
  caseId: string;
  organisationId: string;
  companionId: string;
};
type TemplateRow = {
  id: string;
  kind: TemplateKind;
  organisationId: string | null;
  ownership: "YC_LIBRARY" | "ORG_TEMPLATE" | "USER_TEMPLATE";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  latestVersion: number;
  publishedVersion: number | null;
  updatedAt: Date;
};

type AppointmentListFilters = {
  organisationId?: string;
  companionId?: string;
  parentId?: string;
  leadId?: string;
  status?: AppointmentStatus[];
  startDate?: Date;
  endDate?: Date;
};

const DEFAULT_KIND: AppointmentKind = "OUTPATIENT";
const BOOKABLE_INVOICE_STATUSES = [
  "PAID",
  "PENDING",
  "AWAITING_PAYMENT",
  "FAILED",
  "REFUNDED",
] as const;

const toDate = (value: string | Date) =>
  value instanceof Date ? value : new Date(value);

const toJsonValue = <T>(value: T): Prisma.InputJsonValue =>
  value as unknown as Prisma.InputJsonValue;

const toNullableJsonValue = (
  value: Prisma.JsonValue | null | undefined,
): Prisma.InputJsonValue | Prisma.NullableJsonNullValueInput | undefined =>
  value == null ? Prisma.JsonNull : (value as Prisma.InputJsonValue);

const normalizeOptionalString = (value?: string | null) => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeAppointmentKind = (
  value?: AppointmentKind | null,
): AppointmentKind => (value === "INPATIENT" ? "INPATIENT" : DEFAULT_KIND);

const assertExists = <T>(value: T | null | undefined, message: string): T => {
  if (value == null) {
    throw new AppointmentPrismaServiceError(message, 404);
  }
  return value;
};

const assertAppointmentTransition = (
  current: AppointmentStatus,
  next: AppointmentStatus,
  context: string,
) => {
  const transitions: Record<AppointmentStatus, AppointmentStatus[]> = {
    REQUESTED: ["UPCOMING", "CANCELLED"],
    UPCOMING: ["CHECKED_IN", "CANCELLED", "NO_SHOW", "REQUESTED"],
    CHECKED_IN: ["IN_PROGRESS", "CANCELLED"],
    IN_PROGRESS: ["COMPLETED", "CANCELLED"],
    COMPLETED: [],
    CANCELLED: [],
    NO_SHOW: [],
  };

  if (current === next) return;
  if (!transitions[current].includes(next)) {
    throw new AppointmentPrismaServiceError(
      `Appointment cannot transition from ${current} to ${next} in ${context}.`,
      409,
    );
  }
};

const assertValidTimeRange = (startTime: Date, endTime: Date) => {
  if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime())) {
    throw new AppointmentPrismaServiceError(
      "Valid startTime and endTime are required.",
      400,
    );
  }

  if (endTime <= startTime) {
    throw new AppointmentPrismaServiceError(
      "endTime must be after startTime.",
      400,
    );
  }
};

const assertCaseEncounterConsistency = (input: {
  appointmentKind: AppointmentKind;
  caseId?: string;
  encounterId?: string;
}) => {
  if (input.encounterId && !input.caseId) {
    throw new AppointmentPrismaServiceError(
      "caseId is required when encounterId is provided.",
      400,
    );
  }
};

const resolveCatalogSelectionForAppointment = async (input: {
  appointmentType?: AppointmentDomain["appointmentType"];
  organisationId: string;
}) => {
  const selectionId = input.appointmentType?.id?.trim();
  if (!selectionId) {
    throw new AppointmentPrismaServiceError(
      "Appointment type is required.",
      400,
    );
  }

  try {
    return await CatalogService.resolveSelection(
      selectionId,
      input.organisationId,
    );
  } catch (error) {
    if (error instanceof CatalogServiceError) {
      throw new AppointmentPrismaServiceError(error.message, error.statusCode);
    }

    throw error;
  }
};

const assertSelectionSupportsAppointmentKind = (
  selection: CatalogSelection,
  appointmentKind: AppointmentKind,
) => {
  if (!selection.isBookable) {
    throw new AppointmentPrismaServiceError(
      "Selected product is not bookable.",
      400,
    );
  }

  if (!selection.appointmentKinds.includes(appointmentKind)) {
    throw new AppointmentPrismaServiceError(
      `Selected product is not bookable for ${appointmentKind.toLowerCase()} appointments.`,
      400,
    );
  }
};

const buildTemplateDefault = (
  template: TemplateRow,
  source: AppointmentTemplateDefault["source"],
  templateVersion?: number,
): AppointmentTemplateDefault => ({
  templateKind: template.kind,
  templateId: template.id,
  templateVersion:
    templateVersion ?? template.publishedVersion ?? template.latestVersion,
  source,
});

const resolveTemplateDefaultsForSelection = async (args: {
  tx: TransactionClient;
  organisationId: string;
  selection: CatalogSelection;
}): Promise<AppointmentTemplateDefault[]> => {
  const defaults: AppointmentTemplateDefault[] = [];
  const bindings: CatalogTemplateBinding[] = args.selection.templateBindings
    ?.length
    ? args.selection.templateBindings
    : args.selection.templateKinds.map((templateKind) => ({ templateKind }));

  for (const binding of bindings) {
    if (binding.templateId) {
      const resolvedTemplate = (await args.tx.template.findFirst({
        where: {
          id: binding.templateId,
          kind: binding.templateKind,
        },
      })) as TemplateRow | null;

      if (!resolvedTemplate) {
        throw new AppointmentPrismaServiceError(
          `Bound template ${binding.templateId} was not found.`,
          404,
        );
      }

      defaults.push(
        buildTemplateDefault(
          resolvedTemplate,
          "CATALOG_BINDING",
          binding.templateVersion ?? undefined,
        ),
      );
      continue;
    }

    const organisationTemplate =
      ((await args.tx.template.findFirst({
        where: {
          organisationId: args.organisationId,
          kind: binding.templateKind,
          status: "PUBLISHED",
        },
        orderBy: [{ updatedAt: "desc" }],
      })) as TemplateRow | null) ??
      ((await args.tx.template.findFirst({
        where: {
          organisationId: args.organisationId,
          kind: binding.templateKind,
        },
        orderBy: [{ updatedAt: "desc" }],
      })) as TemplateRow | null);

    const libraryTemplate = organisationTemplate
      ? null
      : (((await args.tx.template.findFirst({
          where: {
            ownership: "YC_LIBRARY",
            kind: binding.templateKind,
            status: "PUBLISHED",
          },
          orderBy: [{ updatedAt: "desc" }],
        })) as TemplateRow | null) ??
        ((await args.tx.template.findFirst({
          where: {
            ownership: "YC_LIBRARY",
            kind: binding.templateKind,
          },
          orderBy: [{ updatedAt: "desc" }],
        })) as TemplateRow | null));

    const resolvedTemplate = organisationTemplate ?? libraryTemplate;
    if (!resolvedTemplate) {
      continue;
    }

    defaults.push(
      buildTemplateDefault(
        resolvedTemplate,
        resolvedTemplate.ownership === "YC_LIBRARY"
          ? "LIBRARY_DEFAULT"
          : "ORGANISATION_DEFAULT",
      ),
    );
  }

  return defaults;
};

const attachTemplateDefaults = (
  appointmentType: AppointmentDomain["appointmentType"] | undefined,
  templateDefaults: AppointmentTemplateDefault[],
) => {
  if (!appointmentType) {
    return appointmentType;
  }

  return {
    ...appointmentType,
    templateDefaults,
  };
};

const getCompanionId = (
  companion: AppointmentDomain["companion"] | Prisma.JsonValue,
): string => ((companion as { id?: string } | null)?.id ?? "").trim();

const getParentIdFromCompanion = (
  companion: AppointmentDomain["companion"] | Prisma.JsonValue,
): string | undefined =>
  (
    (companion as { parent?: { id?: string } } | null)?.parent?.id ?? ""
  ).trim() || undefined;

const resolveCaseContext = async (args: {
  tx: TransactionClient;
  appointmentKind: AppointmentKind;
  caseId?: string;
  organisationId: string;
  companionId: string;
  parentId?: string;
  concern?: string;
}): Promise<string | undefined> => {
  const existingCaseId = normalizeOptionalString(args.caseId);

  if (existingCaseId) {
    const caseRow = (await args.tx.case.findUnique({
      where: { id: existingCaseId },
    })) as CaseRow | null;

    if (!caseRow) {
      throw new AppointmentPrismaServiceError("Case not found.", 404);
    }

    if (caseRow.organisationId !== args.organisationId) {
      throw new AppointmentPrismaServiceError(
        "Appointment case organisation mismatch.",
        409,
      );
    }

    if (caseRow.companionId !== args.companionId) {
      throw new AppointmentPrismaServiceError(
        "Appointment case companion mismatch.",
        409,
      );
    }

    return caseRow.id;
  }

  if (args.appointmentKind !== "INPATIENT") {
    return undefined;
  }

  const created = await args.tx.case.create({
    data: {
      organisationId: args.organisationId,
      companionId: args.companionId,
      parentId: normalizeOptionalString(args.parentId) ?? null,
      status: "active",
      appointmentKind: args.appointmentKind,
      title: "Inpatient case",
      description: normalizeOptionalString(args.concern) ?? null,
    },
    select: { id: true },
  });

  return created.id;
};

const assertEncounterMatchesAppointmentContext = async (args: {
  tx: TransactionClient;
  encounterId?: string;
  caseId?: string;
  organisationId: string;
  companionId: string;
}) => {
  const encounterId = normalizeOptionalString(args.encounterId);
  if (!encounterId) {
    return;
  }

  const encounter = (await args.tx.encounter.findUnique({
    where: { id: encounterId },
  })) as EncounterLinkRow | null;

  if (!encounter) {
    throw new AppointmentPrismaServiceError("Encounter not found.", 404);
  }

  if (encounter.caseId !== args.caseId) {
    throw new AppointmentPrismaServiceError(
      "Appointment encounter must belong to the selected case.",
      409,
    );
  }

  if (encounter.organisationId !== args.organisationId) {
    throw new AppointmentPrismaServiceError(
      "Appointment encounter organisation mismatch.",
      409,
    );
  }

  if (encounter.companionId !== args.companionId) {
    throw new AppointmentPrismaServiceError(
      "Appointment encounter companion mismatch.",
      409,
    );
  }
};

const ensureEncounterOnCheckIn = async (args: {
  tx: TransactionClient;
  appointmentId: string;
  current: AppointmentRow;
}) => {
  if (args.current.encounterId) {
    return args.current.encounterId;
  }

  const companionId = getCompanionId(args.current.companion);
  const caseId =
    normalizeOptionalString(args.current.caseId) ??
    (await resolveCaseContext({
      tx: args.tx,
      appointmentKind: normalizeAppointmentKind(args.current.appointmentKind),
      organisationId: args.current.organisationId,
      companionId,
      parentId: getParentIdFromCompanion(args.current.companion),
      concern: args.current.concern ?? undefined,
    }));

  if (!caseId) {
    throw new AppointmentPrismaServiceError(
      "caseId could not be resolved for check-in.",
      400,
    );
  }

  const createdEncounter = await args.tx.encounter.create({
    data: {
      caseId,
      organisationId: args.current.organisationId,
      companionId,
      parentId: getParentIdFromCompanion(args.current.companion) ?? null,
      status: "arrived",
      encounterClass:
        normalizeAppointmentKind(args.current.appointmentKind) === "INPATIENT"
          ? "IMP"
          : "AMB",
      appointmentKind: normalizeAppointmentKind(args.current.appointmentKind),
      title:
        (args.current.appointmentType as { name?: string } | null)?.name ??
        null,
      reason: args.current.concern ?? null,
      periodStart: args.current.startTime,
      periodEnd: args.current.endTime,
    },
    select: { id: true },
  });

  await args.tx.appointment.update({
    where: { id: args.appointmentId },
    data: {
      caseId,
      encounterId: createdEncounter.id,
    },
  });

  if (normalizeAppointmentKind(args.current.appointmentKind) === "INPATIENT") {
    const admissionDelegate = (
      args.tx as unknown as { admission: AdmissionUpsertDelegate }
    ).admission;

    await admissionDelegate.upsert({
      where: { encounterId: createdEncounter.id },
      update: {},
      create: {
        encounterId: createdEncounter.id,
        organisationId: args.current.organisationId,
        companionId,
        admittedAt: args.current.startTime,
      },
    });
  }

  return createdEncounter.id;
};

const assertLeadAvailability = async (args: {
  tx: TransactionClient;
  organisationId: string;
  leadId: string;
  startTime: Date;
  endTime: Date;
  excludeAppointmentId?: string;
}) => {
  const overlapping = await args.tx.occupancy.findFirst({
    where: {
      userId: args.leadId,
      organisationId: args.organisationId,
      startTime: { lt: args.endTime },
      endTime: { gt: args.startTime },
      ...(args.excludeAppointmentId
        ? {
            NOT: {
              sourceType: "APPOINTMENT",
              referenceId: args.excludeAppointmentId,
            },
          }
        : {}),
    },
  });

  if (overlapping) {
    throw new AppointmentPrismaServiceError(
      "Selected vet is not available for this slot.",
      409,
    );
  }
};

const upsertAppointmentOccupancy = async (args: {
  tx: TransactionClient;
  appointmentId: string;
  organisationId: string;
  leadId?: string;
  startTime: Date;
  endTime: Date;
}) => {
  await args.tx.occupancy.deleteMany({
    where: {
      organisationId: args.organisationId,
      sourceType: "APPOINTMENT",
      referenceId: args.appointmentId,
    },
  });

  if (!args.leadId) {
    return;
  }

  await assertLeadAvailability({
    tx: args.tx,
    organisationId: args.organisationId,
    leadId: args.leadId,
    startTime: args.startTime,
    endTime: args.endTime,
    excludeAppointmentId: args.appointmentId,
  });

  await args.tx.occupancy.create({
    data: {
      userId: args.leadId,
      organisationId: args.organisationId,
      startTime: args.startTime,
      endTime: args.endTime,
      sourceType: "APPOINTMENT",
      referenceId: args.appointmentId,
    },
  });
};

const buildWhereFromFilters = (
  filters: AppointmentListFilters,
): Prisma.AppointmentWhereInput => {
  const where: Prisma.AppointmentWhereInput = {};
  const and: Prisma.AppointmentWhereInput[] = [];

  if (filters.organisationId) {
    where.organisationId = filters.organisationId;
  }

  if (filters.status?.length) {
    where.status = { in: filters.status };
  }

  if (filters.startDate || filters.endDate) {
    where.startTime = {
      gte: filters.startDate ?? undefined,
      lte: filters.endDate ?? undefined,
    };
  }

  if (filters.companionId) {
    and.push({
      companion: {
        path: ["id"],
        equals: filters.companionId,
      } as never,
    });
  }

  if (filters.parentId) {
    and.push({
      companion: {
        path: ["parent", "id"],
        equals: filters.parentId,
      } as never,
    });
  }

  if (filters.leadId) {
    and.push({
      lead: {
        path: ["id"],
        equals: filters.leadId,
      } as never,
    });
  }

  if (and.length) {
    where.AND = and;
  }

  return where;
};

const resolvePaymentStatusMap = async (
  appointmentIds: string[],
): Promise<Map<string, AppointmentPaymentStatus>> => {
  const uniqueIds = [...new Set(appointmentIds.filter(Boolean))];
  const paymentStatusMap = new Map<string, AppointmentPaymentStatus>();

  if (!uniqueIds.length) {
    return paymentStatusMap;
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      appointmentId: { in: uniqueIds },
      status: { in: [...BOOKABLE_INVOICE_STATUSES] },
    },
    select: {
      appointmentId: true,
      status: true,
    },
  });

  const tracker = new Map<string, { hasPaid: boolean; hasUnpaid: boolean }>();

  for (const invoice of invoices) {
    if (!invoice.appointmentId) continue;
    const entry = tracker.get(invoice.appointmentId) ?? {
      hasPaid: false,
      hasUnpaid: false,
    };

    if (invoice.status === "PAID") {
      entry.hasPaid = true;
    } else {
      entry.hasUnpaid = true;
    }

    tracker.set(invoice.appointmentId, entry);
  }

  for (const [appointmentId, entry] of tracker) {
    paymentStatusMap.set(
      appointmentId,
      entry.hasPaid && !entry.hasUnpaid ? "PAID" : "UNPAID",
    );
  }

  return paymentStatusMap;
};

const toDomain = (
  row: AppointmentRow,
  paymentStatus?: AppointmentPaymentStatus,
): AppointmentDomain => {
  const appointmentTypeWithTemplates = row.appointmentType as
    | (AppointmentDomain["appointmentType"] & {
        templateDefaults?: AppointmentTemplateDefault[];
      })
    | null;
  const templateDefaults =
    appointmentTypeWithTemplates?.templateDefaults?.filter(Boolean) ?? [];

  return {
    id: row.id,
    caseId: row.caseId ?? undefined,
    encounterId: row.encounterId ?? undefined,
    companion: row.companion as AppointmentDomain["companion"],
    lead: (row.lead as AppointmentDomain["lead"]) ?? undefined,
    supportStaff:
      (row.supportStaff as AppointmentDomain["supportStaff"]) ?? undefined,
    room: (row.room as AppointmentDomain["room"]) ?? undefined,
    appointmentType:
      (row.appointmentType as AppointmentDomain["appointmentType"]) ??
      undefined,
    appointmentKind: normalizeAppointmentKind(row.appointmentKind),
    organisationId: row.organisationId,
    appointmentDate: new Date(row.appointmentDate),
    startTime: new Date(row.startTime),
    timeSlot: row.timeSlot,
    durationMinutes: row.durationMinutes,
    endTime: new Date(row.endTime),
    status: row.status,
    paymentStatus,
    isEmergency: row.isEmergency,
    concern: row.concern ?? undefined,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    attachments:
      (row.attachments as AppointmentDomain["attachments"]) ?? undefined,
    formIds: row.formIds ?? [],
    templateDefaults:
      templateDefaults.length > 0 ? templateDefaults : undefined,
  };
};

const toResponse = async (
  row: AppointmentRow,
): Promise<AppointmentResponseDTO> => {
  const paymentStatusMap = await resolvePaymentStatusMap([row.id]);
  return toAppointmentResponseDTO(
    toDomain(row, paymentStatusMap.get(row.id) ?? "UNPAID"),
  );
};

const toResponseList = async (
  rows: AppointmentRow[],
): Promise<AppointmentResponseDTO[]> => {
  if (!rows.length) return [];

  const paymentStatusMap = await resolvePaymentStatusMap(
    rows.map((row) => row.id),
  );
  return rows.map((row) =>
    toAppointmentResponseDTO(
      toDomain(row, paymentStatusMap.get(row.id) ?? "UNPAID"),
    ),
  );
};

const getLeadIdFromRow = (row: AppointmentRow): string | undefined => {
  const lead = row.lead as { id?: string } | null;
  return typeof lead?.id === "string" && lead.id.trim() ? lead.id : undefined;
};

const createAppointment = async (
  dto: AppointmentRequestDTO,
  status: AppointmentStatus,
): Promise<AppointmentResponseDTO> => {
  const input = fromAppointmentRequestDTO(dto);
  const appointmentKind = normalizeAppointmentKind(input.appointmentKind);
  const caseId = normalizeOptionalString(input.caseId);
  const encounterId = normalizeOptionalString(input.encounterId);
  assertValidTimeRange(input.startTime, input.endTime);
  assertCaseEncounterConsistency({ appointmentKind, caseId, encounterId });

  const selection = await resolveCatalogSelectionForAppointment({
    appointmentType: input.appointmentType,
    organisationId: input.organisationId,
  });
  assertSelectionSupportsAppointmentKind(selection, appointmentKind);

  const created = await prisma.$transaction(async (tx) => {
    const companionId = getCompanionId(input.companion);
    const resolvedCaseId = await resolveCaseContext({
      tx,
      appointmentKind,
      caseId,
      organisationId: input.organisationId,
      companionId,
      parentId: input.companion.parent?.id,
      concern: input.concern,
    });

    await assertEncounterMatchesAppointmentContext({
      tx,
      encounterId,
      caseId: resolvedCaseId,
      organisationId: input.organisationId,
      companionId,
    });

    const templateDefaults = await resolveTemplateDefaultsForSelection({
      tx,
      organisationId: input.organisationId,
      selection,
    });
    const appointmentType = attachTemplateDefaults(
      input.appointmentType,
      templateDefaults,
    );

    const appointment = await tx.appointment.create({
      data: {
        companion: toJsonValue(input.companion),
        lead: input.lead ? toJsonValue(input.lead) : Prisma.JsonNull,
        supportStaff: input.supportStaff ? toJsonValue(input.supportStaff) : [],
        room: input.room ? toJsonValue(input.room) : Prisma.JsonNull,
        appointmentType: appointmentType
          ? toJsonValue(appointmentType)
          : Prisma.JsonNull,
        appointmentKind,
        organisationId: input.organisationId,
        appointmentDate: input.appointmentDate,
        startTime: input.startTime,
        endTime: input.endTime,
        timeSlot: input.timeSlot,
        durationMinutes: input.durationMinutes,
        status,
        isEmergency: input.isEmergency ?? false,
        concern: input.concern ?? null,
        attachments: input.attachments
          ? toJsonValue(input.attachments)
          : Prisma.JsonNull,
        formIds: input.formIds ?? [],
        caseId: resolvedCaseId ?? null,
        encounterId: encounterId ?? null,
        productItemId: selection.productItemId,
        expiresAt: null,
      },
    });

    if (status === "UPCOMING") {
      await upsertAppointmentOccupancy({
        tx,
        appointmentId: appointment.id,
        organisationId: appointment.organisationId,
        leadId: input.lead?.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
      });
    }

    return appointment;
  });

  return toResponse(created as AppointmentRow);
};

const applyDtoPatch = (
  current: AppointmentRow,
  dto: AppointmentRequestDTO,
  nextStatus?: AppointmentStatus,
) => {
  const input = fromAppointmentRequestDTO(dto);

  return {
    caseId:
      input.caseId === undefined
        ? normalizeOptionalString(current.caseId)
        : (normalizeOptionalString(input.caseId) ?? null),
    encounterId:
      input.encounterId === undefined
        ? normalizeOptionalString(current.encounterId)
        : (normalizeOptionalString(input.encounterId) ?? null),
    companion: toJsonValue(input.companion),
    lead:
      input.lead === undefined
        ? toNullableJsonValue(current.lead)
        : toJsonValue(input.lead),
    supportStaff:
      input.supportStaff === undefined
        ? toNullableJsonValue(current.supportStaff)
        : toJsonValue(input.supportStaff),
    room:
      input.room === undefined
        ? toNullableJsonValue(current.room)
        : toJsonValue(input.room),
    appointmentType:
      input.appointmentType === undefined
        ? toNullableJsonValue(current.appointmentType)
        : toJsonValue(input.appointmentType),
    appointmentKind: normalizeAppointmentKind(
      input.appointmentKind ?? current.appointmentKind,
    ),
    appointmentDate: input.appointmentDate ?? current.appointmentDate,
    startTime: input.startTime ?? current.startTime,
    endTime: input.endTime ?? current.endTime,
    timeSlot: input.timeSlot || current.timeSlot,
    durationMinutes: input.durationMinutes || current.durationMinutes,
    status: nextStatus ?? input.status ?? current.status,
    isEmergency: input.isEmergency ?? current.isEmergency,
    concern: input.concern ?? current.concern,
    attachments:
      input.attachments === undefined
        ? toNullableJsonValue(current.attachments)
        : toJsonValue(input.attachments),
    formIds: input.formIds ?? current.formIds,
  };
};

export const AppointmentPrismaService = {
  async createRequestedFromMobile(dto: AppointmentRequestDTO) {
    return createAppointment(dto, "REQUESTED");
  },

  async createAppointmentFromPms(
    dto: AppointmentRequestDTO,
    _createPayment = false,
    _paymentCollectionMethod?: string,
  ) {
    void _createPayment;
    void _paymentCollectionMethod;
    return createAppointment(dto, "UPCOMING");
  },

  async approveRequestedFromPms(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(
      row.status,
      "UPCOMING",
      "approveRequestedFromPms",
    );

    const input = fromAppointmentRequestDTO(dto);
    if (!input.lead?.id) {
      throw new AppointmentPrismaServiceError(
        "Lead vet is required to approve an appointment.",
        400,
      );
    }

    const patch = applyDtoPatch(row, dto, "UPCOMING");
    const updated = await prisma.$transaction(async (tx) => {
      const companionId = getCompanionId(input.companion);
      const resolvedCaseId = await resolveCaseContext({
        tx,
        appointmentKind: patch.appointmentKind,
        caseId: patch.caseId ?? undefined,
        organisationId: row.organisationId,
        companionId,
        parentId: input.companion.parent?.id,
        concern: input.concern,
      });

      await assertEncounterMatchesAppointmentContext({
        tx,
        encounterId: patch.encounterId ?? undefined,
        caseId: resolvedCaseId,
        organisationId: row.organisationId,
        companionId,
      });

      await upsertAppointmentOccupancy({
        tx,
        appointmentId,
        organisationId: row.organisationId,
        leadId: input.lead?.id,
        startTime: patch.startTime,
        endTime: patch.endTime,
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          ...patch,
          caseId: resolvedCaseId ?? null,
          updatedAt: new Date(),
        },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async rejectRequestedAppointment(appointmentId: string) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(
      row.status,
      "CANCELLED",
      "rejectRequestedAppointment",
    );

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { status: "CANCELLED", updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },

  async checkInAppointmentParent(appointmentId: string, parentId: string) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const ownerId = (row.companion as { parent?: { id?: string } }).parent?.id;
    if (ownerId !== parentId) {
      throw new AppointmentPrismaServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    assertAppointmentTransition(
      row.status,
      "CHECKED_IN",
      "checkInAppointmentParent",
    );

    const updated = await prisma.$transaction(async (tx) => {
      const encounterId = await ensureEncounterOnCheckIn({
        tx,
        appointmentId,
        current: row,
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CHECKED_IN",
          encounterId,
          updatedAt: new Date(),
        },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async checkInAppointment(appointmentId: string) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(row.status, "CHECKED_IN", "checkInAppointment");

    const updated = await prisma.$transaction(async (tx) => {
      const encounterId = await ensureEncounterOnCheckIn({
        tx,
        appointmentId,
        current: row,
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          status: "CHECKED_IN",
          encounterId,
          updatedAt: new Date(),
        },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async rescheduleFromParent(
    appointmentId: string,
    parentId: string,
    changes: RescheduleChanges,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const ownerId = (row.companion as { parent?: { id?: string } }).parent?.id;
    if (ownerId !== parentId) {
      throw new AppointmentPrismaServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    if (row.status === "COMPLETED" || row.status === "CANCELLED") {
      throw new AppointmentPrismaServiceError(
        "Completed or cancelled appointments cannot be rescheduled.",
        400,
      );
    }

    const newStart = toDate(changes.startTime);
    const newEnd = toDate(changes.endTime);
    const nextStatus = row.status === "UPCOMING" ? "REQUESTED" : row.status;
    assertAppointmentTransition(row.status, nextStatus, "rescheduleFromParent");
    assertValidTimeRange(newStart, newEnd);

    const updated = await prisma.$transaction(async (tx) => {
      if (nextStatus === "REQUESTED") {
        await upsertAppointmentOccupancy({
          tx,
          appointmentId,
          organisationId: row.organisationId,
          startTime: newStart,
          endTime: newEnd,
        });
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          startTime: newStart,
          endTime: newEnd,
          appointmentDate: newStart,
          timeSlot: dayjs(newStart).format("HH:mm"),
          durationMinutes:
            typeof changes.durationMinutes === "number"
              ? changes.durationMinutes
              : dayjs(newEnd).diff(dayjs(newStart), "minute"),
          concern:
            typeof changes.concern === "string" ? changes.concern : row.concern,
          isEmergency:
            typeof changes.isEmergency === "boolean"
              ? changes.isEmergency
              : row.isEmergency,
          status: nextStatus,
          lead:
            nextStatus === "REQUESTED"
              ? Prisma.JsonNull
              : toNullableJsonValue(row.lead),
          supportStaff:
            nextStatus === "REQUESTED"
              ? []
              : toNullableJsonValue(row.supportStaff),
          room:
            nextStatus === "REQUESTED"
              ? Prisma.JsonNull
              : toNullableJsonValue(row.room),
          updatedAt: new Date(),
        },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async updateAppointmentPMS(
    appointmentId: string,
    dto: AppointmentRequestDTO,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const input = fromAppointmentRequestDTO(dto);
    const appointmentKind = normalizeAppointmentKind(
      input.appointmentKind ?? row.appointmentKind,
    );
    const caseId =
      input.caseId === undefined
        ? normalizeOptionalString(row.caseId)
        : normalizeOptionalString(input.caseId);
    const encounterId =
      input.encounterId === undefined
        ? normalizeOptionalString(row.encounterId)
        : normalizeOptionalString(input.encounterId);
    assertValidTimeRange(
      input.startTime ?? row.startTime,
      input.endTime ?? row.endTime,
    );
    assertCaseEncounterConsistency({ appointmentKind, caseId, encounterId });
    const selection = await resolveCatalogSelectionForAppointment({
      appointmentType:
        input.appointmentType ??
        (row.appointmentType as AppointmentDomain["appointmentType"]),
      organisationId: row.organisationId,
    });
    assertSelectionSupportsAppointmentKind(selection, appointmentKind);
    const patch = applyDtoPatch(row, dto, row.status);
    const updated = await prisma.$transaction(async (tx) => {
      const companionId = getCompanionId(input.companion);
      const resolvedCaseId = await resolveCaseContext({
        tx,
        appointmentKind,
        caseId,
        organisationId: row.organisationId,
        companionId,
        parentId: input.companion.parent?.id,
        concern: input.concern,
      });

      await assertEncounterMatchesAppointmentContext({
        tx,
        encounterId,
        caseId: resolvedCaseId,
        organisationId: row.organisationId,
        companionId,
      });

      const templateDefaults = await resolveTemplateDefaultsForSelection({
        tx,
        organisationId: row.organisationId,
        selection,
      });
      const appointmentType = attachTemplateDefaults(
        input.appointmentType ??
          (row.appointmentType as AppointmentDomain["appointmentType"]),
        templateDefaults,
      );

      if (patch.status === "UPCOMING") {
        await upsertAppointmentOccupancy({
          tx,
          appointmentId,
          organisationId: row.organisationId,
          leadId: input.lead?.id ?? getLeadIdFromRow(row),
          startTime: patch.startTime,
          endTime: patch.endTime,
        });
      } else {
        await upsertAppointmentOccupancy({
          tx,
          appointmentId,
          organisationId: row.organisationId,
          startTime: patch.startTime,
          endTime: patch.endTime,
        });
      }

      return tx.appointment.update({
        where: { id: appointmentId },
        data: {
          ...patch,
          appointmentType: appointmentType
            ? toJsonValue(appointmentType)
            : toNullableJsonValue(row.appointmentType),
          caseId: resolvedCaseId ?? null,
          encounterId: encounterId ?? null,
          productItemId: selection.productItemId,
          updatedAt: new Date(),
        },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async cancelAppointmentFromParent(
    appointmentId: string,
    parentId: string,
    _reason?: string,
  ) {
    void _reason;
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const ownerId = (row.companion as { parent?: { id?: string } }).parent?.id;
    if (ownerId !== parentId) {
      throw new AppointmentPrismaServiceError(
        "You are not allowed to modify this appointment.",
        403,
      );
    }

    assertAppointmentTransition(
      row.status,
      "CANCELLED",
      "cancelAppointmentFromParent",
    );

    const updated = await prisma.$transaction(async (tx) => {
      await upsertAppointmentOccupancy({
        tx,
        appointmentId,
        organisationId: row.organisationId,
        startTime: row.startTime,
        endTime: row.endTime,
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: { status: "CANCELLED", updatedAt: new Date() },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async cancelAppointment(appointmentId: string, _reason?: string) {
    void _reason;
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    assertAppointmentTransition(row.status, "CANCELLED", "cancelAppointment");

    const updated = await prisma.$transaction(async (tx) => {
      await upsertAppointmentOccupancy({
        tx,
        appointmentId,
        organisationId: row.organisationId,
        startTime: row.startTime,
        endTime: row.endTime,
      });

      return tx.appointment.update({
        where: { id: appointmentId },
        data: { status: "CANCELLED", updatedAt: new Date() },
      });
    });

    return toResponse(updated as AppointmentRow);
  },

  async getById(appointmentId: string): Promise<AppointmentResponseDTO> {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError(
        "Appointment ID is required",
        400,
      );
    }

    const row = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    if (!row) {
      throw new AppointmentPrismaServiceError("Appointment not found", 404);
    }

    return toResponse(row as AppointmentRow);
  },

  async getAppointmentsForCompanion(
    companionId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!companionId) {
      throw new AppointmentPrismaServiceError("companionId is required", 400);
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        companion: { path: ["id"], equals: companionId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForCompanionByOrganisation(
    companionId: string,
    organisationId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!companionId) {
      throw new AppointmentPrismaServiceError("companionId is required", 400);
    }
    if (!organisationId) {
      throw new AppointmentPrismaServiceError(
        "organisationId is required",
        400,
      );
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        organisationId,
        companion: { path: ["id"], equals: companionId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForParent(
    parentId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!parentId) {
      throw new AppointmentPrismaServiceError("parentId is required", 400);
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        companion: { path: ["parent", "id"], equals: parentId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
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
      throw new AppointmentPrismaServiceError(
        "organisationId is required",
        400,
      );
    }

    const where = buildWhereFromFilters({
      organisationId,
      status: filters?.status,
      startDate: filters?.startDate,
      endDate: filters?.endDate,
    });

    const rows = (await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForLead(
    leadId: string,
    organisationId?: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!leadId) {
      throw new AppointmentPrismaServiceError("leadId is required", 400);
    }

    const where = buildWhereFromFilters({
      leadId,
      organisationId,
    });

    const rows = (await prisma.appointment.findMany({
      where,
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async attachFormsToAppointment(
    appointmentId: string,
    formIds: string[],
  ): Promise<AppointmentResponseDTO> {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const current = await prisma.appointment.findUnique({
      where: { id: appointmentId },
    });
    const row = assertExists(
      current as AppointmentRow | null,
      "Appointment not found",
    );
    const nextFormIds = Array.from(
      new Set([...(row.formIds ?? []), ...(formIds ?? [])]),
    ).filter(Boolean);

    const updated = await prisma.appointment.update({
      where: { id: appointmentId },
      data: { formIds: nextFormIds, updatedAt: new Date() },
    });

    return toResponse(updated as AppointmentRow);
  },
};
