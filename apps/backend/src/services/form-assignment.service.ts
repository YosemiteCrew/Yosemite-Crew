import {
  Prisma,
  TemplateKind,
  FormAssignmentStatus as PrismaFormAssignmentStatus,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "src/config/prisma";
import { TemplateService } from "src/services/template.service";
import { hasCompanionFeature } from "src/middlewares/companion-access";
import {
  instanceNeedsClientSignature,
  lockClientRequest,
  templateNeedsClientSignature,
} from "src/services/client-signature.helpers";
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
    email: z.string().trim().pipe(z.email()).optional(),
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
      return "sent";
    case "VIEWED":
      return "viewed";
    case "SUBMITTED":
      return "submitted";
    case "SIGNED":
      return "signed";
    case "EXPIRED":
      return "expired";
    case "CANCELLED":
      return "cancelled";
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
      return "SENT";
    case "VIEWED":
      return "VIEWED";
    case "SUBMITTED":
      return "SUBMITTED";
    case "SIGNED":
      return "SIGNED";
    case "EXPIRED":
      return "EXPIRED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "DRAFT" as FormAssignmentListItem["status"];
  }
};

// The organisation list endpoint has no pagination parameters and its callers expect the
// whole result set, so this is a backstop against an unbounded scan rather than a page
// size: high enough that no real organisation reaches it, finite so one cannot be used to
// materialise an arbitrarily large result.
const ORGANISATION_LIST_MAX_ROWS = 500;

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
  // When the answers were given: a request sent after them is not theirs.
  answeredAt?: Date;
}) => {
  // With an appointment the template identifies the assignment on its own. A
  // template published again after it was sent submits at the newer version,
  // and matching on the version as well left that assignment open for good.
  // A request withdrawn or lapsed is never the one a submission answers.
  const found = await prisma.formAssignment.findMany({
    where: {
      organisationId: params.organisationId,
      templateId: params.templateId,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      ...(params.answeredAt ? { createdAt: { lte: params.answeredAt } } : {}),
      ...(params.appointmentId
        ? { appointmentId: params.appointmentId }
        : { templateVersion: params.templateVersion }),
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

  if (!found.length) {
    return null;
  }

  // The assignment sent at the submitted version first.
  const assignments = [
    ...found.filter((row) => row.templateVersion === params.templateVersion),
    ...found.filter((row) => row.templateVersion !== params.templateVersion),
  ];

  // On an appointment the request is the appointment's, whichever parent
  // (a co-parent included) submitted it; access was checked on the way in.
  if (!params.parentId || params.appointmentId) {
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

// The kinds a client can be asked to fill in. CONSENT became a storage kind of
// its own (1c3c790f0), so a FORM-only lookup refused every consent template.
const ASSIGNABLE_TEMPLATE_KINDS = [TemplateKind.FORM, TemplateKind.CONSENT];

const ensureTemplate = async (
  organisationId: string,
  templateId: string,
  templateVersion?: number,
) => {
  const template = await prisma.template.findFirst({
    where: {
      id: templateId,
      organisationId,
      kind: { in: ASSIGNABLE_TEMPLATE_KINDS },
    },
    select: {
      id: true,
      kind: true,
      rules: true,
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

  return { ...version, clientSigns: templateNeedsClientSignature(template) };
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

/**
 * A request may name the parent who signs it: one with an ACTIVE link to the
 * appointment's companion who may act on its appointments. Where the client
 * signs the form, a co-parent also needs the medical records permission, since
 * they sign the answers the practice gives. Anyone else is refused.
 */
const ensureNamedSigner = async (
  signerId: string,
  companionId: string | undefined,
  clientSigns: boolean,
) => {
  const link = companionId
    ? await prisma.parentPatient.findFirst({
        where: {
          parentId: signerId,
          patientId: companionId,
          status: "ACTIVE",
          role: { in: ["PRIMARY", "CO_PARENT"] },
        },
        select: { role: true, permissions: true },
      })
    : null;
  const allowed =
    !!link &&
    hasCompanionFeature(link.role, link.permissions, "appointments") &&
    (!clientSigns ||
      hasCompanionFeature(link.role, link.permissions, "medicalRecords"));
  if (!allowed) {
    throw new FormAssignmentServiceError(
      "The signer must be a parent of the companion who may sign it",
      400,
    );
  }
};

const ensureAssignment = async (
  assignmentId: string,
  organisationId: string,
  client: Pick<Prisma.TransactionClient, "formAssignment"> = prisma,
) => {
  const assignment = await client.formAssignment.findFirst({
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

const SUBMITTABLE_STATUSES: FormAssignmentDbStatus[] = ["SENT", "VIEWED"];
const SIGNABLE_STATUSES: FormAssignmentDbStatus[] = [
  "SENT",
  "VIEWED",
  "SUBMITTED",
];
// Every status but CANCELLED, SIGNED and EXPIRED (ensureResendable).
const RESENDABLE_STATUSES: FormAssignmentDbStatus[] = [
  "DRAFT",
  "SENT",
  "VIEWED",
  "SUBMITTED",
];

const isSubmittableAssignmentStatus = (status: FormAssignmentDbStatus) =>
  SUBMITTABLE_STATUSES.includes(status);

const isSignableAssignmentStatus = (status: FormAssignmentDbStatus) =>
  SIGNABLE_STATUSES.includes(status);

/**
 * Moves a request on, only from the statuses it may move from, in one write:
 * a cancel or signature that lands between reading the request and writing it
 * stands instead of being overwritten. `null` when it had moved on meanwhile.
 */
const moveAssignment = async (
  id: string,
  from: FormAssignmentDbStatus[],
  data: Prisma.FormAssignmentUpdateInput,
): Promise<FormAssignmentRow | null> => {
  try {
    return await prisma.formAssignment.update({
      where: { id, status: { in: from } },
      data,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
};

/**
 * Materialise the form/consent assignments a linked template implies for an
 * appointment.
 *
 * `canManageForms` is REQUIRED and gates the writes. This runs from read flows -
 * workspace bootstrap, appointment document retrieval, the appointment form
 * listing - which are authorised on `document:view:any` or the equivalent, while
 * creating an assignment is a `forms:edit:any` action. Without the gate, merely
 * OPENING an appointment persisted client-visible consent requests
 * (`mobileVisible`, `signingRequired`, status SENT) on a viewer's behalf, and
 * those can block finalisation. Read-only callers now see the assignments that
 * exist without creating any.
 */
const syncLinkedTemplateAssignmentsForAppointment = async (params: {
  organisationId: string;
  appointmentId: string;
  canManageForms: boolean;
}) => {
  if (!params.canManageForms) {
    return;
  }

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

  for (const kind of ASSIGNABLE_TEMPLATE_KINDS) {
    try {
      const resolved = await TemplateService.resolve({
        ...resolveInput,
        kind,
      });

      // Any request already made for the template, a withdrawn one included,
      // is left as it is. A concurrent sync that creates it first is handed
      // back that request by the create.
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

    // The signer is checked against the appointment's own companion, never
    // one the caller names.
    if (parsed.signerIdentity?.userId) {
      await ensureNamedSigner(
        parsed.signerIdentity.userId,
        resolvePatientId(appointment.patient),
        version.clientSigns,
      );
    }

    const createdBy = parsed.createdBy;
    const request = {
      organisationId: parsed.organisationId,
      templateId: version.templateId,
      appointmentId: appointment.id,
    };

    // One request per form on an appointment: sending a form the client
    // already has open hands back that request instead of a second copy.
    return prisma.$transaction(async (tx) => {
      await lockClientRequest(tx, request);
      const open = await tx.formAssignment.findFirst({
        where: { ...request, status: { notIn: ["CANCELLED", "EXPIRED"] } },
      });
      if (open) return toAssignmentLike(open);

      const row = await tx.formAssignment.create({
        data: {
          ...request,
          templateVersion: version.version,
          encounterId: appointment.encounterId ?? undefined,
          companionId,
          signerUserId: parsed.signerIdentity?.userId ?? undefined,
          signerName: parsed.signerIdentity?.name ?? undefined,
          signerEmail: parsed.signerIdentity?.email ?? undefined,
          signerRole: parsed.signerIdentity?.role ?? undefined,
          mobileVisible: parsed.mobileVisible ?? true,
          // The client is asked to sign only what the template says they sign.
          signingRequired: parsed.signingRequired ?? version.clientSigns,
          status: "SENT",
          sentAt: new Date(),
          createdBy,
          updatedBy: createdBy,
        },
      });

      return toAssignmentLike(row);
    });
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
        // Appointment.patient is a Json column; matching the parent here keeps the filter
        // in the database rather than materialising every assignment in the organisation
        // and discarding most of them after the fact.
        ...(params.parentId
          ? {
              appointment: {
                is: {
                  patient: {
                    path: ["parent", "id"],
                    equals: params.parentId,
                  },
                },
              },
            }
          : {}),
      },
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      take: ORGANISATION_LIST_MAX_ROWS,
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

    const formIds = [...new Set(rows.map((row) => row.templateId))];
    const appointmentIds = [
      ...new Set(
        rows
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

    return rows.map((row) => {
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
    const row = await moveAssignment(assignment.id, RESENDABLE_STATUSES, {
      status: "SENT",
      sentAt: now,
      updatedBy,
      updatedAt: now,
    });
    // Signed, cancelled or lapsed since it was read.
    if (!row) {
      throw new FormAssignmentServiceError(
        "Assignment can no longer be resent",
        409,
      );
    }

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
    answeredAt?: Date;
  }) {
    const assignment = await findAssignmentForSubmission({
      organisationId: params.organisationId,
      templateId: params.templateId,
      templateVersion: params.templateVersion,
      appointmentId: params.appointmentId,
      companionId: params.companionId,
      parentId: params.parentId,
      answeredAt: params.answeredAt,
    });

    if (!assignment) {
      return null;
    }

    if (!isSubmittableAssignmentStatus(assignment.status)) {
      return assignment;
    }

    return (
      (await moveAssignment(assignment.id, SUBMITTABLE_STATUSES, {
        status: "SUBMITTED",
        submittedAt: params.submittedAt ?? new Date(),
        updatedAt: new Date(),
      })) ?? assignment
    );
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

    return (
      (await moveAssignment(assignment.id, SIGNABLE_STATUSES, {
        status: "SIGNED",
        signedAt: new Date(),
        updatedAt: new Date(),
      })) ?? assignment
    );
  },

  async cancel(
    assignmentId: string,
    organisationId: string,
    updatedBy: string,
  ) {
    const found = await ensureAssignment(assignmentId, organisationId);

    // Under the lock a signature completing on the request takes, so the two
    // never interleave: a cancel sees the request as signed, or the signature
    // sees it cancelled. The status read is the one the write is made on.
    return prisma.$transaction(async (tx) => {
      if (found.appointmentId) {
        await lockClientRequest(tx, {
          organisationId: found.organisationId,
          templateId: found.templateId,
          appointmentId: found.appointmentId,
        });
      }
      const assignment = await ensureAssignment(
        assignmentId,
        organisationId,
        tx,
      );
      if (normalizeAssignmentStatus(assignment.status) === "cancelled") {
        return toAssignmentLike(assignment);
      }
      ensureCancellable(normalizeAssignmentStatus(assignment.status));

      const now = new Date();
      try {
        const row = await tx.formAssignment.update({
          where: { id: assignment.id, status: assignment.status },
          data: {
            status: "CANCELLED",
            cancelledAt: now,
            updatedBy,
            updatedAt: now,
          },
        });
        return toAssignmentLike(row);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2025"
        ) {
          throw new FormAssignmentServiceError(
            "Assignment changed while it was being cancelled",
            409,
          );
        }
        throw error;
      }
    });
  },

  async listAppointmentFormSummaries(
    organisationId: string,
    appointmentId: string,
  ): Promise<WorkspaceFormRow[]> {
    const assignments = await FormAssignmentService.listForAppointment(
      organisationId,
      appointmentId,
    );
    const clientSigns = await loadClientSignedTemplateIds(
      assignments.map(({ templateId }) => templateId),
      { organisationId, appointmentId },
    );

    return assignments.map((assignment) => {
      const effective = {
        ...assignment,
        signingRequired:
          assignment.signingRequired && clientSigns.has(assignment.templateId),
      };
      return {
        ...effective,
        status: isCompleted(effective) ? "completed" : "pending",
        assignmentStatus: assignment.status,
      };
    });
  },
};

/**
 * The templates among these whose forms the client signs on the appointment.
 * A request asks for a signature only where the form does: requests saved
 * when every one asked for a signature still complete on submission for any
 * other form. Once a form is submitted, who signs is the one pinned with the
 * latest submission, so a later edit to its template changes nothing.
 */
export const loadClientSignedTemplateIds = async (
  templateIds: string[],
  appointment: { organisationId: string; appointmentId: string },
): Promise<Set<string>> => {
  if (!templateIds.length) return new Set();
  const ids = [...new Set(templateIds)];
  const [templates, submitted] = await Promise.all([
    prisma.template.findMany({
      where: { id: { in: ids } },
      select: { id: true, kind: true, rules: true },
    }),
    prisma.templateInstance.findMany({
      where: {
        organisationId: appointment.organisationId,
        appointmentId: appointment.appointmentId,
        templateId: { in: ids },
        status: { in: ["COMPLETED", "SIGNED"] },
      },
      select: { templateId: true, generatedPdf: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const latestSubmission = new Map<string, unknown>();
  for (const instance of submitted) {
    if (!latestSubmission.has(instance.templateId)) {
      latestSubmission.set(instance.templateId, instance.generatedPdf);
    }
  }
  return new Set(
    templates
      .filter((template) =>
        latestSubmission.has(template.id)
          ? instanceNeedsClientSignature({
              generatedPdf: latestSubmission.get(template.id),
              template,
            })
          : templateNeedsClientSignature(template),
      )
      .map(({ id }) => id),
  );
};

const isCompleted = (assignment: FormAssignmentLike) =>
  assignment.status === "signed" ||
  assignment.status === "cancelled" ||
  assignment.status === "expired" ||
  (!assignment.signingRequired && assignment.status === "submitted");
