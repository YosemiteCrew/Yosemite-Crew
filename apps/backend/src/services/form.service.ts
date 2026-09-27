import { FormSubmissionDocument } from "src/models/form";

import {
  Form,
  FormField,
  FormSubmission,
  FormRequestDTO,
  toFormResponseDTO,
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
  FormSubmissionRequestDTO,
  toFHIRQuestionnaireResponse,
  toFHIRQuestionnaire,
  templateSchemaToFormFields,
  type TemplateLike,
} from "@yosemite-crew/types";
import { templateMapper } from "src/services/fhir-template.mapper";
import { buildPdfViewModel, renderPdf } from "./formPDF.service";
import { FormAssignmentService } from "src/services/form-assignment.service";
import { assertPatientOrgMembership } from "src/services/shared/patient-org-membership";
import logger from "src/utils/logger";
import { DocumensoService } from "./documenso.service";
import { AuditTrailService } from "./audit-trail.service";
import {
  FormRequiredSigner as PrismaFormRequiredSigner,
  FormStatus as PrismaFormStatus,
  FormVisibilityType as PrismaFormVisibilityType,
  OrganizationType as PrismaOrganizationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { TemplateService } from "src/services/template.service";
import {
  type CompanionFeature,
  hasCompanionFeature,
  parentHasCompanionFeature,
} from "src/middlewares/companion-access";

export class FormServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FormServiceError";
  }
}

type CompanionFormSubmission = {
  id: string;
  formId: string;
  formVersion: number;
  appointmentId?: string;
  patientId?: string;
  submittedBy?: string;
  submittedAt: Date;
  answers: Record<string, unknown>;
  signing?: NonNullable<FormSubmissionDocument["signing"]>;
  formName?: string | null;
  formCategory?: string | null;
};

const ensureId = (id: string, label: string): string => {
  const trimmed = (id ?? "").trim();
  if (!trimmed) throw new FormServiceError(`Invalid ${label}`, 400);
  return trimmed;
};

// A form of another organisation is answered the same way as a missing one.
const loadFormInOrganisation = async (
  formId: string,
  orgId: string | undefined,
) => {
  const form = await prisma.form.findFirst({
    where: {
      id: ensureId(formId, "formId"),
      orgId: ensureId(orgId ?? "", "orgId"),
    },
  });
  if (!form) throw new FormServiceError("Form not found", 404);
  return form;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);

const coerceFormFields = (schema: unknown): FormField[] => {
  if (!Array.isArray(schema)) return [];
  return schema.filter((value): value is FormField => isPlainObject(value));
};

const isSigningInfo = (
  value: unknown,
): value is NonNullable<FormSubmissionDocument["signing"]> => {
  if (!isPlainObject(value)) return false;
  return (
    typeof value.required === "boolean" &&
    typeof value.status === "string" &&
    typeof value.provider === "string"
  );
};

const normalizeServiceIdArray = (serviceId: Form["serviceId"]): string[] => {
  if (Array.isArray(serviceId)) return serviceId;
  if (typeof serviceId === "string" && serviceId.trim().length > 0) {
    return [serviceId];
  }
  return [];
};

const ensureNonEmptyString = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FormServiceError(`Invalid ${label}`, 400);
  }
  return value.trim();
};

type AppointmentLookupRecord = {
  organisationId: string;
  formIds?: string[];
  patient?: unknown;
};

type AppointmentLookupResult = {
  appointment: AppointmentLookupRecord;
};

const normalizeAppointmentId = (appointmentId: string) =>
  ensureNonEmptyString(appointmentId, "appointmentId");

const loadAppointmentForFormsRecord = async (
  appointmentId: string,
): Promise<AppointmentLookupResult | null> => {
  const normalizedId = normalizeAppointmentId(appointmentId);

  const postgresAppointment = await prisma.appointment.findUnique({
    where: { id: normalizedId },
    select: { organisationId: true, formIds: true, patient: true },
  });
  if (!postgresAppointment) {
    return null;
  }

  return {
    appointment: postgresAppointment,
  };
};

const buildDisplayName = (
  profile?: { firstName?: string; lastName?: string } | null,
): string | null => {
  if (!profile) return null;
  const parts = [profile.firstName, profile.lastName].filter(Boolean);
  return parts.length ? parts.join(" ") : null;
};

const resolveUserNameMap = async (userIds: string[]) => {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (!uniqueIds.length) return new Map<string, string>();

  const users = await prisma.user.findMany({
    where: { userId: { in: uniqueIds } },
    select: { userId: true, firstName: true, lastName: true },
  });

  const map = new Map<string, string>();
  for (const user of users) {
    const displayName = buildDisplayName({
      firstName: user.firstName ?? undefined,
      lastName: user.lastName ?? undefined,
    });
    if (displayName) {
      map.set(user.userId, displayName);
    }
  }

  return map;
};

const applyUserNamesToForm = <
  T extends { createdBy: string; updatedBy: string },
>(
  form: T,
  nameMap: Map<string, string>,
) => ({
  ...form,
  createdBy: nameMap.get(form.createdBy) ?? form.createdBy,
  updatedBy: nameMap.get(form.updatedBy) ?? form.updatedBy,
});

type OrganizationType = "HOSPITAL" | "BREEDER" | "BOARDER" | "GROOMER";

const ORG_TYPE_CACHE_TTL_MS = 5 * 60 * 1000;
const orgTypeCache = new Map<
  string,
  { type: OrganizationType; expiresAt: number }
>();

type LeanForm = Omit<Form, "_id"> & { _id: string };
type VersionAgg = {
  _id: string;
  formId: string;
  schemaSnapshot: FormField[];
  version: number;
};
type SubmissionAgg = Omit<FormSubmissionDocument, "_id" | "formId"> & {
  _id: string;
  formId: string;
  // A submission the viewing parent may not read, listed only as answered.
  hidden?: boolean;
};
type AppointmentLean = {
  organisationId: string;
  formIds?: string[];
};

const SOAP_CATEGORIES = [
  "SOAP-Subjective",
  "SOAP-Objective",
  "SOAP-Assessment",
  "SOAP-Plan",
  "Discharge",
];

// A form kept internal is never shown to a pet parent.
const isInternalForm = (form: { visibilityType?: string | null }) =>
  form.visibilityType === "Internal";

// Forms only the practice fills in: the SOAP sections, the discharge summary
// and any form kept internal.
export const isPracticeOnlyForm = (form: {
  category: string;
  visibilityType?: string | null;
}) => SOAP_CATEGORIES.includes(form.category) || isInternalForm(form);

// Template kinds a pet parent fills in; every other kind is the practice's.
const PARENT_TEMPLATE_KINDS = new Set(["FORM", "CONSENT"]);

// Which of these user ids are pet parents.
const loadParentIds = async (ids: (string | null)[]) => {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  if (!unique.length) return new Set<string>();
  const rows = await prisma.parent.findMany({
    where: { id: { in: unique } },
    select: { id: true },
  });
  return new Set(rows.map((row) => row.id));
};

const resolveOrganizationType = async (
  organisationId: string,
): Promise<OrganizationType | null> => {
  const cached = orgTypeCache.get(organisationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.type;
  }

  const organisation = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: { type: true },
  });

  if (!organisation?.type) {
    return null;
  }

  orgTypeCache.set(organisationId, {
    type: organisation.type,
    expiresAt: Date.now() + ORG_TYPE_CACHE_TTL_MS,
  });

  return organisation.type;
};

const fetchTemplateForms = async (
  orgType: OrganizationType | null,
  appointment: AppointmentLean,
  params: { serviceId?: string; species?: string },
): Promise<LeanForm[]> => {
  if (!orgType) return [];
  const where: Prisma.FormWhereInput = {
    orgId: appointment.organisationId,
    status: "published",
  };

  if (orgType === "HOSPITAL") {
    where.category = { in: SOAP_CATEGORIES };
  } else {
    where.businessType = orgType;
    where.category = { notIn: SOAP_CATEGORIES };
  }

  if (params.serviceId) {
    where.serviceId = { has: params.serviceId };
  }

  if (params.species) {
    where.speciesFilter = { has: params.species };
  }

  const forms = await prisma.form.findMany({ where });
  return forms.map(mapPrismaFormToLeanForm);
};

