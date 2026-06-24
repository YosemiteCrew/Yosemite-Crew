import {
  Prisma,
  TemplateKind,
  FormAssignmentStatus as PrismaFormAssignmentStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import { TemplateService } from "src/services/template.service";
import type {
  FormAssignmentCreateInput,
  FormAssignmentLike,
  FormAssignmentListItem,
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
  productItemId: string | null;
  appointmentKind: string | null;
  patient: unknown;
};

type FormAssignmentRow = Prisma.FormAssignmentGetPayload<Record<string, never>>;
type FormAssignmentDbStatus = FormAssignmentRow["status"];

type FormAssignmentOrgRow = Prisma.FormAssignmentGetPayload<{
  include: {
    template: {
      select: {
        id: true;
        name: true;
      };
    };
    companion: {
      select: {
        id: true;
        name: true;
      };
    };
    appointment: {
      select: {
        patient: true;
      };
    };
  };
}>;

type FormSubmissionRow = Prisma.FormSubmissionGetPayload<{
  select: {
    id: true;
    formId: true;
    formVersion: true;
    appointmentId: true;
    patientId: true;
    parentId: true;
    submittedAt: true;
    signing: true;
  };
}>;

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

const resolvePatientSpecies = (patient: unknown): string | undefined =>
  getNestedString(patient, ["species"]) ??
  getNestedString(patient, ["speciesName"]) ??
  getNestedString(patient, ["type"]);

const resolveAppointmentParent = (patient: unknown) => ({
  parentId: getNestedString(patient, ["parent", "id"]) ?? null,
  parentName: getNestedString(patient, ["parent", "name"]) ?? null,
});

const resolveAppointmentCompanion = (patient: unknown) => ({
  companionId: resolvePatientId(patient) ?? null,
  companionName: getNestedString(patient, ["name"]) ?? null,
});

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
  status: string,
): FormAssignmentLike["status"] => {
  switch (status.toUpperCase()) {
    case "DRAFT":
      return "draft" as FormAssignmentLike["status"];
    case "SENT":
      return "sent" as FormAssignmentLike["status"];
    case "VIEWED":
      return "viewed" as FormAssignmentLike["status"];
    case "SUBMITTED":
      return "submitted" as FormAssignmentLike["status"];
    case "SIGNED":
      return "signed" as FormAssignmentLike["status"];
    case "EXPIRED":
      return "expired" as FormAssignmentLike["status"];
    case "CANCELLED":
      return "cancelled" as FormAssignmentLike["status"];
    default:
      return "draft" as FormAssignmentLike["status"];
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

const isUppercaseAssignmentStatus = (
  value: string,
): value is PrismaFormAssignmentStatus => {
  switch (value) {
    case "DRAFT":
    case "SENT":
    case "VIEWED":
    case "SUBMITTED":
    case "SIGNED":
    case "EXPIRED":
    case "CANCELLED":
      return true;
    default:
      return false;
  }
};

const normalizeLifecycleAssignmentStatus = (
  status: string,
): FormAssignmentListItem["status"] => {
  switch (status.toUpperCase()) {
    case "DRAFT":
      return "DRAFT" as FormAssignmentListItem["status"];
    case "SENT":
      return "SENT" as FormAssignmentListItem["status"];
    case "VIEWED":
      return "VIEWED" as FormAssignmentListItem["status"];
    case "SUBMITTED":
      return "SUBMITTED" as FormAssignmentListItem["status"];
    case "SIGNED":
      return "SIGNED" as FormAssignmentListItem["status"];
    case "EXPIRED":
      return "EXPIRED" as FormAssignmentListItem["status"];
    case "CANCELLED":
      return "CANCELLED" as FormAssignmentListItem["status"];
    default:
      return "DRAFT" as FormAssignmentListItem["status"];
  }
};

const normalizeOrganisationListStatuses = (
  status?: string,
): PrismaFormAssignmentStatus[] | undefined => {
  if (!status) return undefined;

  const resolved = status
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  if (!resolved.length) return undefined;

  for (const value of resolved) {
    if (!isUppercaseAssignmentStatus(value)) {
      throw new FormAssignmentServiceError("Invalid assignment status", 400);
    }
  }

  return [...new Set(resolved)] as PrismaFormAssignmentStatus[];
};

const buildAssignmentKey = (params: {
  templateId: string;
  templateVersion: number;
  appointmentId: string | null;
  companionId: string | null;
  parentId: string | null;
}) =>
  [
    params.templateId,
    params.templateVersion,
    params.appointmentId ?? "",
    params.companionId ?? "",
    params.parentId ?? "",
  ].join(":");

const buildSubmissionKey = (params: {
  formId: string;
  formVersion: number;
  appointmentId: string | null;
  companionId: string | null;
  parentId: string | null;
}) =>
  buildAssignmentKey({
    templateId: params.formId,
    templateVersion: params.formVersion,
    appointmentId: params.appointmentId,
    companionId: params.companionId,
    parentId: params.parentId,
  });

const extractSignedDocument = (signing: Prisma.JsonValue | null) => {
  if (!signing || typeof signing !== "object" || Array.isArray(signing)) {
    return null;
  }

  const status = (signing as Record<string, unknown>).status;
  if (status !== "SIGNED") {
    return null;
  }

  const documentId = (signing as Record<string, unknown>).documentId;
  const pdf = (signing as Record<string, unknown>).pdf;
  const pdfUrl =
    pdf &&
    typeof pdf === "object" &&
    !Array.isArray(pdf) &&
    typeof (pdf as Record<string, unknown>).url === "string"
      ? ((pdf as Record<string, unknown>).url as string)
      : null;

  return typeof documentId === "string" ? { documentId, pdfUrl } : null;
};

const toOrganisationListItem = (
  row: FormAssignmentOrgRow,
  signedDocument: { documentId: string; pdfUrl: string | null } | null,
): FormAssignmentListItem => {
  const patient = row.appointment?.patient;
  const appointmentParent = resolveAppointmentParent(patient);
  const appointmentCompanion = resolveAppointmentCompanion(patient);

  return {
    id: row.id,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    templateName: row.template?.name ?? "",
    templateTitle: row.template?.name ?? "",
    companionId: row.companionId ?? appointmentCompanion.companionId,
    companionName:
      row.companion?.name ?? appointmentCompanion.companionName ?? null,
    parentId: appointmentParent.parentId ?? null,
    parentName: appointmentParent.parentName ?? null,
    appointmentId: row.appointmentId,
    status: normalizeLifecycleAssignmentStatus(row.status),
    signingRequired: row.signingRequired,
    mobileVisible: row.mobileVisible,
    sentAt: row.sentAt,
    viewedAt: row.viewedAt,
    submittedAt: row.submittedAt,
    signedAt: row.signedAt,
    expiredAt: row.expiredAt,
    cancelledAt: row.cancelledAt,
    signedDocument,
  };
};

const buildSubmissionDocumentMap = (
  rows: FormSubmissionRow[],
): Map<string, { documentId: string; pdfUrl: string | null }> => {
  const map = new Map<string, { documentId: string; pdfUrl: string | null }>();

  for (const row of rows) {
    const signedDocument = extractSignedDocument(row.signing);
    if (!signedDocument) {
      continue;
    }

    const key = buildSubmissionKey({
      formId: row.formId,
      formVersion: row.formVersion,
      appointmentId: row.appointmentId,
      companionId: row.patientId,
      parentId: row.parentId,
    });

    if (!map.has(key)) {
      map.set(key, signedDocument);
    }
  }

  return map;
};

const findAssignmentForSubmission = async (params: {
  organisationId: string;
  templateId: string;
  templateVersion: number;
  appointmentId?: string | null;
  companionId?: string | null;
  parentId?: string | null;
}) => {
  const assignments = await prisma.formAssignment.findMany({
    where: {
      organisationId: params.organisationId,
      templateId: params.templateId,
      templateVersion: params.templateVersion,
      ...(params.appointmentId ? { appointmentId: params.appointmentId } : {}),
      ...(params.companionId ? { companionId: params.companionId } : {}),
    },
    include: {
      appointment: {
        select: {
          patient: true,
        },
      },
    },
  });

  if (!assignments.length) {
    return null;
  }

  if (!params.parentId) {
    return assignments[0] ?? null;
  }

  return (
    assignments.find((assignment) => {
      const parentId = getNestedString(assignment.appointment?.patient, [
        "parent",
        "id",
      ]);
      return parentId === params.parentId;
    }) ?? null
  );
};

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
      productItemId: true,
      appointmentKind: true,
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

const isSubmittableAssignmentStatus = (status: FormAssignmentDbStatus) =>
  status === "SENT" || status === "VIEWED";

const isSignableAssignmentStatus = (status: FormAssignmentDbStatus) =>
  status === "SENT" || status === "VIEWED" || status === "SUBMITTED";

const AUTO_ASSIGN_TEMPLATE_KINDS: Array<"FORM" | "CONSENT"> = [
  "FORM",
  "CONSENT",
];

const syncLinkedTemplateAssignmentsForAppointment = async (params: {
  organisationId: string;
  appointmentId: string;
}) => {
  const appointment = await loadAppointment(
    params.organisationId,
    params.appointmentId,
  );

  if (!appointment.productItemId) {
    return;
  }

  const species = resolvePatientSpecies(appointment.patient);
  const resolveInput = {
    organisationId: params.organisationId,
    appointmentId: appointment.id,
    encounterId: appointment.encounterId ?? undefined,
    serviceId: appointment.productItemId,
    species,
  };

  for (const kind of AUTO_ASSIGN_TEMPLATE_KINDS) {
    try {
      const resolved = await TemplateService.resolve({
        ...resolveInput,
        kind,
      });

      const existing = await prisma.formAssignment.findFirst({
        where: {
          organisationId: params.organisationId,
          appointmentId: appointment.id,
          templateId: resolved.templateId,
        },
        select: { id: true },
      });

      if (existing) {
        continue;
      }

      await FormAssignmentService.createForAppointment({
        organisationId: params.organisationId,
        appointmentId: appointment.id,
        templateId: resolved.templateId,
        templateVersion: resolved.templateVersion,
        createdBy: "SYSTEM",
      });
    } catch {
      continue;
    }
  }
};

export const FormAssignmentService = {
  syncLinkedTemplateAssignmentsForAppointment:
    syncLinkedTemplateAssignmentsForAppointment,
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

  async listForOrganisation(params: {
    organisationId: string;
    parentId?: string;
    companionId?: string;
    status?: string;
  }): Promise<FormAssignmentListItem[]> {
    const statuses = normalizeOrganisationListStatuses(params.status);

    const rows = await prisma.formAssignment.findMany({
      where: {
        organisationId: params.organisationId,
        ...(params.companionId ? { companionId: params.companionId } : {}),
        ...(statuses ? { status: { in: statuses } } : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: {
        template: {
          select: {
            id: true,
            name: true,
          },
        },
        companion: {
          select: {
            id: true,
            name: true,
          },
        },
        appointment: {
          select: {
            patient: true,
          },
        },
      },
    });

    const filteredRows = params.parentId
      ? rows.filter((row) => {
          const parentId = getNestedString(row.appointment?.patient, [
            "parent",
            "id",
          ]);
          return parentId === params.parentId;
        })
      : rows;

    const formIds = [...new Set(filteredRows.map((row) => row.templateId))];
    const appointmentIds = [
      ...new Set(
        filteredRows
          .map((row) => row.appointmentId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const submissions =
      formIds.length && appointmentIds.length
        ? await prisma.formSubmission.findMany({
            where: {
              formId: { in: formIds },
              appointmentId: { in: appointmentIds },
            },
            select: {
              id: true,
              formId: true,
              formVersion: true,
              appointmentId: true,
              patientId: true,
              parentId: true,
              submittedAt: true,
              signing: true,
            },
            orderBy: [{ submittedAt: "desc" }],
          })
        : [];

    const submissionDocuments = buildSubmissionDocumentMap(submissions);

    return filteredRows.map((row) => {
      const key = buildSubmissionKey({
        formId: row.templateId,
        formVersion: row.templateVersion,
        appointmentId: row.appointmentId,
        companionId:
          row.companionId ??
          getNestedString(row.appointment?.patient, ["id"]) ??
          null,
        parentId:
          getNestedString(row.appointment?.patient, ["parent", "id"]) ?? null,
      });

      return toOrganisationListItem(row, submissionDocuments.get(key) ?? null);
    });
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

  async markViewedForAppointment(params: {
    organisationId: string;
    appointmentId: string;
  }) {
    await prisma.formAssignment.updateMany({
      where: {
        organisationId: params.organisationId,
        appointmentId: params.appointmentId,
        status: "SENT",
      },
      data: {
        status: "VIEWED",
        viewedAt: new Date(),
      },
    });
  },

  async markSubmittedFromSubmission(params: {
    organisationId: string;
    templateId: string;
    templateVersion: number;
    appointmentId?: string | null;
    companionId?: string | null;
    parentId?: string | null;
    submittedAt?: Date;
  }) {
    const assignment = await findAssignmentForSubmission({
      organisationId: params.organisationId,
      templateId: params.templateId,
      templateVersion: params.templateVersion,
      appointmentId: params.appointmentId,
      companionId: params.companionId,
      parentId: params.parentId,
    });

    if (!assignment) {
      return null;
    }

    if (!isSubmittableAssignmentStatus(assignment.status)) {
      return assignment;
    }

    return prisma.formAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "SUBMITTED",
        submittedAt: params.submittedAt ?? new Date(),
        updatedAt: new Date(),
      },
    });
  },

  async markSignedFromSubmission(params: {
    organisationId: string;
    templateId: string;
    templateVersion: number;
    appointmentId?: string | null;
    companionId?: string | null;
    parentId?: string | null;
  }) {
    const assignment = await findAssignmentForSubmission({
      organisationId: params.organisationId,
      templateId: params.templateId,
      templateVersion: params.templateVersion,
      appointmentId: params.appointmentId,
      companionId: params.companionId,
      parentId: params.parentId,
    });

    if (!assignment) {
      return null;
    }

    if (!isSignableAssignmentStatus(assignment.status)) {
      return assignment;
    }

    return prisma.formAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "SIGNED",
        signedAt: new Date(),
        updatedAt: new Date(),
      },
    });
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
