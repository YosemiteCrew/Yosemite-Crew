import { Types, type HydratedDocument } from "mongoose";
import {
  FormModel,
  FormFieldModel,
  FormVersionModel,
  FormSubmissionModel,
  FormSubmissionDocument,
  IFormVersionDocument,
} from "../models/form";

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
} from "@yosemite-crew/types";
import { buildPdfViewModel, renderPdf } from "./formPDF.service";
import AppointmentModel from "src/models/appointment";
import OrganizationModel from "src/models/organization";
import { DocumensoService } from "./documenso.service";
import { AuditTrailService } from "./audit-trail.service";
import UserModel from "src/models/user";
import {
  FormRequiredSigner as PrismaFormRequiredSigner,
  FormStatus as PrismaFormStatus,
  FormVisibilityType as PrismaFormVisibilityType,
  OrganizationType as PrismaOrganizationType,
  Prisma,
} from "@prisma/client";
import { prisma } from "src/config/prisma";
import { handleDualWriteError, shouldDualWrite } from "src/utils/dual-write";

export class FormServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FormServiceError";
  }
}

type FormVersionDoc = HydratedDocument<IFormVersionDocument> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

type FormSubmissionDoc = HydratedDocument<FormSubmissionDocument> & {
  _id: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
};

const ensureObjectId = (id: string | Types.ObjectId, label: string) => {
  if (id instanceof Types.ObjectId) return id;
  if (!Types.ObjectId.isValid(id))
    throw new FormServiceError(`Invalid ${label}`, 400);
  return new Types.ObjectId(id);
};

type NormalizableObjectId =
  | Types.ObjectId
  | string
  | { toHexString(): string }
  | { toString(): string };