const mapPrismaFormToLeanForm = (form: {
  id: string;
  orgId: string;
  businessType: PrismaOrganizationType | null;
  name: string;
  category: string;
  description: string | null;
  visibilityType: PrismaFormVisibilityType | null;
  serviceId: Form["serviceId"];
  speciesFilter: string[] | null;
  requiredSigner: PrismaFormRequiredSigner | null;
  status: PrismaFormStatus;
  schema: unknown;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}): LeanForm =>
  ({
    _id: form.id,
    orgId: form.orgId,
    businessType: form.businessType ?? undefined,
    name: form.name,
    category: form.category,
    description: form.description ?? undefined,
    visibilityType: normalizeVisibilityType(
      form.visibilityType ?? PrismaFormVisibilityType.External,
    ),
    serviceId: form.serviceId,
    speciesFilter: form.speciesFilter ?? undefined,
    requiredSigner: form.requiredSigner ?? undefined,
    status: form.status,
    schema: coerceFormFields(form.schema),
    createdBy: form.createdBy,
    updatedBy: form.updatedBy,
    createdAt: form.createdAt,
    updatedAt: form.updatedAt,
  }) satisfies LeanForm;

const fetchFormsByIds = async (formIds: Set<string>): Promise<LeanForm[]> => {
  if (!formIds.size) return [];
  const forms = await prisma.form.findMany({
    where: { id: { in: [...formIds] }, status: "published" },
  });
  return forms.map(mapPrismaFormToLeanForm);
};

const mergeFormsById = (formsById: LeanForm[], templateForms: LeanForm[]) => {
  const formMap = new Map<string, LeanForm>();
  for (const form of [...formsById, ...templateForms]) {
    formMap.set(form._id, form);
  }
  return [...formMap.values()];
};

const loadLatestVersions = async (
  forms: LeanForm[],
): Promise<Map<string, VersionAgg>> => {
  if (!forms.length) return new Map<string, VersionAgg>();
  const versions = await prisma.formVersion.findMany({
    where: { formId: { in: forms.map((f) => f._id) } },
    orderBy: [{ formId: "asc" }, { version: "desc" }],
  });

  const latest = new Map<string, VersionAgg>();
  for (const version of versions) {
    if (!latest.has(version.formId)) {
      latest.set(version.formId, {
        _id: version.id,
        formId: version.formId,
        version: version.version,
        schemaSnapshot: coerceFormFields(version.schemaSnapshot),
      });
    }
  }

  return latest;
};

// With `viewerParentId`, the latest per form among the submissions that parent
// may see (see `parentMaySeeSubmission`), or else the latest one, marked hidden.
const loadLatestSubmissions = async (
  appointmentId: string,
  forms: LeanForm[],
  viewerParentId?: string,
) => {
  if (!forms.length) return new Map<string, SubmissionAgg>();
  const submissions = await prisma.formSubmission.findMany({
    where: {
      appointmentId,
      formId: { in: forms.map((f) => f._id) },
    },
    orderBy: [{ formId: "asc" }, { submittedAt: "desc" }],
  });
  const links = viewerParentId
    ? await loadActiveCompanionLinks(viewerParentId)
    : [];

  const latest = new Map<string, SubmissionAgg>();
  for (const submission of submissions) {
    const hidden =
      !!viewerParentId && !parentMaySeeSubmission(submission, links);
    const current = latest.get(submission.formId);
    if (!current || (current.hidden && !hidden)) {
      latest.set(submission.formId, {
        ...submission,
        hidden,
        _id: submission.id,
        formId: submission.formId,
        parentId: submission.parentId ?? undefined,
        patientId: submission.patientId ?? undefined,
        appointmentId: submission.appointmentId ?? undefined,
        submittedBy: submission.submittedBy ?? undefined,
        answers:
          submission.answers && typeof submission.answers === "object"
            ? (submission.answers as Record<string, unknown>)
            : {},
        signing: isSigningInfo(submission.signing)
          ? submission.signing
          : undefined,
      });
    }
  }

  return latest;
};

const resolveSignedPdfUrl = async (
  submission: SubmissionAgg,
  orgId: string,
) => {
  if (!submission.signing?.documentId) return undefined;
  const documensoApiKey =
    (
      await prisma.organization.findUnique({
        where: { id: orgId },
        select: { documensoApiKey: true },
      })
    )?.documensoApiKey ?? null;
  if (!documensoApiKey) return undefined;
  return DocumensoService.downloadSignedDocument({
    documentId: Number.parseInt(submission.signing.documentId, 10),
    apiKey: documensoApiKey,
  });
};

// Signing details and the signed copy go to the parent a submission names
// when they filled it in or signed it.
const parentHoldsSigning = (submission: SubmissionAgg, parentId: string) =>
  submission.parentId === parentId &&
  (submission.submittedBy === parentId ||
    submission.signing?.signer?.role === "CLIENT");

const buildQuestionnaireResponse = async (
  submission: SubmissionAgg | undefined,
  version: VersionAgg,
  orgId: string,
  viewerParentId?: string,
) => {
  if (!submission) return undefined;
  // Any other parent sees only whether it needs, and has, a signature, and a
  // submission they may not read only as answered.
  if (
    viewerParentId &&
    (submission.hidden || !parentHoldsSigning(submission, viewerParentId))
  ) {
    const { signing } = submission;
    return toParentSubmissionResponse(
      submission.hidden
        ? { ...submission, id: submission._id, parentId: null, answers: {} }
        : { ...submission, id: submission._id },
      version.schemaSnapshot,
      signing && {
        required: signing.required,
        status: signing.status,
        provider: signing.provider,
      },
    );
  }
  const signedPdfUrl = await resolveSignedPdfUrl(submission, orgId);
  return toFHIRQuestionnaireResponse(
    {
      _id: submission._id,
      formId: submission.formId,
      formVersion: submission.formVersion,
      appointmentId: submission.appointmentId,
      patientId: submission.patientId,
      parentId: submission.parentId,
      submittedBy:
        viewerParentId && !isParentFilled(submission)
          ? undefined
          : submission.submittedBy,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
      signing: submission.signing
        ? {
            ...submission.signing,
            pdf: {
              url: signedPdfUrl?.downloadUrl, // 👈 dynamically injected
            },
          }
        : undefined,
    } satisfies FormSubmission,
    version.schemaSnapshot,
  );
};

const resolveSchemaForSubmission = async (
  submission: FormSubmission,
  providedSchema?: FormField[],
) => {
  if (providedSchema) return providedSchema;
  if (!submission.formId) return undefined;

  const formId = String(submission.formId);
  const formVersion = await prisma.formVersion.findFirst({
    where: {
      formId,
      version: submission.formVersion,
    },
    select: { schemaSnapshot: true },
  });
  if (formVersion?.schemaSnapshot) {
    return formVersion.schemaSnapshot as unknown as FormField[];
  }

  const templateVersion = await prisma.templateVersion.findFirst({
    where: {
      templateId: formId,
      version: submission.formVersion,
    },
    select: { schemaSnapshot: true },
  });
  if (templateVersion?.schemaSnapshot) {
    return templateSchemaToFormFields(
      templateVersion.schemaSnapshot as unknown as Parameters<
        typeof templateSchemaToFormFields
      >[0],
    );
  }

  return undefined;
};

const buildDefaultSubmissionSigning = (
  resolvedSchema?: FormField[],
): FormSubmissionDocument["signing"] | undefined => {
  const signingRequired = FormService.hasSignatureField(resolvedSchema);
  if (!signingRequired) return undefined;

  return {
    required: true,
    status: "NOT_STARTED" as const,
    provider: "DOCUMENSO" as const,
  };
};

