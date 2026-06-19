import { Prisma, TemplateKind } from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import type {
  FormAssignmentCreateInput,
  FormAssignmentLike,
  FormSignerIdentity,
  WorkspaceFormRow,
} from "@yosemite-crew/types";

export class FormAssignmentServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "FormAssignmentServiceError";
  }
}

export const formAssignmentSignerIdentitySchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).optional(),
    email: z.string().trim().email().optional(),
    role: z.string().trim().min(1).optional(),
  })
  .strict();

export const createFormAssignmentSchema = z
  .object({
    organisationId: z.string().trim().min(1),
    createdBy: z.string().trim().min(1),
    templateId: z.string().trim().min(1),
    templateVersion: z.number().int().positive().optional(),
    appointmentId: z.string().trim().min(1),
    companionId: z.string().trim().min(1).optional(),
    mobileVisible: z.boolean().optional(),
    signingRequired: z.boolean().optional(),
    signerIdentity: formAssignmentSignerIdentitySchema.optional(),
  })
  .strict();

type AppointmentRow = {
  id: string;
  organisationId: string;
  encounterId: string | null;
  patient: unknown;
};

type FormAssignmentRow = Prisma.FormAssignmentGetPayload<Record<string, never>>;
type FormAssignmentDbStatus = FormAssignmentRow["status"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const getNestedString = (
  value: unknown,
  path: string[],
): string | undefined => {
  let current: unknown = value;
  for (const key of path) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }

  return typeof current === "string" && current.trim().length > 0
    ? current.trim()
    : undefined;
};

const resolvePatientId = (patient: unknown): string | undefined =>
  getNestedString(patient, ["id"]);

const toSignerIdentity = (
  row: Pick<
    FormAssignmentRow,
    "signerUserId" | "signerName" | "signerEmail" | "signerRole"
  >,
): FormSignerIdentity | null => {
  if (
    !row.signerUserId &&
    !row.signerName &&
    !row.signerEmail &&
    !row.signerRole
  ) {
    return null;
  }

  return {
    userId: row.signerUserId,
    name: row.signerName,
    email: row.signerEmail,
    role: row.signerRole,
  };
};

const normalizeAssignmentStatus = (
  status: FormAssignmentDbStatus | FormAssignmentLike["status"],
): FormAssignmentLike["status"] => {
  switch (status) {
    case "DRAFT":
    case "draft":
      return "draft";
    case "SENT":
    case "sent":
      return "sent";
    case "VIEWED":
    case "viewed":
      return "viewed";
    case "SUBMITTED":
    case "submitted":
      return "submitted";
    case "SIGNED":
    case "signed":
      return "signed";
    case "EXPIRED":
    case "expired":
      return "expired";
    case "CANCELLED":
    case "cancelled":
      return "cancelled";
  }
};

const toAssignmentLike = (row: FormAssignmentRow): FormAssignmentLike => ({
  assignmentId: row.id,
  id: row.id,
  organisationId: row.organisationId,
  templateId: row.templateId,
  templateVersion: row.templateVersion,
  appointmentId: row.appointmentId,
  encounterId: row.encounterId,
  companionId: row.companionId,
  signerUserId: row.signerUserId,
  signerName: row.signerName,
  signerEmail: row.signerEmail,
  signerRole: row.signerRole,
  mobileVisible: row.mobileVisible,
  signingRequired: row.signingRequired,
  status: normalizeAssignmentStatus(row.status),
  sentAt: row.sentAt,
  viewedAt: row.viewedAt,
  submittedAt: row.submittedAt,
  signedAt: row.signedAt,
  expiredAt: row.expiredAt,
  cancelledAt: row.cancelledAt,
  signerIdentity: toSignerIdentity(row),
  createdBy: row.createdBy,
  updatedBy: row.updatedBy,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensureTemplate = async (
  organisationId: string,
  templateId: string,
  templateVersion?: number,
) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      organisationId,
      kind: TemplateKind.FORM,
    },
    select: {
      id: true,
      latestVersion: true,
      publishedVersion: true,
    },
  });

  if (!template) {
    throw new FormAssignmentServiceError("Template not found", 404);
  }

  const selectedVersion =
    templateVersion ?? template.publishedVersion ?? template.latestVersion;

  const version = await prisma.templateVersion.findFirst({
    where: {
      templateId: template.id,
      version: selectedVersion,
    },
    select: {
      templateId: true,
      version: true,
    },
  });

  if (!version) {
    throw new FormAssignmentServiceError("Template version not found", 404);
  }

  return version;
};

const loadAppointment = async (
  organisationId: string,
  appointmentId: string,
): Promise<AppointmentRow> => {
  const appointment = (await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      organisationId,
    },
    select: {
      id: true,
      organisationId: true,
      encounterId: true,
      patient: true,
    },
  })) as AppointmentRow | null;

  if (!appointment) {
    throw new FormAssignmentServiceError("Appointment not found", 404);
  }

  return appointment;
};