const normalizeObjectId = (id: NormalizableObjectId): string => {
  if (typeof id === "string") return id;
  if (id instanceof Types.ObjectId) return id.toHexString();
  if ("toHexString" in id) {
    const hex = id.toHexString?.();
    if (typeof hex === "string") return hex;
  }

  throw new FormServiceError("Invalid ObjectId", 400);
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

  const users = await UserModel.find(
    { userId: { $in: uniqueIds } },
    { userId: 1, firstName: 1, lastName: 1 },
  ).lean();

  const map = new Map<string, string>();
  for (const user of users) {
    const displayName = buildDisplayName(user);
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

type LeanForm = Omit<Form, "_id"> & { _id: Types.ObjectId };
type VersionAgg = Pick<
  IFormVersionDocument,
  "formId" | "schemaSnapshot" | "version"
> & { _id: Types.ObjectId };
type SubmissionAgg = FormSubmissionDocument & {
  _id: Types.ObjectId;
  formId: Types.ObjectId;
};
type AppointmentLean = {
  organisationId: string;
  formIds?: NormalizableObjectId[];
};

const SOAP_CATEGORIES = [
  "SOAP-Subjective",
  "SOAP-Objective",
  "SOAP-Assessment",
  "SOAP-Plan",
  "Discharge",
];

const resolveOrganizationType = async (
  organisationId: string,
): Promise<OrganizationType | null> => {
  const cached = orgTypeCache.get(organisationId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.type;
  }

  const organisation = await OrganizationModel.findById(organisationId)
    .select({ type: 1 })
    .lean();

  if (!organisation?.type) {
    return null;
  }

  orgTypeCache.set(organisationId, {
    type: organisation.type,
    expiresAt: Date.now() + ORG_TYPE_CACHE_TTL_MS,
  });

  return organisation.type;
};

const buildTemplateFilter = (
  orgType: OrganizationType,
  appointment: AppointmentLean,
  params: { serviceId?: string; species?: string },
) => {
  const templateFilter: Record<string, unknown> = {
    orgId: appointment.organisationId,
    status: "published",
  };

  if (orgType === "HOSPITAL") {
    templateFilter.category = { $in: SOAP_CATEGORIES };
  } else {
    templateFilter.businessType = orgType;
    templateFilter.category = { $nin: SOAP_CATEGORIES };
  }

  if (params.serviceId) {
    templateFilter.serviceId = { $in: [params.serviceId] };
  }

  if (params.species) {
    templateFilter.speciesFilter = { $in: [params.species] };
  }

  return templateFilter;
};

const fetchTemplateForms = async (
  orgType: OrganizationType | null,
  appointment: AppointmentLean,
  params: { serviceId?: string; species?: string },
): Promise<LeanForm[]> => {
  if (!orgType) return [];
  const filter = buildTemplateFilter(orgType, appointment, params);
  return FormModel.find(filter).lean<LeanForm[]>();
};

const fetchFormsByIds = async (formIds: Set<string>): Promise<LeanForm[]> => {
  if (!formIds.size) return [];
  return FormModel.find({
    _id: { $in: [...formIds] },
    status: "published",
  }).lean<LeanForm[]>();
};

const mergeFormsById = (formsById: LeanForm[], templateForms: LeanForm[]) => {
  const formMap = new Map<string, LeanForm>();
  for (const form of [...formsById, ...templateForms]) {
    formMap.set(form._id.toString(), form);
  }
  return [...formMap.values()];
};

const loadLatestVersions = async (forms: LeanForm[]) => {
  const versions = await FormVersionModel.aggregate<VersionAgg>([
    { $match: { formId: { $in: forms.map((f) => f._id) } } },
    { $sort: { version: -1 } },
    {
      $group: {
        _id: "$formId",
        doc: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$doc" } },
  ]);

  return new Map<string, VersionAgg>(
    versions.map((v) => [normalizeObjectId(v.formId), v]),
  );
};

const loadLatestSubmissions = async (
  appointmentId: string,
  forms: LeanForm[],
) => {
  const submissions = await FormSubmissionModel.aggregate<SubmissionAgg>([
    {
      $match: {
        appointmentId,
        formId: { $in: forms.map((f) => f._id) },
      },
    },
    { $sort: { submittedAt: -1 } },
    {
      $group: {
        _id: "$formId",
        doc: { $first: "$$ROOT" },
      },
    },
    { $replaceRoot: { newRoot: "$doc" } },
  ]);

  return new Map<string, SubmissionAgg>(
    submissions.map((s) => [s.formId.toString(), s]),
  );
};

const resolveSignedPdfUrl = async (
  submission: SubmissionAgg,
  orgId: string,
) => {
  if (!submission.signing?.documentId) return undefined;
  const documensoApiKey =
    await DocumensoService.resolveOrganisationApiKey(orgId);
  if (!documensoApiKey) return undefined;
  return DocumensoService.downloadSignedDocument({
    documentId: Number.parseInt(submission.signing.documentId, 10),
    apiKey: documensoApiKey,
  });
};

const buildQuestionnaireResponse = async (
  submission: SubmissionAgg | undefined,
  version: VersionAgg,
  orgId: string,
) => {
  if (!submission) return undefined;
  const signedPdfUrl = await resolveSignedPdfUrl(submission, orgId);
  return toFHIRQuestionnaireResponse(
    {
      _id: submission._id.toString(),
      formId: submission.formId.toString(),
      formVersion: submission.formVersion,
      appointmentId: submission.appointmentId,
      companionId: submission.companionId,
      parentId: submission.parentId,
      submittedBy: submission.submittedBy,
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

const toPrismaFormData = (doc: Form) => ({
  id: normalizeObjectId(doc._id as unknown as NormalizableObjectId),
  orgId: doc.orgId,
  businessType: (doc.businessType ?? undefined) as PrismaOrganizationType | undefined,
  name: doc.name,
  category: doc.category,
  description: doc.description ?? undefined,
  visibilityType: doc.visibilityType as PrismaFormVisibilityType,
  serviceId: Array.isArray(doc.serviceId)
    ? doc.serviceId
    : doc.serviceId
      ? [doc.serviceId]
      : [],
  speciesFilter: doc.speciesFilter ?? [],
  requiredSigner: (doc.requiredSigner ?? undefined) as PrismaFormRequiredSigner | undefined,
  status: doc.status as PrismaFormStatus,
  schema: doc.schema as unknown as Prisma.InputJsonValue,
  createdBy: doc.createdBy,
  updatedBy: doc.updatedBy,
  createdAt: (doc as unknown as { createdAt?: Date }).createdAt ?? undefined,
  updatedAt: (doc as unknown as { updatedAt?: Date }).updatedAt ?? undefined,
});

const syncFormToPostgres = async (doc: Form) => {
  if (!shouldDualWrite) return;
  try {
    const data = toPrismaFormData(doc);
    await prisma.form.upsert({
      where: { id: data.id },
      create: data,
      update: data,
    });
  } catch (err) {
    handleDualWriteError("Form", err);
  }
};

const syncFormFields = async (formId: string, schema: FormField[]) => {
  await FormFieldModel.deleteMany({ formId });

  const flat = flattenFields(schema);

  await FormFieldModel.insertMany(
    flat.map((f) => ({
      formId,
      id: f.id,
      type: f.type,
      label: f.label,
      placeholder: f.placeholder,
      required: f.required,
      order: f.order,
      group: f.group,
      options:
        "options" in f && Array.isArray(f.options) ? f.options : undefined,
      meta: f.meta,
    })),
  );

  if (shouldDualWrite) {
    try {
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
    } catch (err) {
      handleDualWriteError("FormField", err);
    }
  }
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
    const oid = ensureObjectId(orgId, "orgId");

    const internal: Form = fromFormRequestDTO(fhir);
    if (
      FormService.hasSignatureField(internal.schema) &&
      !internal.requiredSigner
    ) {
      throw new FormServiceError("requiredSigner is required", 400);
    }
    internal.orgId = oid.toString();
    internal.createdBy = userId;
    internal.updatedBy = userId;
    internal.status = "draft";

    const doc = await FormModel.create({
      orgId: oid,
      businessType: internal.businessType,
      name: internal.name,
      category: internal.category,
      description: internal.description,
      visibilityType: internal.visibilityType,
      serviceId: internal.serviceId,
      speciesFilter: internal.speciesFilter,
      requiredSigner: internal.requiredSigner,
      status: "draft",
      schema: internal.schema,
      createdBy: userId,
      updatedBy: userId,
    });

    await syncFormToPostgres(doc.toObject());
    await syncFormFields(doc._id.toString(), internal.schema);

    const form = doc.toObject();
    const nameMap = await resolveUserNameMap([form.createdBy, form.updatedBy]);
    return toFormResponseDTO(applyUserNamesToForm(form, nameMap));
  },

  async getFormForAdmin(orgId: string, formId: string) {
    const oid = ensureObjectId(orgId, "orgId");
    const fid = ensureObjectId(formId, "formId");

    const doc = await FormModel.findOne({ _id: fid, orgId: oid }).lean();
    if (!doc) {
      throw new FormServiceError("Form not found", 404);
    }

    const nameMap = await resolveUserNameMap([doc.createdBy, doc.updatedBy]);
    return toFormResponseDTO(applyUserNamesToForm(doc, nameMap));
  },

  async getFormForUser(formId: string) {
    const fid = ensureObjectId(formId, "formId");

    const version = await FormVersionModel.findOne({ formId: fid }).sort({
      version: -1,
    });

    if (!version)
      throw new FormServiceError("Form has no published version", 400);

    const form = await FormModel.findById(version.formId);
    if (!form) throw new FormServiceError("Form not found", 404);

    const fhirForm = {
      _id: fid.toString(),
      orgId: "", // admin-only field; not needed for client rendering
      businessType: form.businessType,
      name: "",
      category: "",
      description: "",
      visibilityType: form.visibilityType,
      serviceId: undefined,
      speciesFilter: [],
      requiredSigner: form.requiredSigner,
      status: form.status,
      schema: version.schemaSnapshot,
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
    const fid = ensureObjectId(formId, "formId");

    const existing = await FormModel.findById(fid);
    if (!existing) throw new FormServiceError("Form not found", 404);

    if (existing.orgId !== orgId)
      throw new FormServiceError("Form is not part of your organisation", 400);

    const internal: Form = fromFormRequestDTO(fhir);
    if (
      FormService.hasSignatureField(internal.schema) &&
      !internal.requiredSigner
    ) {
      throw new FormServiceError("requiredSigner is required", 400);
    }

    existing.name = internal.name;
    existing.category = internal.category;
    existing.description = internal.description;
    existing.visibilityType = internal.visibilityType;
    existing.serviceId = internal.serviceId;
    existing.speciesFilter = internal.speciesFilter;
    existing.businessType = internal.businessType;
    existing.requiredSigner = internal.requiredSigner;
    (existing.schema as unknown as FormField[]) = internal.schema;
    existing.updatedBy = userId;
    existing.status = "draft"; // IMPORTANT

    await existing.save();

    await syncFormToPostgres(existing.toObject());
    await syncFormFields(formId, internal.schema);

    const form = existing.toObject();
    const nameMap = await resolveUserNameMap([form.createdBy, form.updatedBy]);
    return applyUserNamesToForm(form, nameMap);
  },

  async publish(formId: string, userId: string) {
    const fid = ensureObjectId(formId, "formId");

    const form = await FormModel.findById(fid);
    if (!form) throw new FormServiceError("Form not found", 404);

    const fields = await FormFieldModel.find({ formId: fid }).lean();

    const lastVersion =
      (await FormVersionModel.findOne({ formId: fid }).sort({
        version: -1,
      })) ?? undefined;

    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    const versionDoc: FormVersionDoc = await FormVersionModel.create({
      formId: fid,
      version: nextVersion,
      schemaSnapshot: form.schema,
      fieldsSnapshot: fields,
      publishedAt: new Date(),
    });

    form.status = "published";
    form.updatedBy = userId;
    await form.save();

    if (shouldDualWrite) {
      try {
        await prisma.formVersion.create({
          data: {
            id: versionDoc._id.toString(),
            formId: fid.toString(),
            version: nextVersion,
            schemaSnapshot: form.schema as unknown as Prisma.InputJsonValue,
            fieldsSnapshot: fields as unknown as Prisma.InputJsonValue,
            publishedAt: versionDoc.publishedAt ?? new Date(),
            createdAt: versionDoc.createdAt ?? undefined,
            updatedAt: versionDoc.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("FormVersion", err);
      }
    }

    await syncFormToPostgres(form.toObject());

    return { formId, version: nextVersion };
  },

  async unpublish(formId: string, userId: string) {
    const fid = ensureObjectId(formId, "formId");

    const form = await FormModel.findById(fid);
    if (!form) throw new FormServiceError("Form not found", 404);

    form.status = "draft"; // or "unpublished" if you want another state
    form.updatedBy = userId;
    await form.save();

    await syncFormToPostgres(form.toObject());

    return form.toObject();
  },

  async archive(formId: string, userId: string) {
    const fid = ensureObjectId(formId, "formId");

    const form = await FormModel.findById(fid);
    if (!form) throw new FormServiceError("Form not found", 404);

    form.status = "archived";
    form.updatedBy = userId;
    await form.save();

    await syncFormToPostgres(form.toObject());

    return form.toObject();
  },

  async submitFHIR(
    response: FormSubmissionRequestDTO,
    schema?: FormField[],
  ): Promise<FormSubmission> {
    const initialSubmission: FormSubmission = fromFormSubmissionRequestDTO(
      response,
      schema,
    );

    let resolvedSchema = schema;
    if (!resolvedSchema && initialSubmission.formId) {
      const version = await FormVersionModel.findOne({
        formId: ensureObjectId(initialSubmission.formId, "formId"),
        version: initialSubmission.formVersion,
      })
        .select("schemaSnapshot")
        .lean();
      resolvedSchema = version?.schemaSnapshot;
    }

    const submission: FormSubmission = resolvedSchema
      ? fromFormSubmissionRequestDTO(response, resolvedSchema)
      : initialSubmission;

    const signingRequired = FormService.hasSignatureField(resolvedSchema);
    const signing =
      signingRequired && !submission.signing
        ? {
            required: true,
            status: "NOT_STARTED",
            provider: "DOCUMENSO",
          }
        : submission.signing;

    const formIdString = String(submission.formId);
    const created: FormSubmissionDoc = await FormSubmissionModel.create({
      formId: submission.formId,
      formVersion: submission.formVersion,
      appointmentId: submission.appointmentId,
      companionId: submission.companionId,
      parentId: submission.parentId,
      submittedBy: submission.submittedBy,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
      signing,
    });

    if (shouldDualWrite) {
      try {
        await prisma.formSubmission.create({
          data: {
            id: created._id.toString(),
            formId: formIdString,
            formVersion: submission.formVersion,
            appointmentId: submission.appointmentId ?? undefined,
            companionId: submission.companionId ?? undefined,
            parentId: submission.parentId ?? undefined,
            submittedBy: submission.submittedBy ?? undefined,
            answers: submission.answers as unknown as Prisma.InputJsonValue,
            submittedAt: submission.submittedAt,
            signing: (signing ?? undefined) as unknown as Prisma.InputJsonValue,
            createdAt: created.createdAt ?? undefined,
            updatedAt: created.updatedAt ?? undefined,
          },
        });
      } catch (err) {
        handleDualWriteError("FormSubmission", err);
      }
    }

    if (submission.appointmentId) {
      const appointmentObjectId = ensureObjectId(
        submission.appointmentId,
        "appointmentId",
      );
      await AppointmentModel.updateOne(
        { _id: appointmentObjectId },
        { $addToSet: { formIds: formIdString } },
      );

      if (shouldDualWrite) {
        try {
          await prisma.appointment.updateMany({
            where: { id: submission.appointmentId },
            data: {
              formIds: {
                push: formIdString,
              },
            },
          });
        } catch (err) {
          handleDualWriteError("Appointment formIds", err);
        }
      }
    }

    if (submission.companionId) {
      const form = await FormModel.findById(submission.formId)
        .select("orgId name")
        .lean();

      if (form?.orgId) {
        await AuditTrailService.recordSafely({
          organisationId: form.orgId.toString(),
          companionId: submission.companionId,
          eventType: "FORM_SUBMITTED",
          actorType: submission.parentId ? "PARENT" : "SYSTEM",
          actorId: submission.parentId ?? null,
          entityType: "FORM",
          entityId: formIdString,
          metadata: {
            submissionId: created._id.toString(),
            appointmentId: submission.appointmentId,
            formName: form.name,
          },
        });
      }
    }

    return created.toObject() as unknown as FormSubmission;
  },

  async getSubmission(submissionId: string) {
    const sid = ensureObjectId(submissionId, "submissionId");

    const sub = await FormSubmissionModel.findById(sid).lean();
    if (!sub) throw new FormServiceError("Submission not found", 404);

    const version = await FormVersionModel.findOne({
      formId: sub.formId,
      version: sub.formVersion,
    }).lean();

    const formId = (() => {
      if (typeof sub.formId === "string") return sub.formId;
      if (sub.formId instanceof Types.ObjectId) return sub.formId.toHexString();
      return "";
    })();

    const normalized: FormSubmission = {
      _id: sub._id.toString(),
      formId,
      formVersion: sub.formVersion,
      appointmentId: sub.appointmentId,
      companionId: sub.companionId,
      parentId: sub.parentId,
      submittedBy: sub.submittedBy,
      answers: sub.answers,
      submittedAt: sub.submittedAt,
    };

    return toFHIRQuestionnaireResponse(normalized, version?.schemaSnapshot);
  },

  async listSubmissions(formId: string) {
    const fid = ensureObjectId(formId, "formId");

    return FormSubmissionModel.find({ formId: fid })
      .sort({ submittedAt: -1 })
      .lean();
  },

  async getAutoSendForms(orgId: string, serviceId?: string) {
    const oid = ensureObjectId(orgId, "orgId");

    const filter: Record<string, unknown> = { orgId: oid, status: "published" };

    if (serviceId) filter.serviceId = { $in: [serviceId] };

    return FormModel.find(filter).lean();
  },

  async listFormsForOrganisation(orgId: string) {
    const oid = ensureObjectId(orgId, "orgId");
    const docs = await FormModel.find({ orgId: oid }).lean();

    const nameMap = await resolveUserNameMap(
      docs.flatMap((doc) => [doc.createdBy, doc.updatedBy]),
    );

    return docs.map((doc) =>
      toFormResponseDTO(applyUserNamesToForm(doc, nameMap)),
    );
  },

  async getSOAPNotesByAppointment(
    appointmentId: string,
    options?: { latestOnly?: boolean },
  ) {
    type SubmissionLean = Omit<FormSubmissionDocument, "formId"> & {
      _id: Types.ObjectId | string;
      formId: Types.ObjectId | string;
    };

    type SoapNoteType =
      | "Subjective"
      | "Objective"
      | "Assessment"
      | "Plan"
      | "Discharge";

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

    const appointmentObjectId = ensureObjectId(
      appointmentId,
      "appointmentId",
    ).toString();

    const appointment = await AppointmentModel.findById(appointmentObjectId)
      .select({ organisationId: 1 })
      .lean();

    if (!appointment) {
      throw new FormServiceError("Appointment not found", 404);
    }

    const orgType = await resolveOrganizationType(appointment.organisationId);
    if (orgType && orgType !== "HOSPITAL") {
      return {
        appointmentId: appointmentObjectId,
        soapNotes: {},
      };
    }

    const submissions = (await FormSubmissionModel.find({
      appointmentId: appointmentObjectId,
    })
      .sort({ submittedAt: -1 })
      .lean()) as unknown as SubmissionLean[];

    const grouped: SoapNoteGroup = {
      Subjective: [],
      Objective: [],
      Assessment: [],
      Plan: [],
      Discharge: [],
    };

    if (!submissions.length) {
      return {
        appointmentId: appointmentObjectId,
        soapNotes: grouped,
      };
    }

    // Load forms for soapType lookup
    const formIds = [
      ...new Set(submissions.map((s) => normalizeObjectId(s.formId))),
    ];

    type FormLean = {
      _id: Types.ObjectId | string;
      category: Form["category"];
      schema: Form["schema"];
    };

    const forms = (await FormModel.find({ _id: { $in: formIds } })
      .select({ _id: 1, category: 1, schema: 1 })
      .lean()) as unknown as FormLean[];

    const formMap = new Map<string, FormLean>(
      forms.map((f) => [normalizeObjectId(f._id), f]),
    );

    for (const sub of submissions) {
      const form = formMap.get(normalizeObjectId(sub.formId));
      if (!form) continue;

      const soapType = SOAP_TYPE_MAP[form.category];
      if (!soapType) continue;

      grouped[soapType].push({
        submissionId: sub._id.toString(),
        formId: normalizeObjectId(sub.formId),
        formVersion: sub.formVersion,
        submittedBy: sub.submittedBy,
        submittedAt: sub.submittedAt,
        answers: sub.answers,
      });
    }

    if (options?.latestOnly) {
      (Object.keys(grouped) as SoapNoteType[]).forEach((key) => {
        grouped[key] = grouped[key].slice(0, 1);
      });
    }

    return {
      appointmentId: appointmentObjectId,
      soapNotes: grouped,
    };
  },

  async getConsentFormForParent(
    orgId: string,
    options?: {
      serviceId?: string;
      species?: string;
    },
  ) {
    const oid = ensureObjectId(orgId, "orgId");

    const filter: Record<string, unknown> = {
      orgId: oid,
      status: "published",
      visibilityType: "External",
      category: "Consent",
    };

    if (options?.serviceId) {
      filter.serviceId = { $in: [options.serviceId] };
    }

    if (options?.species) {
      filter.speciesFilter = { $in: [options.species] };
    }

    const form = await FormModel.findOne(filter).sort({ updatedAt: -1 });
    if (!form) {
      throw new FormServiceError("Consent form not found", 404);
    }

    const version = await FormVersionModel.findOne({
      formId: form._id,
    }).sort({ version: -1 });

    if (!version) {
      throw new FormServiceError("Consent form is not published", 400);
    }

    // Build client-safe form payload
    const clientForm: Form = {
      _id: form._id.toString(),
      orgId: "",
      businessType: form.businessType,
      name: form.name,
      category: form.category,
      description: form.description,
      visibilityType: form.visibilityType,
      serviceId: form.serviceId,
      speciesFilter: form.speciesFilter,
      status: form.status,
      schema: version.schemaSnapshot,
      createdBy: "",
      updatedBy: "",
      createdAt: form.createdAt,
      updatedAt: form.updatedAt,
    };

    return toFormResponseDTO(clientForm);
  },

  async generatePDFForSubmission(submissionId: string): Promise<Buffer> {
    const sid = ensureObjectId(submissionId, "submissionId");

    const submission = await FormSubmissionModel.findById(sid).lean();
    if (!submission) {
      throw new FormServiceError("Submission not found", 404);
    }

    const version = await FormVersionModel.findOne({
      formId: submission.formId,
      version: submission.formVersion,
    }).lean();
    if (!version) {
      throw new FormServiceError("Form version not found", 404);
    }

    const formIdString = normalizeObjectId(submission.formId);

    const vm = buildPdfViewModel({
      title: `Form Submission - ${formIdString}`,
      schema: version.schemaSnapshot,
      answers: submission.answers,
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
  }) {
    const appointmentId = ensureObjectId(
      params.appointmentId,
      "appointmentId",
    ).toString();

    const appointment = await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new FormServiceError("Appointment not found", 404);
    }

    const orgType = await resolveOrganizationType(appointment.organisationId);

    const attachedFormIds = (appointment.formIds ?? []).map(String);
    const submissionFormIds = (await FormSubmissionModel.distinct("formId", {
      appointmentId,
    })) as NormalizableObjectId[];
    const submissionFormIdStrings = submissionFormIds.map((id) =>
      normalizeObjectId(id),
    );

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
    const submissionMap = await loadLatestSubmissions(appointmentId, forms);

    // 4️⃣ Build FHIR response
    const includeQuestionnaire = !params.isPMS;
    const items: {
      questionnaire?: ReturnType<typeof toFHIRQuestionnaire>;
      questionnaireResponse?: ReturnType<typeof toFHIRQuestionnaireResponse>;
      status: "completed" | "pending";
    }[] = [];

    for (const form of forms) {
      const formId = form._id.toString();
      const version = versionMap.get(formId);
      if (!version) continue;

      // FHIR Questionnaire
      const questionnaire = includeQuestionnaire
        ? toFHIRQuestionnaire({
            ...form,
            _id: form._id.toString(),
          })
        : undefined;

      // Optional FHIR QuestionnaireResponse
      const questionnaireResponse = await buildQuestionnaireResponse(
        submissionMap.get(formId),
        version,
        form.orgId,
      );

      items.push({
        ...(includeQuestionnaire ? { questionnaire } : {}),
        questionnaireResponse,
        status: questionnaireResponse ? "completed" : "pending",
      });
    }

    return {
      appointmentId,
      items,
    };
  },
};