const getTemplateOrUndefined = async (
  templateId: string,
): Promise<TemplateLike | undefined> => {
  try {
    return await TemplateService.getById(templateId);
  } catch (error) {
    const maybeServiceError = error as { statusCode?: number } | undefined;
    if (maybeServiceError?.statusCode === 404) return undefined;
    throw error;
  }
};

/**
 * The mobile submit route carries no organisation context, so the template id is
 * a bare identifier chosen by the caller. Submitting it creates (and completes)
 * a template instance inside the template's own organisation, which is a write
 * into whatever tenant owns that id. The parent must therefore be shown to have
 * been asked for this form before the instance is created.
 */
const assertTemplateSubmittableByParent = async (params: {
  organisationId: string;
  templateId: string;
  parentId: string;
  appointmentId?: string;
}) => {
  if (params.appointmentId) {
    const appointment = await prisma.appointment.findFirst({
      where: {
        id: params.appointmentId,
        organisationId: params.organisationId,
      },
      select: { patient: true },
    });

    if (!appointment) {
      throw new FormServiceError("Forbidden", 403);
    }
    await assertParentCanViewAppointment(appointment, params.parentId);

    // A form the practice filled in is signed by the parent, never replaced.
    const filled = await prisma.templateInstance.findMany({
      where: {
        organisationId: params.organisationId,
        appointmentId: params.appointmentId,
        templateId: params.templateId,
        status: { in: ["COMPLETED", "SIGNED"] },
      },
      select: { authorId: true },
    });
    const parentIds = await loadParentIds(filled.map((row) => row.authorId));
    if (filled.some((row) => !row.authorId || !parentIds.has(row.authorId))) {
      throw new FormServiceError("Forbidden", 403);
    }
  }

  // With an appointment the parent link is already proven above, so the
  // assignment only has to exist for it. Without one there is no such anchor and
  // the assignment itself must name the parent as the signer. Either way it
  // must have been sent to the app.
  const assignment = await prisma.formAssignment.findFirst({
    where: {
      organisationId: params.organisationId,
      templateId: params.templateId,
      status: { notIn: ["CANCELLED", "EXPIRED"] },
      mobileVisible: true,
      ...(params.appointmentId
        ? { appointmentId: params.appointmentId }
        : { signerUserId: params.parentId }),
    },
    select: { id: true },
  });

  if (!assignment) {
    throw new FormServiceError("Forbidden", 403);
  }
};

/**
 * Attach the submitted form to its appointment.
 *
 * `appointmentId` comes off the client's FHIR payload, so the write is
 * constrained to the appointment belonging to the FORM's own organisation.
 * Without that predicate a submission could push an arbitrary form id onto any
 * tenant's appointment, where it then shows up in that appointment's form list
 * as though the practice had assigned it. `updateMany` means a mismatch is a
 * no-op rather than an error - the submission itself is still recorded.
 */
const pushAppointmentFormIdInPostgres = async (
  appointmentId: string,
  formId: string,
  organisationId: string,
) => {
  await prisma.appointment.updateMany({
    where: { id: appointmentId, organisationId },
    data: {
      formIds: {
        push: formId,
      },
    },
  });
};

const recordFormSubmittedAuditTrailInPostgres = async (params: {
  patientId: string;
  parentId?: string;
  appointmentId?: string;
  formId: string;
  submissionId: string;
}) => {
  const form = await prisma.form.findUnique({
    where: { id: params.formId },
    select: { orgId: true, name: true },
  });

  if (!form?.orgId) return;

  await AuditTrailService.recordSafely({
    organisationId: form.orgId,
    patientId: params.patientId,
    eventType: "FORM_SUBMITTED",
    actorType: params.parentId ? "PARENT" : "SYSTEM",
    actorId: params.parentId ?? null,
    entityType: "FORM",
    entityId: params.formId,
    metadata: {
      submissionId: params.submissionId,
      appointmentId: params.appointmentId,
      formName: form.name,
    },
  });
};

const assertSoapAppointmentAccess = async (params: {
  appointment: { organisationId: string; patient?: unknown };
  requesterOrgId?: string;
  requesterParentId?: string;
}) => {
  if (
    params.requesterOrgId &&
    params.appointment.organisationId !== params.requesterOrgId
  ) {
    throw new FormServiceError(
      "Forbidden: appointment does not belong to this organisation",
      403,
    );
  }

  // SOAP and discharge notes are practice-authored clinical content.
  if (
    params.requesterParentId &&
    !(await parentHasCompanionFeature(
      params.requesterParentId,
      resolveAppointmentPatientId(params.appointment),
      "medicalRecords",
    ))
  ) {
    throw new FormServiceError("Appointment not found", 404);
  }
};

type SoapNoteType =
  "Subjective" | "Objective" | "Assessment" | "Plan" | "Discharge";

type SoapNoteEntry = {
  submissionId: string;
  formId: string;
  formVersion: number;
  submittedBy?: string;
  submittedAt: Date;
  answers: Record<string, unknown>;
};

type SoapNoteGroup = Record<SoapNoteType, SoapNoteEntry[]>;

const SOAP_TYPE_MAP: Record<Form["category"], SoapNoteType | undefined> = {
  "SOAP-Subjective": "Subjective",
  "SOAP-Objective": "Objective",
  "SOAP-Assessment": "Assessment",
  "SOAP-Plan": "Plan",
  Discharge: "Discharge",
};

const initSoapGroup = (): SoapNoteGroup => ({
  Subjective: [],
  Objective: [],
  Assessment: [],
  Plan: [],
  Discharge: [],
});

const loadSoapSubmissions = async (
  appointmentId: string,
): Promise<SoapNoteEntry[]> => {
  const rows = await prisma.formSubmission.findMany({
    where: { appointmentId },
    orderBy: { submittedAt: "desc" },
  });

  return rows.map((row) => ({
    submissionId: row.id,
    formId: row.formId,
    formVersion: row.formVersion,
    submittedBy: row.submittedBy ?? undefined,
    submittedAt: row.submittedAt,
    answers: (row.answers ?? {}) as Record<string, unknown>,
  }));
};

type SoapFormLookup = {
  formId: string;
  category: Form["category"];
};

const loadSoapFormLookup = async (formIds: string[]) => {
  if (!formIds.length) return new Map<string, SoapFormLookup>();

  const rows = await prisma.form.findMany({
    where: { id: { in: formIds } },
    select: { id: true, category: true },
  });

  return new Map(
    rows.map((row) => [row.id, { formId: row.id, category: row.category }]),
  );
};

const buildSoapNotes = (params: {
  submissions: SoapNoteEntry[];
  formLookup: Map<string, SoapFormLookup>;
  latestOnly?: boolean;
}) => {
  const grouped = initSoapGroup();

  for (const submission of params.submissions) {
    const form = params.formLookup.get(submission.formId);
    if (!form) continue;

    const soapType = SOAP_TYPE_MAP[form.category];
    if (!soapType) continue;

    grouped[soapType].push(submission);
  }

  if (params.latestOnly) {
    (Object.keys(grouped) as SoapNoteType[]).forEach((key) => {
      grouped[key] = grouped[key].slice(0, 1);
    });
  }

  return grouped;
};

const loadSubmissionFormIdStringsForAppointment = async (
  appointmentId: string,
) => {
  const submissionFormIds = await prisma.formSubmission.findMany({
    where: { appointmentId },
    select: { formId: true },
  });
  return submissionFormIds.map((entry) => entry.formId);
};