const resolveCompanionId = (appointment: AppointmentRow, fallback?: string) =>
  resolvePatientId(appointment.patient) ?? fallback ?? undefined;

const ensureAssignment = async (
  assignmentId: string,
  organisationId: string,
) => {
  const assignment = await prisma.formAssignment.findFirst({
    where: {
      id: assignmentId,
      organisationId,
    },
  });

  if (!assignment) {
    throw new FormAssignmentServiceError("Assignment not found", 404);
  }

  return assignment;
};

const ensureResendable = (
  status: FormAssignmentDbStatus | FormAssignmentLike["status"],
) => {
  const normalized = normalizeAssignmentStatus(status);
  if (
    normalized === "cancelled" ||
    normalized === "signed" ||
    normalized === "expired"
  ) {
    throw new FormAssignmentServiceError(
      "Assignment can no longer be resent",
      409,
    );
  }
};

const ensureCancellable = (
  status: FormAssignmentDbStatus | FormAssignmentLike["status"],
) => {
  const normalized = normalizeAssignmentStatus(status);
  if (normalized === "signed" || normalized === "expired") {
    throw new FormAssignmentServiceError(
      "Assignment can no longer be cancelled",
      409,
    );
  }
};

export const FormAssignmentService = {
  async createForAppointment(input: FormAssignmentCreateInput) {
    const parsed = createFormAssignmentSchema.parse(input);
    const version = await ensureTemplate(
      parsed.organisationId,
      parsed.templateId,
      parsed.templateVersion,
    );
    const appointment = await loadAppointment(
      parsed.organisationId,
      parsed.appointmentId,
    );

    const companionId = appointment
      ? resolveCompanionId(appointment, parsed.companionId)
      : (parsed.companionId ?? undefined);

    const createdBy = parsed.createdBy;
    const now = new Date();

    const row = await prisma.formAssignment.create({
      data: {
        organisationId: parsed.organisationId,
        templateId: version.templateId,
        templateVersion: version.version,
        appointmentId: appointment.id,
        encounterId: appointment.encounterId ?? undefined,
        companionId,
        signerUserId: parsed.signerIdentity?.userId ?? undefined,
        signerName: parsed.signerIdentity?.name ?? undefined,
        signerEmail: parsed.signerIdentity?.email ?? undefined,
        signerRole: parsed.signerIdentity?.role ?? undefined,
        mobileVisible: parsed.mobileVisible ?? true,
        signingRequired: parsed.signingRequired ?? true,
        status: "SENT",
        sentAt: now,
        createdBy,
        updatedBy: createdBy,
      },
    });

    return toAssignmentLike(row);
  },

  async listForAppointment(organisationId: string, appointmentId: string) {
    const rows = await prisma.formAssignment.findMany({
      where: {
        organisationId,
        appointmentId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return rows.map((row) => toAssignmentLike(row));
  },

  async listForCompanion(organisationId: string, companionId: string) {
    const rows = await prisma.formAssignment.findMany({
      where: {
        organisationId,
        companionId,
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
    });

    return rows.map((row) => toAssignmentLike(row));
  },

  async resend(
    assignmentId: string,
    organisationId: string,
    updatedBy: string,
  ) {
    const assignment = await ensureAssignment(assignmentId, organisationId);
    ensureResendable(assignment.status);

    const now = new Date();
    const row = await prisma.formAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "SENT",
        sentAt: now,
        updatedBy,
        updatedAt: now,
      },
    });

    return toAssignmentLike(row);
  },

  async cancel(
    assignmentId: string,
    organisationId: string,
    updatedBy: string,
  ) {
    const assignment = await ensureAssignment(assignmentId, organisationId);
    if (normalizeAssignmentStatus(assignment.status) === "cancelled") {
      return toAssignmentLike(assignment);
    }
    ensureCancellable(normalizeAssignmentStatus(assignment.status));

    const now = new Date();
    const row = await prisma.formAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "CANCELLED",
        cancelledAt: now,
        updatedBy,
        updatedAt: now,
      },
    });

    return toAssignmentLike(row);
  },

  async listAppointmentFormSummaries(
    organisationId: string,
    appointmentId: string,
  ): Promise<WorkspaceFormRow[]> {
    const assignments = await FormAssignmentService.listForAppointment(
      organisationId,
      appointmentId,
    );

    return assignments.map((assignment) => ({
      ...assignment,
      status: isCompleted(assignment) ? "completed" : "pending",
      assignmentStatus: assignment.status,
    }));
  },
};

const isCompleted = (assignment: FormAssignmentLike) =>
  assignment.status === "signed" ||
  assignment.status === "cancelled" ||
  assignment.status === "expired" ||
  (!assignment.signingRequired && assignment.status === "submitted");
