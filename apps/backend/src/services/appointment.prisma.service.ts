import dayjs from "dayjs";
import { Prisma } from "@prisma/client";
import {
  Appointment as AppointmentDomain,
  AppointmentBookingPaymentStatus,
  AppointmentKind,
  AppointmentPaymentStatus,
  AppointmentRequestDTO,
  AppointmentResponseDTO,
  type CatalogTemplateBinding,
  fromAppointmentRequestDTO,
  normalizeTemplateKind,
  toLegacyTemplateKind,
  toAppointmentResponseDTO,
  type TemplateKind,
} from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import { CatalogService, CatalogServiceError } from "./catalog.service";
import { InvoiceService } from "./invoice.service";
import { FinancePaymentService } from "./finance/payment";
import { resolvePaymentCollectionMethod } from "src/utils/payment";
import { CompanionOrganisationService } from "./companion-organisation.service";

type AppointmentStatus = AppointmentDomain["status"];

type AppointmentRow = {
  id: string;
  patient: Prisma.JsonValue;
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
type AppointmentRequestInput = ReturnType<typeof fromAppointmentRequestDTO>;
type AppointmentTemplateDefault = NonNullable<
  AppointmentDomain["templateDefaults"]
>[number];
type TransactionClient = Prisma.TransactionClient;
type AdmissionUpsertDelegate = {
  findUnique(args: {
    where: { encounterId: string };
  }): Promise<AdmissionRow | null>;
  upsert(args: {
    where: { encounterId: string };
    update: {
      unitId?: string | null;
      admittedAt?: Date;
      expectedStayDays?: number | null;
    };
    create: {
      encounterId: string;
      organisationId: string;
      patientId: string;
      admittedAt: Date;
      admittedBy?: string | null;
      expectedStayDays?: number | null;
    };
  }): Promise<unknown>;
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
type CaseRow = {
  id: string;
  organisationId: string;
  patientId: string;
};
type EncounterLinkRow = {
  id: string;
  caseId: string;
  organisationId: string;
  patientId: string;
};
type EncounterAdmissionRow = {
  id: string;
  caseId: string;
  organisationId: string;
  patientId: string;
  status: string;
  encounterClass: string;
  appointmentKind: AppointmentKind;
  periodStart: Date | null;
  periodEnd: Date | null;
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
type CompanionRow = {
  id: string;
  type: string;
  speciesCode: string | null;
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
type RoomUnitDelegate = {
  findUnique(args: { where: { id: string } }): Promise<RoomUnitRow | null>;
};
type RoomUnitGroupDelegate = {
  findUnique(args: { where: { id: string } }): Promise<RoomUnitGroupRow | null>;
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
type AdmitLeadInput = {
  id: string;
  name: string;
  profileUrl?: string;
};
type AdmitSupportStaffInput = {
  id: string;
  name: string;
};
type AdmitRequestInput = {
  admittedAt?: Date;
  admittedBy?: string;
  expectedStayDays?: number;
  lead?: AdmitLeadInput;
  supportStaff?: AdmitSupportStaffInput[];
  room?: {
    id: string;
    name: string;
  };
  roomUnitId?: string;
  assignedAt?: Date;
  assignedBy?: string;
  assignmentReason?: string;
};
type AdmitResponse = {
  appointment: AppointmentResponseDTO;
  admission: AdmissionRow;
  unitAssignment?: RoomUnitAssignmentRow;
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
  patientId?: string;
  parentId?: string;
  leadId?: string;
  status?: AppointmentStatus[];
  startDate?: Date;
  endDate?: Date;
};

const DEFAULT_KIND: AppointmentKind = "OUTPATIENT";
const UNPAID_INVOICE_STATUSES = new Set([
  "PENDING",
  "AWAITING_PAYMENT",
  "FAILED",
  "REFUNDED",
]);

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
  templateKind: normalizeTemplateKind(template.kind),
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
          kind: toLegacyTemplateKind(binding.templateKind),
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
          kind: toLegacyTemplateKind(binding.templateKind),
          status: "PUBLISHED",
        },
        orderBy: [{ updatedAt: "desc" }],
      })) as TemplateRow | null) ??
      ((await args.tx.template.findFirst({
        where: {
          organisationId: args.organisationId,
          kind: toLegacyTemplateKind(binding.templateKind),
        },
        orderBy: [{ updatedAt: "desc" }],
      })) as TemplateRow | null);

    const libraryTemplate = organisationTemplate
      ? null
      : (((await args.tx.template.findFirst({
          where: {
            ownership: "YC_LIBRARY",
            kind: toLegacyTemplateKind(binding.templateKind),
            status: "PUBLISHED",
          },
          orderBy: [{ updatedAt: "desc" }],
        })) as TemplateRow | null) ??
        ((await args.tx.template.findFirst({
          where: {
            ownership: "YC_LIBRARY",
            kind: toLegacyTemplateKind(binding.templateKind),
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

const getPatientId = (
  patient: AppointmentDomain["patient"] | Prisma.JsonValue,
): string => ((patient as { id?: string } | null)?.id ?? "").trim();

const getParentIdFromPatient = (
  patient: AppointmentDomain["patient"] | Prisma.JsonValue,
): string | undefined =>
  ((patient as { parent?: { id?: string } } | null)?.parent?.id ?? "").trim() ||
  undefined;

const isAppointmentAdmissible = (status: AppointmentStatus) =>
  status === "CHECKED_IN" || status === "IN_PROGRESS";

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
    throw new AppointmentPrismaServiceError(
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
    throw new AppointmentPrismaServiceError(
      "Room unit group is not compatible with this companion's species.",
      409,
    );
  }
};

const assertInpatientAdmissionCanProceed = (params: {
  row: AppointmentRow;
  encounterId: string;
  encounter: EncounterAdmissionRow;
  admission: AdmissionRow | null;
}) => {
  const { row, encounterId, encounter, admission } = params;

  if (!isAppointmentAdmissible(row.status)) {
    throw new AppointmentPrismaServiceError(
      "Only checked-in or in-progress appointments can be admitted.",
      409,
    );
  }

  const resolvedEncounterId = normalizeOptionalString(encounterId);
  if (!resolvedEncounterId) {
    throw new AppointmentPrismaServiceError(
      "Appointment must be checked in before admitting.",
      400,
    );
  }

  if (admission?.dischargedAt) {
    throw new AppointmentPrismaServiceError(
      "Admission is already discharged.",
      409,
    );
  }

  const nextCaseId =
    normalizeOptionalString(row.caseId) ??
    normalizeOptionalString(encounter.caseId);
  if (!nextCaseId) {
    throw new AppointmentPrismaServiceError(
      "Encounter caseId is required for inpatient admission.",
      400,
    );
  }

  return { encounterId: resolvedEncounterId, nextCaseId };
};

const resolveInpatientAdmissionFields = (
  row: AppointmentRow,
  input: AdmitRequestInput | undefined,
) => ({
  nextLead:
    input?.lead === undefined
      ? toNullableJsonValue(row.lead)
      : input.lead
        ? toJsonValue(input.lead)
        : Prisma.JsonNull,
  nextSupportStaff:
    input?.supportStaff === undefined
      ? toNullableJsonValue(row.supportStaff)
      : toJsonValue(input.supportStaff ?? []),
  nextRoom:
    input?.room === undefined
      ? toNullableJsonValue(row.room)
      : input.room
        ? toJsonValue(input.room)
        : Prisma.JsonNull,
});

const admitInpatientRoomUnit = async (params: {
  tx: TransactionClient;
  row: AppointmentRow;
  encounterId: string;
  companion: CompanionRow | null;
  input: AdmitRequestInput;
  admittedAt: Date;
  admissionDelegate: AdmissionUpsertDelegate;
}) => {
  const {
    tx,
    row,
    encounterId,
    companion,
    input,
    admittedAt,
    admissionDelegate,
  } = params;

  const unitId = normalizeOptionalString(input.roomUnitId);
  if (!unitId) {
    throw new AppointmentPrismaServiceError("roomUnitId is required.", 400);
  }

  const roomUnitDelegate = (tx as unknown as { roomUnit: RoomUnitDelegate })
    .roomUnit;
  const roomUnitGroupDelegate = (
    tx as unknown as { roomUnitGroup: RoomUnitGroupDelegate }
  ).roomUnitGroup;
  const assignmentDelegate = (
    tx as unknown as { roomUnitAssignment: RoomUnitAssignmentDelegate }
  ).roomUnitAssignment;

  const unit = await roomUnitDelegate.findUnique({ where: { id: unitId } });
  if (!unit) {
    throw new AppointmentPrismaServiceError("Room unit not found.", 404);
  }

  if (unit.organisationId !== row.organisationId) {
    throw new AppointmentPrismaServiceError("Unit organisation mismatch.", 409);
  }

  if (!unit.isActive) {
    throw new AppointmentPrismaServiceError("Selected unit is inactive.", 409);
  }

  if (!companion) {
    throw new AppointmentPrismaServiceError("Companion not found.", 404);
  }

  assertRoomUnitSpeciesCompatibility(unit, companion);

  if (unit.unitGroupId) {
    const group = await roomUnitGroupDelegate.findUnique({
      where: { id: unit.unitGroupId },
    });

    if (!group) {
      throw new AppointmentPrismaServiceError(
        "Room unit group not found.",
        404,
      );
    }

    if (group.organisationId !== row.organisationId) {
      throw new AppointmentPrismaServiceError(
        "Room unit group organisation mismatch.",
        409,
      );
    }

    assertRoomUnitGroupSpeciesCompatibility(group, companion);
  }

  const conflictingAssignment = await assignmentDelegate.findFirst({
    where: {
      unitId,
      releasedAt: null,
    },
    orderBy: { assignedAt: "desc" },
  });

  if (
    conflictingAssignment &&
    conflictingAssignment.admissionId !== encounterId
  ) {
    throw new AppointmentPrismaServiceError(
      "Room unit is already occupied.",
      409,
    );
  }

  const activeAssignment = await assignmentDelegate.findFirst({
    where: {
      admissionId: encounterId,
      releasedAt: null,
    },
    orderBy: { assignedAt: "desc" },
  });

  const assignedAt = input?.assignedAt ?? input?.admittedAt ?? admittedAt;
  if (Number.isNaN(assignedAt.getTime())) {
    throw new AppointmentPrismaServiceError("Invalid assignedAt.", 400);
  }

  if (activeAssignment && activeAssignment.unitId !== unitId) {
    await assignmentDelegate.update({
      where: { id: activeAssignment.id },
      data: { releasedAt: assignedAt },
    });
  }

  const unitAssignment =
    !activeAssignment || activeAssignment.unitId !== unitId
      ? await assignmentDelegate.create({
          data: {
            encounterId,
            admissionId: encounterId,
            unitId,
            assignedAt,
            assignedBy: normalizeOptionalString(input?.assignedBy) ?? null,
            reason: normalizeOptionalString(input?.assignmentReason) ?? null,
          },
        })
      : activeAssignment;

  await admissionDelegate.upsert({
    where: { encounterId },
    update: {
      unitId,
      admittedAt,
      ...(input?.expectedStayDays == null
        ? undefined
        : { expectedStayDays: input.expectedStayDays }),
    },
    create: {
      encounterId,
      organisationId: row.organisationId,
      patientId: getPatientId(row.patient),
      admittedAt,
      admittedBy: normalizeOptionalString(input?.admittedBy) ?? null,
      expectedStayDays: input?.expectedStayDays ?? null,
    },
  });

  return unitAssignment;
};

const resolveCaseContext = async (args: {
  tx: TransactionClient;
  appointmentKind: AppointmentKind;
  caseId?: string;
  organisationId: string;
  patientId: string;
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

    if (caseRow.patientId !== args.patientId) {
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
      patientId: args.patientId,
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

const createCaseForCheckIn = async (args: {
  tx: TransactionClient;
  current: AppointmentRow;
  appointmentKind: AppointmentKind;
  patientId: string;
}) => {
  const created = await args.tx.case.create({
    data: {
      organisationId: args.current.organisationId,
      patientId: args.patientId,
      parentId: getParentIdFromPatient(args.current.patient) ?? null,
      status: "active",
      appointmentKind: args.appointmentKind,
      title:
        args.appointmentKind === "INPATIENT"
          ? "Inpatient case"
          : "Outpatient case",
      description: args.current.concern ?? null,
    },
    select: { id: true },
  });

  return created.id;
};

const resolveEncounterForAdmission = async (args: {
  tx: TransactionClient;
  encounterId: string;
  appointment: AppointmentRow;
}) => {
  const encounter = (await args.tx.encounter.findUnique({
    where: { id: args.encounterId },
  })) as EncounterAdmissionRow | null;

  if (!encounter) {
    throw new AppointmentPrismaServiceError("Encounter not found.", 404);
  }

  if (encounter.organisationId !== args.appointment.organisationId) {
    throw new AppointmentPrismaServiceError(
      "Appointment encounter organisation mismatch.",
      409,
    );
  }

  if (encounter.patientId !== getPatientId(args.appointment.patient)) {
    throw new AppointmentPrismaServiceError(
      "Appointment encounter companion mismatch.",
      409,
    );
  }

  const appointmentCaseId = normalizeOptionalString(args.appointment.caseId);
  if (appointmentCaseId && appointmentCaseId !== encounter.caseId) {
    throw new AppointmentPrismaServiceError(
      "Appointment encounter must belong to the selected case.",
      409,
    );
  }

  return encounter;
};

const assertEncounterMatchesAppointmentContext = async (args: {
  tx: TransactionClient;
  encounterId?: string;
  caseId?: string;
  organisationId: string;
  patientId: string;
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

  if (encounter.patientId !== args.patientId) {
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

  const patientId = getPatientId(args.current.patient);
  const appointmentKind = normalizeAppointmentKind(
    args.current.appointmentKind,
  );
  const caseId =
    normalizeOptionalString(args.current.caseId) ??
    (await resolveCaseContext({
      tx: args.tx,
      appointmentKind,
      organisationId: args.current.organisationId,
      patientId,
      parentId: getParentIdFromPatient(args.current.patient),
      concern: args.current.concern ?? undefined,
    })) ??
    (await createCaseForCheckIn({
      tx: args.tx,
      current: args.current,
      appointmentKind,
      patientId,
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
      patientId,
      parentId: getParentIdFromPatient(args.current.patient) ?? null,
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

  if (filters.patientId) {
    and.push({
      patient: {
        path: ["id"],
        equals: filters.patientId,
      } as never,
    });
  }

  if (filters.parentId) {
    and.push({
      patient: {
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

type AppointmentPaymentStateMaps = {
  paymentStatusMap: Map<string, AppointmentPaymentStatus>;
  bookingPaymentStatusMap: Map<string, AppointmentBookingPaymentStatus>;
};

const resolveAppointmentPaymentStateMaps = async (
  appointmentIds: string[],
): Promise<AppointmentPaymentStateMaps> => {
  const uniqueIds = [...new Set(appointmentIds.filter(Boolean))];
  const paymentStatusMap = new Map<string, AppointmentPaymentStatus>();
  const bookingPaymentStatusMap = new Map<
    string,
    AppointmentBookingPaymentStatus
  >();

  if (!uniqueIds.length) {
    return { paymentStatusMap, bookingPaymentStatusMap };
  }

  const invoices = await prisma.invoice.findMany({
    where: {
      appointmentId: { in: uniqueIds },
    },
    select: {
      appointmentId: true,
      status: true,
      depositCollectedAmount: true,
      paymentAttempts: {
        where: { status: "SUCCEEDED" },
        select: { id: true },
      },
      payments: {
        where: { status: "SUCCEEDED" },
        select: { id: true },
      },
    },
  });

  const tracker = new Map<
    string,
    {
      hasPaid: boolean;
      hasUnpaid: boolean;
      hasBookingPayment: boolean;
    }
  >();

  for (const invoice of invoices) {
    if (!invoice.appointmentId) continue;
    const entry = tracker.get(invoice.appointmentId) ?? {
      hasPaid: false,
      hasUnpaid: false,
      hasBookingPayment: false,
    };

    const hasSuccessfulPayment =
      (invoice.payments?.length ?? 0) > 0 ||
      (invoice.paymentAttempts?.length ?? 0) > 0;
    const hasBookingPayment =
      hasSuccessfulPayment || (invoice.depositCollectedAmount ?? 0) > 0;
    const isPaid = invoice.status === "PAID";
    const isUnpaid = UNPAID_INVOICE_STATUSES.has(invoice.status);

    if (isPaid) {
      entry.hasPaid = true;
    }
    if (isUnpaid) {
      entry.hasUnpaid = true;
    }
    if (hasBookingPayment) {
      entry.hasBookingPayment = true;
    }

    tracker.set(invoice.appointmentId, entry);
  }

  for (const [appointmentId, entry] of tracker) {
    paymentStatusMap.set(
      appointmentId,
      entry.hasPaid && !entry.hasUnpaid ? "PAID" : "UNPAID",
    );
    bookingPaymentStatusMap.set(
      appointmentId,
      entry.hasBookingPayment ? "PAID" : "UNPAID",
    );
  }

  return { paymentStatusMap, bookingPaymentStatusMap };
};

const toDomain = (
  row: AppointmentRow,
  paymentStatus?: AppointmentPaymentStatus,
  bookingPaymentStatus?: AppointmentBookingPaymentStatus,
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
    patient: row.patient as AppointmentDomain["patient"],
    companion: row.patient as AppointmentDomain["patient"],
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
    bookingPaymentStatus,
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
  const { paymentStatusMap, bookingPaymentStatusMap } =
    await resolveAppointmentPaymentStateMaps([row.id]);
  return toAppointmentResponseDTO(
    toDomain(
      row,
      paymentStatusMap.get(row.id) ?? "UNPAID",
      bookingPaymentStatusMap.get(row.id) ?? "UNPAID",
    ),
  );
};

const toResponseList = async (
  rows: AppointmentRow[],
): Promise<AppointmentResponseDTO[]> => {
  if (!rows.length) return [];

  const { paymentStatusMap, bookingPaymentStatusMap } =
    await resolveAppointmentPaymentStateMaps(rows.map((row) => row.id));
  return rows.map((row) =>
    toAppointmentResponseDTO(
      toDomain(
        row,
        paymentStatusMap.get(row.id) ?? "UNPAID",
        bookingPaymentStatusMap.get(row.id) ?? "UNPAID",
      ),
    ),
  );
};

const getLeadIdFromRow = (row: AppointmentRow): string | undefined => {
  const lead = row.lead as { id?: string } | null;
  return typeof lead?.id === "string" && lead.id.trim() ? lead.id : undefined;
};

const getSupportStaffIdsFromRow = (row: AppointmentRow): string[] => {
  const supportStaff = row.supportStaff as Array<{ id?: string }> | null;
  if (!Array.isArray(supportStaff)) return [];

  return supportStaff
    .map((member) => (typeof member?.id === "string" ? member.id.trim() : ""))
    .filter((id): id is string => Boolean(id));
};

const canViewOwnAppointment = (row: AppointmentRow, actorId: string): boolean =>
  getLeadIdFromRow(row) === actorId ||
  getSupportStaffIdsFromRow(row).includes(actorId);

const getParentIdFromRow = (row: AppointmentRow): string | undefined => {
  const patient = row.patient as { parent?: { id?: string } } | null;
  const parentId = patient?.parent?.id;
  return typeof parentId === "string" && parentId.trim() ? parentId : undefined;
};

const assertParentOwnsAppointment = (row: AppointmentRow, parentId: string) => {
  if (getParentIdFromRow(row) !== parentId) {
    throw new AppointmentPrismaServiceError(
      "You are not allowed to modify this appointment.",
      403,
    );
  }
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

  const organisation = await prisma.organization.findUnique({
    where: { id: input.organisationId },
    select: { type: true },
  });

  if (!organisation?.type) {
    throw new AppointmentPrismaServiceError(
      "Unable to resolve organisation type for appointment booking.",
      404,
    );
  }

  await CompanionOrganisationService.linkByParent({
    parentId: input.patient.parent.id,
    patientId: input.patient.id,
    organisationId: input.organisationId,
    organisationType: organisation.type,
  });

  const created = await prisma.$transaction(async (tx) => {
    const patientId = getPatientId(input.patient);
    const resolvedCaseId = await resolveCaseContext({
      tx,
      appointmentKind,
      caseId,
      organisationId: input.organisationId,
      patientId,
      parentId: input.patient.parent?.id,
      concern: input.concern,
    });

    await assertEncounterMatchesAppointmentContext({
      tx,
      encounterId,
      caseId: resolvedCaseId,
      organisationId: input.organisationId,
      patientId,
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
        patient: toJsonValue(input.patient),
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
    patient: toJsonValue(input.patient),
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

const approveRequestedFromPmsInTransaction = async (args: {
  tx: TransactionClient;
  appointmentId: string;
  row: AppointmentRow;
  patch: ReturnType<typeof applyDtoPatch>;
  patient: AppointmentRequestInput["patient"];
  concern: AppointmentRequestInput["concern"];
  leadId: string;
}) => {
  const { tx, appointmentId, row, patch, patient, concern, leadId } = args;
  const patientId = getPatientId(patient);
  const resolvedCaseId = await resolveCaseContext({
    tx,
    appointmentKind: patch.appointmentKind,
    caseId: patch.caseId ?? undefined,
    organisationId: row.organisationId,
    patientId,
    parentId: patient.parent?.id,
    concern,
  });

  await assertEncounterMatchesAppointmentContext({
    tx,
    encounterId: patch.encounterId ?? undefined,
    caseId: resolvedCaseId,
    organisationId: row.organisationId,
    patientId,
  });

  await upsertAppointmentOccupancy({
    tx,
    appointmentId,
    organisationId: row.organisationId,
    leadId,
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
};

export const AppointmentPrismaService = {
  async createRequestedFromMobile(dto: AppointmentRequestDTO) {
    return createAppointment(dto, "REQUESTED");
  },

  async createAppointmentFromPms(
    dto: AppointmentRequestDTO,
    createPayment = false,
    paymentCollectionMethod?: string,
  ) {
    const resolvedPaymentCollectionMethod =
      resolvePaymentCollectionMethod(paymentCollectionMethod, (message) => {
        return new AppointmentPrismaServiceError(message, 400);
      }) ?? "PAYMENT_LINK";

    if (
      resolvedPaymentCollectionMethod === "PAYMENT_AT_CLINIC" &&
      createPayment
    ) {
      throw new AppointmentPrismaServiceError(
        "Cannot create online payment for in-clinic collection.",
        400,
      );
    }

    const appointment = await createAppointment(dto, "UPCOMING");
    const appointmentId =
      typeof appointment.id === "string" ? appointment.id : undefined;
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError(
        "Appointment ID is required",
        500,
      );
    }
    const invoice = await InvoiceService.bootstrapForAppointment(
      appointmentId,
      resolvedPaymentCollectionMethod,
    );

    if (createPayment && invoice.id) {
      if (resolvedPaymentCollectionMethod === "PAYMENT_LINK") {
        await InvoiceService.createCheckoutSessionAndEmailParent(invoice.id);
      } else if (resolvedPaymentCollectionMethod === "PAYMENT_INTENT") {
        await FinancePaymentService.createPaymentIntentForInvoice(invoice.id);
      }
    }

    return AppointmentPrismaService.getById(appointmentId);
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
    const leadId = input.lead?.id;
    if (!leadId) {
      throw new AppointmentPrismaServiceError(
        "Lead vet is required to approve an appointment.",
        400,
      );
    }

    const patch = applyDtoPatch(row, dto, "UPCOMING");
    const updated = await prisma.$transaction((tx) =>
      approveRequestedFromPmsInTransaction({
        tx,
        appointmentId,
        row,
        patch,
        patient: input.patient,
        concern: input.concern,
        leadId,
      }),
    );

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
    const ownerId = (row.patient as { parent?: { id?: string } }).parent?.id;
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

  async admitAppointmentToInpatient(
    appointmentId: string,
    input?: AdmitRequestInput,
  ) {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError("appointmentId is required", 400);
    }

    const admittedAt = input?.admittedAt ?? new Date();
    if (Number.isNaN(admittedAt.getTime())) {
      throw new AppointmentPrismaServiceError("Invalid admittedAt.", 400);
    }

    if (
      input?.expectedStayDays !== undefined &&
      (!Number.isInteger(input.expectedStayDays) || input.expectedStayDays < 0)
    ) {
      throw new AppointmentPrismaServiceError(
        "expectedStayDays must be a non-negative integer.",
        400,
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const current = await tx.appointment.findUnique({
        where: { id: appointmentId },
      });
      const row = assertExists(
        current as AppointmentRow | null,
        "Appointment not found",
      );

      const rowEncounterId = normalizeOptionalString(row.encounterId);
      if (!rowEncounterId) {
        throw new AppointmentPrismaServiceError(
          "Appointment must be checked in before admitting.",
          400,
        );
      }

      const encounter = await resolveEncounterForAdmission({
        tx,
        encounterId: rowEncounterId,
        appointment: row,
      });

      const admissionDelegate = (
        tx as unknown as { admission: AdmissionUpsertDelegate }
      ).admission;
      const admission = await admissionDelegate.findUnique({
        where: { encounterId: rowEncounterId },
      });

      const { encounterId, nextCaseId } = assertInpatientAdmissionCanProceed({
        row,
        encounterId: rowEncounterId,
        encounter,
        admission,
      });
      const { nextLead, nextSupportStaff, nextRoom } =
        resolveInpatientAdmissionFields(row, input);

      await tx.encounter.update({
        where: { id: encounterId },
        data: {
          appointmentKind: "INPATIENT",
          encounterClass: "IMP",
          periodStart: encounter.periodStart ?? admittedAt,
          status:
            encounter.status === "arrived" ? "in-progress" : encounter.status,
        },
      });

      await admissionDelegate.upsert({
        where: { encounterId },
        update: {},
        create: {
          encounterId,
          organisationId: row.organisationId,
          patientId: getPatientId(row.patient),
          admittedAt,
          expectedStayDays: input?.expectedStayDays ?? null,
        },
      });

      const companion = await tx.patient.findUnique({
        where: { id: encounter.patientId },
      });

      const unitAssignment = input?.roomUnitId
        ? await admitInpatientRoomUnit({
            tx,
            row,
            encounterId,
            companion,
            input,
            admittedAt,
            admissionDelegate,
          })
        : undefined;

      const appointment = await tx.appointment.update({
        where: { id: appointmentId },
        data: {
          appointmentKind: "INPATIENT",
          caseId: nextCaseId,
          encounterId,
          lead: nextLead,
          supportStaff: nextSupportStaff,
          room: nextRoom,
          updatedAt: new Date(),
        },
      });

      const finalAdmission = await admissionDelegate.findUnique({
        where: { encounterId },
      });
      if (!finalAdmission) {
        throw new AppointmentPrismaServiceError(
          "Admission could not be resolved after admit.",
          500,
        );
      }

      return {
        appointment,
        admission: finalAdmission,
        unitAssignment,
      };
    });

    return {
      appointment: await toResponse(updated.appointment as AppointmentRow),
      admission: updated.admission,
      unitAssignment: updated.unitAssignment,
    } satisfies AdmitResponse;
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
    const ownerId = (row.patient as { parent?: { id?: string } }).parent?.id;
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
    const patch = applyDtoPatch(row, dto, input.status ?? row.status);
    const updated = await prisma.$transaction(async (tx) => {
      const patientId = getPatientId(input.patient);
      const resolvedCaseId = await resolveCaseContext({
        tx,
        appointmentKind,
        caseId,
        organisationId: row.organisationId,
        patientId,
        parentId: input.patient.parent?.id,
        concern: input.concern,
      });

      await assertEncounterMatchesAppointmentContext({
        tx,
        encounterId,
        caseId: resolvedCaseId,
        organisationId: row.organisationId,
        patientId,
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

    if (patch.status === "COMPLETED") {
      await InvoiceService.markAppointmentReadyForBilling(appointmentId);
    }

    return toResponse(updated as AppointmentRow);
  },

  async cancelAppointmentFromParent(appointmentId: string, parentId: string) {
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
    assertParentOwnsAppointment(row, parentId);

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

  async cancelAppointment(appointmentId: string) {
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

  async getById(
    appointmentId: string,
    organisationId?: string,
    actorId?: string,
    parentId?: string,
  ): Promise<AppointmentResponseDTO> {
    if (!appointmentId) {
      throw new AppointmentPrismaServiceError(
        "Appointment ID is required",
        400,
      );
    }

    const row = organisationId
      ? await prisma.appointment.findFirst({
          where: { id: appointmentId, organisationId },
        })
      : await prisma.appointment.findUnique({
          where: { id: appointmentId },
        });
    if (!row) {
      throw new AppointmentPrismaServiceError("Appointment not found", 404);
    }

    const canViewAsActor =
      actorId && canViewOwnAppointment(row as AppointmentRow, actorId);
    const canViewAsParent =
      parentId && getParentIdFromRow(row as AppointmentRow) === parentId;

    if ((actorId || parentId) && !canViewAsActor && !canViewAsParent) {
      throw new AppointmentPrismaServiceError(
        "Forbidden – insufficient permissions",
        403,
      );
    }

    return toResponse(row as AppointmentRow);
  },

  async getAppointmentsForCompanion(
    patientId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!patientId) {
      throw new AppointmentPrismaServiceError("patientId is required", 400);
    }

    const rows = (await prisma.appointment.findMany({
      where: {
        patient: { path: ["id"], equals: patientId } as never,
      },
      orderBy: { startTime: "desc" },
    })) as AppointmentRow[];

    return toResponseList(rows);
  },

  async getAppointmentsForCompanionByOrganisation(
    patientId: string,
    organisationId: string,
  ): Promise<AppointmentResponseDTO[]> {
    if (!patientId) {
      throw new AppointmentPrismaServiceError("patientId is required", 400);
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
        patient: { path: ["id"], equals: patientId } as never,
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
        patient: { path: ["parent", "id"], equals: parentId } as never,
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