const buildAppointmentFormItems = async (params: {
  forms: LeanForm[];
  versionMap: Map<string, VersionAgg>;
  submissionMap: Map<string, SubmissionAgg>;
  includeQuestionnaire: boolean;
  viewerParentId?: string;
}) => {
  const items: {
    questionnaire?: ReturnType<typeof toFHIRQuestionnaire>;
    questionnaireResponse?: ReturnType<typeof toFHIRQuestionnaireResponse>;
    status: "completed" | "pending";
  }[] = [];

  for (const form of params.forms) {
    const formId = form._id;
    const version = params.versionMap.get(formId);
    if (!version) continue;

    const questionnaire = params.includeQuestionnaire
      ? toFHIRQuestionnaire({
          ...form,
          _id: formId,
        })
      : undefined;

    const submission = params.submissionMap.get(formId);
    // A parent cannot fill in a practice-only form, so one with nothing they
    // may read is left out rather than listed as pending. An internal form is
    // never listed to a parent.
    if (
      params.viewerParentId &&
      (isInternalForm(form) ||
        ((!submission || submission.hidden) && isPracticeOnlyForm(form)))
    ) {
      continue;
    }

    const questionnaireResponse = await buildQuestionnaireResponse(
      submission,
      version,
      form.orgId,
      params.viewerParentId,
    );

    items.push({
      ...(params.includeQuestionnaire ? { questionnaire } : {}),
      questionnaireResponse,
      status: questionnaireResponse ? "completed" : "pending",
    });
  }

  return items;
};

type AppointmentTemplateInstance = Prisma.TemplateInstanceGetPayload<
  Record<string, never>
>;

// What a parent sees of a template instance they may read: all of it when they
// filled it in or signed it, else the answers without the submitter or the
// generated PDF. One they may not read shows only that it is answered.
const templateInstanceForParent = (
  instance: AppointmentTemplateInstance,
  parentId: string,
  readable: boolean,
): AppointmentTemplateInstance => {
  if (
    readable &&
    (instance.authorId === parentId || instance.signedBy === parentId)
  ) {
    return instance;
  }
  const trimmed = {
    ...instance,
    authorId: null,
    generatedPdfUrl: null,
    generatedPdf: null,
  };
  return readable
    ? trimmed
    : { ...trimmed, data: {}, caseId: null, encounterId: null };
};

// The same rule as for form submissions: a co-parent reads a form a parent
// filled in with the appointments permission, which viewing the appointment
// already needs, and one the practice filled in with medical records.
const templateInstancesForParent = async (
  instances: AppointmentTemplateInstance[],
  viewer: { parentId: string; patientId?: string },
) => {
  const [parentAuthorIds, mayReadPracticeRows] = await Promise.all([
    loadParentIds(instances.map((instance) => instance.authorId)),
    parentHasCompanionFeature(
      viewer.parentId,
      viewer.patientId,
      "medicalRecords",
    ),
  ]);
  return instances.map((instance) =>
    templateInstanceForParent(
      instance,
      viewer.parentId,
      mayReadPracticeRows ||
        (!!instance.authorId && parentAuthorIds.has(instance.authorId)),
    ),
  );
};

const buildTemplateAppointmentFormItems = async (params: {
  appointmentId: string;
  organisationId: string;
  isPMS?: boolean;
  canManageForms?: boolean;
  viewer?: { parentId: string; patientId?: string };
}) => {
  // Only a caller who may EDIT forms materialises linked-template assignments;
  // for everyone else this listing is read-only.
  await FormAssignmentService.syncLinkedTemplateAssignmentsForAppointment({
    organisationId: params.organisationId,
    appointmentId: params.appointmentId,
    canManageForms: params.canManageForms ?? false,
  });

  const allAssignments = await FormAssignmentService.listForAppointment(
    params.organisationId,
    params.appointmentId,
  );

  if (!allAssignments.length) {
    return null;
  }

  // A parent sees only what the practice sent to the app, without who created
  // or signs it or the encounter behind it.
  const viewer = params.viewer;
  const assignments = viewer
    ? allAssignments
        .filter((assignment) => assignment.mobileVisible)
        .map((assignment) => ({
          ...assignment,
          signerUserId: undefined,
          signerName: undefined,
          signerEmail: undefined,
          signerRole: undefined,
          signerIdentity: undefined,
          encounterId: undefined,
          createdBy: undefined,
          updatedBy: undefined,
        }))
    : allAssignments;

  const uniqueTemplateIds = [
    ...new Set(assignments.map((item) => item.templateId)),
  ];
  const templates = await Promise.all(
    uniqueTemplateIds.map(
      async (templateId) =>
        [
          templateId,
          await TemplateService.getById(templateId, params.organisationId),
        ] as const,
    ),
  );
  const templateMap = new Map(templates);

  const instances = await prisma.templateInstance.findMany({
    where: {
      organisationId: params.organisationId,
      appointmentId: params.appointmentId,
      templateId: { in: uniqueTemplateIds },
    },
  });

  const listedInstances = viewer
    ? await templateInstancesForParent(instances, viewer)
    : instances;
  const instanceMap = new Map(
    listedInstances.map((instance) => [
      `${instance.templateId}:${instance.templateVersion}`,
      instance,
    ]),
  );

  const includeQuestionnaire = !params.isPMS;
  const items = assignments
    .map((assignment) => {
      const template = templateMap.get(assignment.templateId);
      if (!template) return null;

      const questionnaire = includeQuestionnaire
        ? templateMapper.templateToQuestionnaire(template)
        : undefined;
      const instance = instanceMap.get(
        `${assignment.templateId}:${assignment.templateVersion}`,
      );
      const questionnaireResponse = instance
        ? templateMapper.templateInstanceToQuestionnaireResponse(
            instance,
            template,
          )
        : undefined;

      return {
        ...assignment,
        status: questionnaireResponse ? "completed" : "pending",
        questionnaire,
        questionnaireResponse,
      };
    })
    .filter((item) => item !== null);

  return {
    appointmentId: params.appointmentId,
    items,
  };
};

const resolveAppointmentPatientId = (
  appointment: { patient?: unknown } | null | undefined,
) => {
  const patient = appointment?.patient;
  if (!patient || typeof patient !== "object") return undefined;
  const patientId = (patient as { id?: unknown }).id;
  return typeof patientId === "string" ? patientId : undefined;
};

const assertParentCanViewAppointment = async (
  appointment: { patient?: unknown },
  parentId: string,
) => {
  const patientId = resolveAppointmentPatientId(appointment);
  if (!(await parentHasCompanionFeature(parentId, patientId, "appointments"))) {
    throw new FormServiceError("Forbidden", 403);
  }
};

type SubmissionAccessRow = {
  parentId?: string | null;
  patientId?: string | null;
  submittedBy?: string | null;
};

type CompanionLinkRow = {
  patientId: string;
  role: string;
  permissions: unknown;
};

// A form a parent filled in names them as both parent and submitter. A row the
// practice wrote names the client as parent and a practice user as submitter.
const isParentFilled = (submission: SubmissionAccessRow) =>
  !!submission.submittedBy && submission.submittedBy === submission.parentId;

// The co-parent permission a submission needs: "appointments" for a form a
// parent filled in, "medicalRecords" for anything the practice wrote.
const submissionFeature = (
  submission: SubmissionAccessRow,
): CompanionFeature =>
  isParentFilled(submission) ? "appointments" : "medicalRecords";

const loadActiveCompanionLinks = (
  parentId: string,
): Promise<CompanionLinkRow[]> =>
  prisma.parentPatient.findMany({
    where: {
      parentId,
      status: "ACTIVE",
      role: { in: ["PRIMARY", "CO_PARENT"] },
    },
    select: { patientId: true, role: true, permissions: true },
  });

/**
 * Whether the pet parent `parentId` may see a form submission, their own
 * included: one for a companion they hold an ACTIVE link to, with the
 * permission `submissionFeature` names for a co-parent. `links` are the
 * parent's ACTIVE links from `loadActiveCompanionLinks`.
 */
const parentMaySeeSubmission = (
  submission: SubmissionAccessRow,
  links: CompanionLinkRow[],
): boolean => {
  if (!submission.patientId) return false;
  const link = links.find((row) => row.patientId === submission.patientId);
  return (
    !!link &&
    hasCompanionFeature(
      link.role,
      link.permissions,
      submissionFeature(submission),
    )
  );
};

const isInternalFormId = async (formId: string) =>
  isInternalForm(
    (await prisma.form.findUnique({
      where: { id: formId },
      select: { visibilityType: true },
    })) ?? {},
  );

// The submission as the pet parent `parentId` may read it: one
// `parentMaySeeSubmission` allows, on a form that is not internal. Anything
// else is the same 404 as a submission that does not exist.
const loadSubmissionForParent = async (
  submissionId: string,
  parentId: string,
) => {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: submissionId },
  });
  if (
    !submission ||
    !parentMaySeeSubmission(
      submission,
      await loadActiveCompanionLinks(parentId),
    ) ||
    (await isInternalFormId(submission.formId))
  ) {
    throw new FormServiceError("Submission not found", 404);
  }
  return submission;
};

type SubmissionRow = SubmissionAccessRow & {
  id: string;
  formId: string;
  formVersion: number;
  appointmentId?: string | null;
  answers: unknown;
  submittedAt: Date;
};

// The pet parent's view of a submission, with no signing metadata beyond
// `signing`, and with the submitter only when that is the parent.
const toParentSubmissionResponse = (
  sub: SubmissionRow,
  schemaSnapshot: unknown,
  signing?: FormSubmission["signing"],
) =>
  toFHIRQuestionnaireResponse(
    {
      _id: sub.id,
      formId: sub.formId,
      formVersion: sub.formVersion,
      appointmentId: sub.appointmentId ?? undefined,
      patientId: sub.patientId ?? undefined,
      parentId: sub.parentId ?? undefined,
      submittedBy: isParentFilled(sub)
        ? (sub.submittedBy ?? undefined)
        : undefined,
      answers: sub.answers as Record<string, unknown>,
      submittedAt: sub.submittedAt,
      ...(signing ? { signing } : {}),
    },
    coerceFormFields(schemaSnapshot),
  );

// Helpers

const flattenFields = (schema: FormField[]): FormField[] => {
  const out: FormField[] = [];
  const walk = (fields: FormField[]) => {
    fields.forEach((f) => {
      out.push(f);
      if (f.type === "group") walk(f.fields);
    });
  };
  walk(schema);
  return out;
};

const normalizeVisibilityType = (
  value: PrismaFormVisibilityType,
): "Internal" | "External" => (value === "Internal" ? "Internal" : "External");

const toPrismaVisibilityType = (
  value: Form["visibilityType"],
): PrismaFormVisibilityType => (value === "Internal" ? "Internal" : "External");

const toPrismaOrganizationType = (
  value: Form["businessType"],
): PrismaOrganizationType | undefined => {
  if (!value) return undefined;
  return (Object.values(PrismaOrganizationType) as string[]).includes(value)
    ? value
    : undefined;
};

const toPrismaRequiredSigner = (
  value: Form["requiredSigner"],
): PrismaFormRequiredSigner | undefined => {
  if (!value) return undefined;
  return (Object.values(PrismaFormRequiredSigner) as string[]).includes(value)
    ? value
    : undefined;
};

const parseFormRequest = (fhir: FormRequestDTO): Form => {
  const internal: Form = fromFormRequestDTO(fhir);
  if (
    FormService.hasSignatureField(internal.schema) &&
    !internal.requiredSigner
  ) {
    throw new FormServiceError("requiredSigner is required", 400);
  }
  return internal;
};

const toFormFromPrisma = (form: {
  id: string;
  orgId: string;
  businessType: PrismaOrganizationType | null;
  name: string;
  category: string;
  description: string | null;
  visibilityType: PrismaFormVisibilityType;
  serviceId: string[];
  speciesFilter: string[];
  requiredSigner: PrismaFormRequiredSigner | null;
  status: PrismaFormStatus;
  schema: Prisma.JsonValue;
  createdBy: string;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}): Form => ({
  _id: form.id,
  orgId: form.orgId,
  businessType: form.businessType ?? undefined,
  name: form.name,
  category: form.category,
  description: form.description ?? undefined,
  visibilityType: normalizeVisibilityType(form.visibilityType),
  serviceId: form.serviceId,
  speciesFilter: form.speciesFilter ?? [],
  requiredSigner: form.requiredSigner ?? undefined,
  status: form.status,
  schema: coerceFormFields(form.schema),
  createdBy: form.createdBy,
  updatedBy: form.updatedBy,
  createdAt: form.createdAt,
  updatedAt: form.updatedAt,
});

const throwForbidden = (): never => {
  throw new FormServiceError("Forbidden", 403);
};

// Ids read from a client payload reach a query only as plain strings.
const isIdOrAbsent = (value: unknown) => !value || typeof value === "string";

type SubmissionActor = { parentId: string } | { organisationId: string };

// A parent submits for the companion on an appointment at the form's
// organisation or, with no appointment, for a companion linked to that
// organisation.
const assertParentMaySubmitFor = async (
  parentId: string,
  appointment: { patient?: unknown } | null,
  patientId: string | undefined,
  formOrgId: string,
) => {
  if (appointment) {
    await assertParentCanViewAppointment(appointment, parentId);
    return;
  }
  if (!patientId) {
    throw new FormServiceError("Forbidden", 403);
  }
  await assertParentCanViewAppointment(
    { patient: { id: patientId } },
    parentId,
  );
  await assertPatientOrgMembership(patientId, formOrgId, throwForbidden);
};

/**
 * A concrete form's submission is written into the form's own organisation.
 * Practice staff submit only their organisation's forms, for its own
 * appointments and companions; a parent submits for a companion they may act
 * for. An appointment or companion the caller may not use is answered the same
 * way as one that does not exist.
 */
const assertFormSubmittableBy = async (
  submission: FormSubmission,
  formOrgId: string,
  actor: SubmissionActor,
) => {
  if ("organisationId" in actor && formOrgId !== actor.organisationId) {
    throw new FormServiceError("Form not found", 404);
  }

  const { appointmentId, patientId } = submission;
  if (!isIdOrAbsent(appointmentId) || !isIdOrAbsent(patientId)) {
    throwForbidden();
  }

  const appointment = appointmentId
    ? await prisma.appointment.findFirst({
        where: { id: appointmentId, organisationId: formOrgId },
        select: { patient: true },
      })
    : null;
  if (appointmentId && !appointment) {
    throwForbidden();
  }
  // Answers go on an appointment only for that appointment's companion.
  if (
    appointment &&
    patientId &&
    resolveAppointmentPatientId(appointment) !== patientId
  ) {
    throwForbidden();
  }

  if ("parentId" in actor) {
    await assertParentMaySubmitFor(
      actor.parentId,
      appointment,
      patientId,
      formOrgId,
    );
  } else if (patientId) {
    await assertPatientOrgMembership(patientId, formOrgId, throwForbidden);
  }
  return resolveAppointmentPatientId(appointment);
};

// A practice may name the companion's parent on a submission it writes. The
// name is kept only for a parent who may see that submission.
const parentNamedByPractice = async (
  submission: FormSubmission,
): Promise<string | undefined> => {
  const { parentId, patientId, submittedBy } = submission;
  if (typeof parentId !== "string" || typeof patientId !== "string") {
    return undefined;
  }
  const feature = submissionFeature({
    parentId,
    patientId,
    submittedBy: submittedBy ?? null,
  });
  return (await parentHasCompanionFeature(parentId, patientId, feature))
    ? parentId
    : undefined;
};

const syncFormFields = async (formId: string, schema: FormField[]) => {
  const flat = flattenFields(schema);

  await prisma.formField.deleteMany({ where: { formId } });
  if (flat.length) {
    await prisma.formField.createMany({
      data: flat.map((f) => ({
        formId,
        fieldId: f.id,
        type: f.type,
        label: f.label,
        placeholder: f.placeholder ?? undefined,
        required: f.required ?? undefined,
        order: f.order ?? undefined,
        group: f.group ?? undefined,
        options:
          "options" in f && Array.isArray(f.options)
            ? (f.options as unknown as Prisma.InputJsonValue)
            : undefined,
        meta: (f.meta ?? undefined) as unknown as Prisma.InputJsonValue,
      })),
    });
  }
};

// A submission whose form id resolves to a template (not a concrete form) is
// written as a template instance instead of a form submission. Extracted from
// `submitFHIR` so that method stays within its cognitive-complexity budget; the
// caller reaches here only after confirming the id is not a concrete form.
const submitViaTemplateInstance = async (
  formIdString: string,
  submission: FormSubmission,
  actor: SubmissionActor,
): Promise<FormSubmission> => {
  const template = await getTemplateOrUndefined(formIdString);
  if (!template?.organisationId) {
    throw new FormServiceError("Form not found", 404);
  }

  if ("parentId" in actor) {
    if (!PARENT_TEMPLATE_KINDS.has(template.kind)) {
      throw new FormServiceError("Form not found", 404);
    }
    await assertTemplateSubmittableByParent({
      organisationId: template.organisationId,
      templateId: formIdString,
      parentId: actor.parentId,
      appointmentId: submission.appointmentId ?? undefined,
    });
  }

  // RBAC on the PMS submit route authorizes the organisation the caller
  // named, but the instance below is written into the template's own
  // organisation. Without this they can diverge.
  if (
    "organisationId" in actor &&
    template.organisationId !== actor.organisationId
  ) {
    throw new FormServiceError("Form not found", 404);
  }

  const submittedBy = submission.submittedBy ?? submission.parentId;
  const instance = await TemplateService.createInstance({
    templateId: formIdString,
    organisationId: template.organisationId,
    appointmentId: submission.appointmentId ?? undefined,
    authorId: submittedBy ?? undefined,
    data: submission.answers,
  });

  const completed = await TemplateService.updateInstance(
    instance.id,
    {
      data: submission.answers,
      status: "COMPLETED",
    },
    template.organisationId,
  );

  try {
    await FormAssignmentService.markSubmittedFromSubmission({
      organisationId: template.organisationId,
      templateId: formIdString,
      templateVersion:
        completed.templateVersion ??
        instance.templateVersion ??
        submission.formVersion,
      appointmentId: submission.appointmentId ?? undefined,
      companionId: submission.patientId ?? submission.companionId ?? undefined,
      parentId: submission.parentId ?? undefined,
      submittedAt: submission.submittedAt,
    });
  } catch (error) {
    logger.warn("Failed to sync template form assignment submission status", {
      error,
      formId: formIdString,
      appointmentId: submission.appointmentId ?? null,
    });
  }

  return {
    ...submission,
    _id: completed.id ?? instance.id,
    formVersion:
      completed.templateVersion ??
      instance.templateVersion ??
      submission.formVersion,
  };
};

export const FormService = {
  hasSignatureField(fields?: FormField[]): boolean {
    if (!fields?.length) return false;
    return fields.some((field) => {
      if (field.type === "signature") return true;
      if (field.type === "group") {
        return FormService.hasSignatureField(field.fields);
      }
      return false;
    });
  },

  async create(orgId: string, fhir: FormRequestDTO, userId: string) {
    const oid = ensureId(orgId, "orgId");

    const internal = parseFormRequest(fhir);
    internal.orgId = oid;
    internal.createdBy = userId;
    internal.updatedBy = userId;
    internal.status = "draft";

    const created = await prisma.form.create({
      data: {
        orgId: internal.orgId,
        businessType: toPrismaOrganizationType(internal.businessType),
        name: internal.name,
        category: internal.category,
        description: internal.description ?? undefined,
        visibilityType: toPrismaVisibilityType(internal.visibilityType),
        serviceId: normalizeServiceIdArray(internal.serviceId),
        speciesFilter: internal.speciesFilter ?? [],
        requiredSigner: toPrismaRequiredSigner(internal.requiredSigner),
        status: "draft",
        schema: internal.schema as unknown as Prisma.InputJsonValue,
        createdBy: userId,
        updatedBy: userId,
      },
    });

    await syncFormFields(created.id, internal.schema);

    const form = toFormFromPrisma(created);
    const nameMap = await resolveUserNameMap([form.createdBy, form.updatedBy]);
    return toFormResponseDTO(applyUserNamesToForm(form, nameMap));
  },

  async getFormForAdmin(orgId: string, formId: string) {
    const doc = await loadFormInOrganisation(formId, orgId);
    const form = toFormFromPrisma(doc);
    const nameMap = await resolveUserNameMap([form.createdBy, form.updatedBy]);
    return toFormResponseDTO(applyUserNamesToForm(form, nameMap));
  },

  async getFormForUser(formId: string) {
    const fid = ensureId(formId, "formId");

    const version = await prisma.formVersion.findFirst({
      where: { formId: fid },
      orderBy: { version: "desc" },
    });

    if (!version)
      throw new FormServiceError("Form has no published version", 400);

    const form = await prisma.form.findUnique({
      where: { id: version.formId },
    });
    if (!form) throw new FormServiceError("Form not found", 404);

    const fhirForm = {
      _id: fid,
      orgId: "",
      businessType: form.businessType ?? undefined,
      name: "",
      category: "",
      description: "",
      visibilityType: normalizeVisibilityType(form.visibilityType),
      serviceId: undefined,
      speciesFilter: [],
      requiredSigner: form.requiredSigner ?? undefined,
      status: form.status,
      schema: coerceFormFields(version.schemaSnapshot),
      createdBy: "",
      updatedBy: "",
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };

    return toFormResponseDTO(fhirForm);
  },

  async update(
    formId: string,
    fhir: FormRequestDTO,
    userId: string,
    orgId: string,
  ) {
    const internal = parseFormRequest(fhir);
    const { id: fidString } = await loadFormInOrganisation(formId, orgId);

    const updated = await prisma.form.update({
      where: { id: fidString },
      data: {
        name: internal.name,
        category: internal.category,
        description: internal.description ?? undefined,
        visibilityType: toPrismaVisibilityType(internal.visibilityType),
        serviceId: normalizeServiceIdArray(internal.serviceId),
        speciesFilter: internal.speciesFilter ?? [],
        businessType: toPrismaOrganizationType(internal.businessType),
        requiredSigner: toPrismaRequiredSigner(internal.requiredSigner),
        schema: internal.schema as unknown as Prisma.InputJsonValue,
        updatedBy: userId,
        status: "draft",
      },
    });

    await syncFormFields(fidString, internal.schema);

    const form = toFormFromPrisma(updated);
    const nameMap = await resolveUserNameMap([form.createdBy, form.updatedBy]);
    return applyUserNamesToForm(form, nameMap);
  },

  async publish(formId: string, userId: string, orgId: string | undefined) {
    const form = await loadFormInOrganisation(formId, orgId);
    const fid = form.id;

    const lastVersion = await prisma.formVersion.findFirst({
      where: { formId: fid },
      orderBy: { version: "desc" },
    });
    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    const fieldsSnapshot = flattenFields(coerceFormFields(form.schema));

    await prisma.formVersion.create({
      data: {
        formId: fid,
        version: nextVersion,
        schemaSnapshot: form.schema as unknown as Prisma.InputJsonValue,
        fieldsSnapshot: fieldsSnapshot as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(),
      },
    });

    await prisma.form.update({
      where: { id: fid },
      data: {
        status: "published",
        updatedBy: userId,
      },
    });

    return { formId, version: nextVersion };
  },

  async unpublish(formId: string, userId: string, orgId: string | undefined) {
    const { id: fid } = await loadFormInOrganisation(formId, orgId);

    const updated = await prisma.form.update({
      where: { id: fid },
      data: { status: "draft", updatedBy: userId },
    });
    return toFormFromPrisma(updated);
  },

  async archive(formId: string, userId: string, orgId: string | undefined) {
    const { id: fid } = await loadFormInOrganisation(formId, orgId);

    const updated = await prisma.form.update({
      where: { id: fid },
      data: { status: "archived", updatedBy: userId },
    });
    return toFormFromPrisma(updated);
  },

  async submitFHIR(
    response: FormSubmissionRequestDTO,
    schema: FormField[] | undefined,
    submittedByOverride: string | undefined,
    actor: SubmissionActor,
  ): Promise<FormSubmission> {
    const initialSubmission: FormSubmission = fromFormSubmissionRequestDTO(
      response,
      schema,
    );

    const resolvedSchema = await resolveSchemaForSubmission(
      initialSubmission,
      schema,
    );

    const submission: FormSubmission = resolvedSchema
      ? fromFormSubmissionRequestDTO(response, resolvedSchema)
      : initialSubmission;

    // For server-initiated (PMS) submissions the submitter is the authenticated
    // user from the verified token, which takes precedence over any client FHIR
    // submitted-by extension so the signing guard can match initiator===submitter.
    if (submittedByOverride) {
      submission.submittedBy = submittedByOverride;
    }
    if ("organisationId" in actor) {
      submission.parentId = await parentNamedByPractice(submission);
    }

    // Never trust signing metadata from client-submitted FHIR extensions.
    // Signed state and document IDs must be written by server-side signing flows.
    const signing = buildDefaultSubmissionSigning(resolvedSchema);

    const formIdString = String(submission.formId);

    const formOrganisation = await prisma.form.findUnique({
      where: { id: formIdString },
      select: { orgId: true, category: true, visibilityType: true },
    });

    if (!formOrganisation) {
      return submitViaTemplateInstance(formIdString, submission, actor);
    }
    // A parent is never shown a practice-only form to fill in.
    if ("parentId" in actor && isPracticeOnlyForm(formOrganisation)) {
      throw new FormServiceError("Form not found", 404);
    }
    const appointmentPatientId = await assertFormSubmittableBy(
      submission,
      formOrganisation.orgId,
      actor,
    );
    // A parent's answers on an appointment are for its companion, so they stay
    // readable and signable through the parent's link to it.
    if ("parentId" in actor && !submission.patientId) {
      submission.patientId = appointmentPatientId;
    }

    const created = await prisma.formSubmission.create({
      data: {
        formId: formIdString,
        formVersion: submission.formVersion,
        appointmentId: submission.appointmentId ?? undefined,
        patientId: submission.patientId ?? undefined,
        parentId: submission.parentId ?? undefined,
        submittedBy: submission.submittedBy ?? undefined,
        answers: submission.answers,
        submittedAt: submission.submittedAt,
        signing: (signing ?? undefined) as unknown as Prisma.InputJsonValue,
      },
    });

    if (submission.appointmentId) {
      await pushAppointmentFormIdInPostgres(
        submission.appointmentId,
        formIdString,
        formOrganisation.orgId,
      );
    }

    if (submission.patientId) {
      await recordFormSubmittedAuditTrailInPostgres({
        patientId: submission.patientId,
        parentId: submission.parentId,
        appointmentId: submission.appointmentId,
        formId: formIdString,
        submissionId: created.id,
      });
    }

    try {
      await FormAssignmentService.markSubmittedFromSubmission({
        organisationId: String(formOrganisation.orgId),
        templateId: formIdString,
        templateVersion: submission.formVersion,
        appointmentId: submission.appointmentId ?? undefined,
        companionId:
          submission.patientId ?? submission.companionId ?? undefined,
        parentId: submission.parentId ?? undefined,
        submittedAt: submission.submittedAt,
      });
    } catch (error) {
      logger.warn("Failed to sync form assignment submission status", {
        error,
        formId: formIdString,
        appointmentId: submission.appointmentId ?? null,
      });
    }

    return {
      ...submission,
      _id: created.id,
    };
  },

  /**
   * One submission, as the pet parent `parentId` may see it (see
   * `loadSubmissionForParent`). Anything else is the same 404 as an id that
   * does not exist.
   */
  async getSubmission(submissionId: string, parentId: string) {
    const sid = ensureId(submissionId, "submissionId");
    const pid = ensureId(parentId, "parentId");

    const sub = await loadSubmissionForParent(sid, pid);

    const version = await prisma.formVersion.findFirst({
      where: { formId: sub.formId, version: sub.formVersion },
    });

    return toParentSubmissionResponse(sub, version?.schemaSnapshot);
  },

  /** A form's submissions, limited to the ones `getSubmission` would show. */
  async listSubmissions(formId: string, parentId: string) {
    const fid = ensureId(formId, "formId");
    const pid = ensureId(parentId, "parentId");
    if (await isInternalFormId(fid)) return [];
    const links = await loadActiveCompanionLinks(pid);

    const rows = await prisma.formSubmission.findMany({
      where: {
        formId: fid,
        patientId: { in: links.map((link) => link.patientId) },
      },
      orderBy: { submittedAt: "desc" },
    });
    const visible = rows.filter((row) => parentMaySeeSubmission(row, links));
    if (!visible.length) return [];

    const versions = await prisma.formVersion.findMany({
      where: {
        formId: fid,
        version: { in: [...new Set(visible.map((row) => row.formVersion))] },
      },
      select: { version: true, schemaSnapshot: true },
    });
    const schemaByVersion = new Map(
      versions.map((version) => [version.version, version.schemaSnapshot]),
    );

    return visible.map((row) =>
      toParentSubmissionResponse(row, schemaByVersion.get(row.formVersion)),
    );
  },

  async listSubmissionsForCompanionInOrganisation(params: {
    organisationId: string;
    patientId: string;
  }): Promise<CompanionFormSubmission[]> {
    const organisationId = ensureNonEmptyString(
      params.organisationId,
      "organisationId",
    );
    const patientId = ensureNonEmptyString(params.patientId, "patientId");

    const submissions = await prisma.formSubmission.findMany({
      where: { patientId },
      orderBy: { submittedAt: "desc" },
    });

    if (!submissions.length) return [];

    const formIds = [
      ...new Set(submissions.map((submission) => submission.formId)),
    ];
    const appointmentIds = [
      ...new Set(
        submissions
          .map((submission) => submission.appointmentId)
          .filter(Boolean),
      ),
    ] as string[];

    const [forms, appointments] = await Promise.all([
      prisma.form.findMany({
        where: { id: { in: formIds } },
        select: { id: true, name: true, category: true, orgId: true },
      }),
      appointmentIds.length
        ? prisma.appointment.findMany({
            where: { id: { in: appointmentIds } },
            select: { id: true, organisationId: true },
          })
        : Promise.resolve([]),
    ]);

    const formMap = new Map(forms.map((form) => [form.id, form]));
    const appointmentOrgMap = new Map(
      appointments.map((appointment) => [
        appointment.id,
        appointment.organisationId,
      ]),
    );

    return submissions
      .filter((submission) => {
        if (submission.appointmentId) {
          return (
            appointmentOrgMap.get(submission.appointmentId) === organisationId
          );
        }
        const form = formMap.get(submission.formId);
        return form?.orgId === organisationId;
      })
      .map((submission) => {
        const form = formMap.get(submission.formId);
        return {
          id: submission.id,
          formId: submission.formId,
          formVersion: submission.formVersion,
          appointmentId: submission.appointmentId ?? undefined,
          patientId: submission.patientId ?? undefined,
          submittedBy: submission.submittedBy ?? undefined,
          submittedAt: submission.submittedAt,
          answers: (submission.answers ?? {}) as Record<string, unknown>,
          signing:
            (submission.signing as unknown as FormSubmissionDocument["signing"]) ??
            undefined,
          formName: form?.name ?? null,
          formCategory: form?.category ?? null,
        };
      });
  },

  async getAutoSendForms(orgId: string, serviceId?: string) {
    const oid = ensureId(orgId, "orgId");

    return prisma.form.findMany({
      where: {
        orgId: oid,
        status: "published",
        ...(serviceId ? { serviceId: { has: serviceId } } : {}),
      },
    });
  },

  async listFormsForOrganisation(orgId: string) {
    const oid = ensureId(orgId, "orgId");
    const docs = await prisma.form.findMany({
      where: { orgId: oid },
    });

    const nameMap = await resolveUserNameMap(
      docs.flatMap((doc) => [doc.createdBy, doc.updatedBy]),
    );

    return docs.map((doc) =>
      toFormResponseDTO(applyUserNamesToForm(toFormFromPrisma(doc), nameMap)),
    );
  },

  async getSOAPNotesByAppointment(
    appointmentId: string,
    options?: {
      latestOnly?: boolean;
      requesterOrgId?: string;
      requesterParentId?: string;
    },
  ) {
    const appointmentLookup =
      await loadAppointmentForFormsRecord(appointmentId);

    if (!appointmentLookup) {
      throw new FormServiceError("Appointment not found", 404);
    }
    const appointment = appointmentLookup.appointment;
    const appointmentKey = normalizeAppointmentId(appointmentId);

    await assertSoapAppointmentAccess({
      appointment,
      requesterOrgId: options?.requesterOrgId,
      requesterParentId: options?.requesterParentId,
    });

    const orgType = await resolveOrganizationType(appointment.organisationId);
    if (orgType && orgType !== "HOSPITAL") {
      return {
        appointmentId: appointmentKey,
        soapNotes: {},
      };
    }

    const parentId = options?.requesterParentId;
    // A parent sees the submitter only when that is them.
    const submissions = (await loadSoapSubmissions(appointmentKey)).map(
      (row) =>
        parentId && row.submittedBy !== parentId
          ? { ...row, submittedBy: undefined }
          : row,
    );
    const grouped = initSoapGroup();

    if (!submissions.length) {
      return {
        appointmentId: appointmentKey,
        soapNotes: grouped,
      };
    }

    const formIds = [...new Set(submissions.map((s) => s.formId))];
    const formLookup = await loadSoapFormLookup(formIds);
    const soapNotes = buildSoapNotes({
      submissions,
      formLookup,
      latestOnly: options?.latestOnly,
    });

    return {
      appointmentId: appointmentKey,
      soapNotes,
    };
  },

  async getConsentFormForParent(
    orgId: string,
    options?: {
      serviceId?: string;
      species?: string;
    },
  ) {
    const oid = ensureId(orgId, "orgId");

    const form = await prisma.form.findFirst({
      where: {
        orgId: oid,
        status: "published",
        visibilityType: "External",
        category: "Consent",
        ...(options?.serviceId
          ? { serviceId: { has: options.serviceId } }
          : {}),
        ...(options?.species
          ? { speciesFilter: { has: options.species } }
          : {}),
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!form) {
      throw new FormServiceError("Consent form not found", 404);
    }

    const version = await prisma.formVersion.findFirst({
      where: { formId: form.id },
      orderBy: { version: "desc" },
    });

    if (!version) {
      throw new FormServiceError("Consent form is not published", 400);
    }

    const clientForm: Form = {
      _id: form.id,
      orgId: "",
      businessType: form.businessType ?? undefined,
      name: form.name,
      category: form.category,
      description: form.description ?? undefined,
      visibilityType: normalizeVisibilityType(form.visibilityType),
      serviceId: form.serviceId,
      speciesFilter: form.speciesFilter,
      status: form.status,
      schema: coerceFormFields(version.schemaSnapshot),
      createdBy: "",
      updatedBy: "",
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };

    return toFormResponseDTO(clientForm);
  },

  /**
   * Render a submitted form as a PDF.
   *
   * `parentId` is the pet parent asking. The PDF is served for a submission
   * `parentMaySeeSubmission` allows; any other id is the same 404 as a missing
   * one.
   */
  async generatePDFForSubmission(
    submissionId: string,
    parentId: string,
  ): Promise<Buffer> {
    const sid = ensureId(submissionId, "submissionId");
    const pid = ensureId(parentId, "parentId");

    const submission = await loadSubmissionForParent(sid, pid);

    const version = await prisma.formVersion.findFirst({
      where: {
        formId: submission.formId,
        version: submission.formVersion,
      },
    });
    if (!version) {
      throw new FormServiceError("Form version not found", 404);
    }

    const formIdString = submission.formId;

    const vm = buildPdfViewModel({
      title: `Form Submission - ${formIdString}`,
      schema: coerceFormFields(version.schemaSnapshot),
      answers: submission.answers as Record<string, unknown>,
      submittedAt: submission.submittedAt,
    });

    const pdfBuffer = await renderPdf(vm);
    return pdfBuffer;
  },

  async getFormsForAppointment(params: {
    appointmentId: string;
    serviceId?: string;
    species?: string;
    isPMS?: boolean;
    viewerParentId?: string;
    requesterOrgId?: string;
    canManageForms?: boolean;
  }) {
    const appointmentLookup = await loadAppointmentForFormsRecord(
      params.appointmentId,
    );
    if (!appointmentLookup) {
      throw new FormServiceError("Appointment not found", 404);
    }
    const appointment = appointmentLookup.appointment;
    const appointmentId = normalizeAppointmentId(params.appointmentId);

    if (
      params.requesterOrgId &&
      appointment.organisationId !== params.requesterOrgId
    ) {
      throw new FormServiceError(
        "Forbidden: appointment does not belong to this organisation",
        403,
      );
    }

    if (params.viewerParentId) {
      await assertParentCanViewAppointment(appointment, params.viewerParentId);

      try {
        await FormAssignmentService.markViewedForAppointment({
          organisationId: appointment.organisationId,
          appointmentId: appointmentId,
        });
      } catch (error) {
        logger.warn("Failed to sync form assignment viewed status", {
          error,
          appointmentId,
        });
      }
    }

    const orgType = await resolveOrganizationType(appointment.organisationId);

    const templateBackedForms = await buildTemplateAppointmentFormItems({
      appointmentId,
      organisationId: appointment.organisationId,
      isPMS: params.isPMS,
      canManageForms: params.canManageForms,
      viewer: params.viewerParentId
        ? {
            parentId: params.viewerParentId,
            patientId: resolveAppointmentPatientId(appointment),
          }
        : undefined,
    });

    if (templateBackedForms) {
      return templateBackedForms;
    }

    const attachedFormIds = (appointment.formIds ?? []).map(String);
    const submissionFormIdStrings =
      await loadSubmissionFormIdStringsForAppointment(appointmentId);

    const formIdsFromAppointment = new Set<string>([
      ...attachedFormIds,
      ...submissionFormIdStrings,
    ]);

    const [formsById, templateForms] = await Promise.all([
      fetchFormsByIds(formIdsFromAppointment),
      fetchTemplateForms(orgType, appointment, params),
    ]);

    const forms = mergeFormsById(formsById, templateForms);
    if (!forms.length) {
      return { appointmentId, items: [] };
    }

    // 2️⃣ Load latest form versions
    const versionMap = await loadLatestVersions(forms);

    // 3️⃣ Load latest submissions per form
    const submissionMap = await loadLatestSubmissions(
      appointmentId,
      forms,
      params.viewerParentId,
    );

    // 4️⃣ Build FHIR response
    const includeQuestionnaire = !params.isPMS;
    const items = await buildAppointmentFormItems({
      forms,
      versionMap,
      submissionMap,
      includeQuestionnaire,
      viewerParentId: params.viewerParentId,
    });

    return {
      appointmentId,
      items,
    };
  },
};
