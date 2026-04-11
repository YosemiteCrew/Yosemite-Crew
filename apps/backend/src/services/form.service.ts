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
import { isReadFromPostgres } from "src/config/read-switch";

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

type CompanionFormSubmission = {
  id: string;
  formId: string;
  formVersion: number;
  appointmentId?: string;
  companionId?: string;
  submittedBy?: string;
  submittedAt: Date;
  answers: Record<string, unknown>;
  signing?: FormSubmissionDocument["signing"];
  formName?: string | null;
  formCategory?: string | null;
};

const ensureObjectId = (id: string | Types.ObjectId, label: string) => {
  if (id instanceof Types.ObjectId) return id;
  if (!Types.ObjectId.isValid(id))
    throw new FormServiceError(`Invalid ${label}`, 400);
  return new Types.ObjectId(id);
};

const ensureNonEmptyString = (value: unknown, label: string) => {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FormServiceError(`Invalid ${label}`, 400);
  }
  return value.trim();
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

  const users = isReadFromPostgres()
    ? await prisma.user.findMany({
        where: { userId: { in: uniqueIds } },
        select: { userId: true, firstName: true, lastName: true },
      })
    : await UserModel.find(
        { userId: { $in: uniqueIds } },
        { userId: 1, firstName: 1, lastName: 1 },
      ).lean();

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

type LeanForm = Omit<Form, "_id"> & { _id: Types.ObjectId | string };
type VersionAgg = {
  _id: Types.ObjectId | string;
  formId: Types.ObjectId | string;
  schemaSnapshot: FormField[];
  version: number;
};
type SubmissionAgg = Omit<FormSubmissionDocument, "_id" | "formId"> & {
  _id: Types.ObjectId | string;
  formId: Types.ObjectId | string;
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

  const organisation = isReadFromPostgres()
    ? await prisma.organization.findUnique({
        where: { id: organisationId },
        select: { type: true },
      })
    : await OrganizationModel.findById(organisationId)
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
  if (isReadFromPostgres()) {
    const where: Prisma.FormWhereInput = {
      orgId: appointment.organisationId,
      status: "published",
    };

    if (orgType === "HOSPITAL") {
      where.category = { in: SOAP_CATEGORIES };
    } else {
      where.businessType = orgType as PrismaOrganizationType;
      where.category = { notIn: SOAP_CATEGORIES };
    }

    if (params.serviceId) {
      where.serviceId = { has: params.serviceId };
    }

    if (params.species) {
      where.speciesFilter = { has: params.species };
    }

    const forms = await prisma.form.findMany({ where });
    return forms.map(
      (form) =>
        ({
          ...form,
          _id: form.id,
          schema: form.schema as unknown as FormField[],
        }) as LeanForm,
    );
  }

  const filter = buildTemplateFilter(orgType, appointment, params);
  return FormModel.find(filter).lean<LeanForm[]>();
};

const fetchFormsByIds = async (formIds: Set<string>): Promise<LeanForm[]> => {
  if (!formIds.size) return [];
  if (isReadFromPostgres()) {
    const forms = await prisma.form.findMany({
      where: { id: { in: [...formIds] }, status: "published" },
    });
    return forms.map(
      (form) =>
        ({
          ...form,
          _id: form.id,
          schema: form.schema as unknown as FormField[],
        }) as LeanForm,
    );
  }

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
  if (isReadFromPostgres()) {
    if (!forms.length) return new Map<string, VersionAgg>();
    const versions = await prisma.formVersion.findMany({
      where: { formId: { in: forms.map((f) => f._id.toString()) } },
      orderBy: [{ formId: "asc" }, { version: "desc" }],
    });

    const latest = new Map<string, VersionAgg>();
    for (const version of versions) {
      if (!latest.has(version.formId)) {
        latest.set(version.formId, {
          _id: version.id,
          formId: version.formId,
          version: version.version,
          schemaSnapshot: version.schemaSnapshot as unknown as FormField[],
        });
      }
    }

    return latest;
  }

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
  if (isReadFromPostgres()) {
    if (!forms.length) return new Map<string, SubmissionAgg>();
    const submissions = await prisma.formSubmission.findMany({
      where: {
        appointmentId,
        formId: { in: forms.map((f) => f._id.toString()) },
      },
      orderBy: [{ formId: "asc" }, { submittedAt: "desc" }],
    });

    const latest = new Map<string, SubmissionAgg>();
    for (const submission of submissions) {
      if (!latest.has(submission.formId)) {
        latest.set(submission.formId, {
          ...submission,
          _id: submission.id,
          formId: submission.formId,
        } as unknown as SubmissionAgg);
      }
    }

    return latest;
  }

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
  const documensoApiKey = isReadFromPostgres()
    ? ((
        await prisma.organization.findUnique({
          where: { id: orgId },
          select: { documensoApiKey: true },
        })
      )?.documensoApiKey ?? null)
    : await DocumensoService.resolveOrganisationApiKey(orgId);
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

const normalizeVisibilityType = (
  value: PrismaFormVisibilityType,
): "Internal" | "External" => (value === "Internal" ? "Internal" : "External");

const toPrismaFormData = (doc: Form) => ({
  id: normalizeObjectId(doc._id as unknown as NormalizableObjectId),
  orgId: doc.orgId,
  businessType: (doc.businessType ?? undefined) as
    | PrismaOrganizationType
    | undefined,
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
  requiredSigner: (doc.requiredSigner ?? undefined) as
    | PrismaFormRequiredSigner
    | undefined,
  status: doc.status as PrismaFormStatus,
  schema: doc.schema as unknown as Prisma.InputJsonValue,
  createdBy: doc.createdBy,
  updatedBy: doc.updatedBy,
  createdAt: (doc as unknown as { createdAt?: Date }).createdAt ?? undefined,
  updatedAt: (doc as unknown as { updatedAt?: Date }).updatedAt ?? undefined,
});

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
  schema: form.schema as unknown as FormField[],
  createdBy: form.createdBy,
  updatedBy: form.updatedBy,
  createdAt: form.createdAt,
  updatedAt: form.updatedAt,
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
  const flat = flattenFields(schema);

  if (isReadFromPostgres()) {
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
    return;
  }

  await FormFieldModel.deleteMany({ formId });

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

    if (isReadFromPostgres()) {
      const created = await prisma.form.create({
        data: {
          orgId: internal.orgId,
          businessType: (internal.businessType ?? undefined) as
            | PrismaOrganizationType
            | undefined,
          name: internal.name,
          category: internal.category,
          description: internal.description ?? undefined,
          visibilityType: internal.visibilityType as PrismaFormVisibilityType,
          serviceId: Array.isArray(internal.serviceId)
            ? internal.serviceId
            : internal.serviceId
              ? [internal.serviceId]
              : [],
          speciesFilter: internal.speciesFilter ?? [],
          requiredSigner: (internal.requiredSigner ?? undefined) as
            | PrismaFormRequiredSigner
            | undefined,
          status: "draft",
          schema: internal.schema as unknown as Prisma.InputJsonValue,
          createdBy: userId,
          updatedBy: userId,
        },
      });

      await syncFormFields(created.id, internal.schema);

      const form = toFormFromPrisma(created);
      const nameMap = await resolveUserNameMap([
        form.createdBy,
        form.updatedBy,
      ]);
      return toFormResponseDTO(applyUserNamesToForm(form, nameMap));
    }

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

    if (isReadFromPostgres()) {
      const doc = await prisma.form.findFirst({
        where: { id: fid.toString(), orgId: oid.toString() },
      });
      if (!doc) {
        throw new FormServiceError("Form not found", 404);
      }
      const form = toFormFromPrisma(doc);
      const nameMap = await resolveUserNameMap([
        form.createdBy,
        form.updatedBy,
      ]);
      return toFormResponseDTO(applyUserNamesToForm(form, nameMap));
    }

    const doc = await FormModel.findOne({ _id: fid, orgId: oid }).lean();
    if (!doc) {
      throw new FormServiceError("Form not found", 404);
    }

    const nameMap = await resolveUserNameMap([doc.createdBy, doc.updatedBy]);
    return toFormResponseDTO(applyUserNamesToForm(doc, nameMap));
  },

  async getFormForUser(formId: string) {
    const fid = ensureObjectId(formId, "formId");

    if (isReadFromPostgres()) {
      const version = await prisma.formVersion.findFirst({
        where: { formId: fid.toString() },
        orderBy: { version: "desc" },
      });

      if (!version)
        throw new FormServiceError("Form has no published version", 400);

      const form = await prisma.form.findUnique({
        where: { id: version.formId },
      });
      if (!form) throw new FormServiceError("Form not found", 404);

      const fhirForm = {
        _id: fid.toString(),
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
        schema: version.schemaSnapshot as unknown as FormField[],
        createdBy: "",
        updatedBy: "",
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      };

      return toFormResponseDTO(fhirForm);
    }

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

    if (isReadFromPostgres()) {
      const existing = await prisma.form.findUnique({
        where: { id: fid.toString() },
      });
      if (!existing) throw new FormServiceError("Form not found", 404);

      if (existing.orgId !== orgId)
        throw new FormServiceError(
          "Form is not part of your organisation",
          400,
        );

      const internal: Form = fromFormRequestDTO(fhir);
      if (
        FormService.hasSignatureField(internal.schema) &&
        !internal.requiredSigner
      ) {
        throw new FormServiceError("requiredSigner is required", 400);
      }

      const updated = await prisma.form.update({
        where: { id: fid.toString() },
        data: {
          name: internal.name,
          category: internal.category,
          description: internal.description ?? undefined,
          visibilityType: internal.visibilityType as PrismaFormVisibilityType,
          serviceId: Array.isArray(internal.serviceId)
            ? internal.serviceId
            : internal.serviceId
              ? [internal.serviceId]
              : [],
          speciesFilter: internal.speciesFilter ?? [],
          businessType: (internal.businessType ?? undefined) as
            | PrismaOrganizationType
            | undefined,
          requiredSigner: (internal.requiredSigner ?? undefined) as
            | PrismaFormRequiredSigner
            | undefined,
          schema: internal.schema as unknown as Prisma.InputJsonValue,
          updatedBy: userId,
          status: "draft",
        },
      });

      await syncFormFields(fid.toString(), internal.schema);

      const form = toFormFromPrisma(updated);
      const nameMap = await resolveUserNameMap([
        form.createdBy,
        form.updatedBy,
      ]);
      return applyUserNamesToForm(form, nameMap);
    }

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

    if (isReadFromPostgres()) {
      const form = await prisma.form.findUnique({
        where: { id: fid.toString() },
      });
      if (!form) throw new FormServiceError("Form not found", 404);

      const lastVersion = await prisma.formVersion.findFirst({
        where: { formId: fid.toString() },
        orderBy: { version: "desc" },
      });
      const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

      const fieldsSnapshot = flattenFields(
        form.schema as unknown as FormField[],
      );

      await prisma.formVersion.create({
        data: {
          formId: fid.toString(),
          version: nextVersion,
          schemaSnapshot: form.schema as unknown as Prisma.InputJsonValue,
          fieldsSnapshot: fieldsSnapshot as unknown as Prisma.InputJsonValue,
          publishedAt: new Date(),
        },
      });

      await prisma.form.update({
        where: { id: fid.toString() },
        data: {
          status: "published",
          updatedBy: userId,
        },
      });

      return { formId, version: nextVersion };
    }

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

    if (isReadFromPostgres()) {
      const form = await prisma.form.findUnique({
        where: { id: fid.toString() },
      });
      if (!form) throw new FormServiceError("Form not found", 404);

      const updated = await prisma.form.update({
        where: { id: fid.toString() },
        data: { status: "draft", updatedBy: userId },
      });
      return toFormFromPrisma(updated);
    }

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

    if (isReadFromPostgres()) {
      const form = await prisma.form.findUnique({
        where: { id: fid.toString() },
      });
      if (!form) throw new FormServiceError("Form not found", 404);

      const updated = await prisma.form.update({
        where: { id: fid.toString() },
        data: { status: "archived", updatedBy: userId },
      });
      return toFormFromPrisma(updated);
    }

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
    if (isReadFromPostgres()) {
      const created = await prisma.formSubmission.create({
        data: {
          formId: formIdString,
          formVersion: submission.formVersion,
          appointmentId: submission.appointmentId ?? undefined,
          companionId: submission.companionId ?? undefined,
          parentId: submission.parentId ?? undefined,
          submittedBy: submission.submittedBy ?? undefined,
          answers: submission.answers as unknown as Prisma.InputJsonValue,
          submittedAt: submission.submittedAt,
          signing: (signing ?? undefined) as unknown as Prisma.InputJsonValue,
        },
      });

      if (submission.appointmentId) {
        await prisma.appointment.updateMany({
          where: { id: submission.appointmentId },
          data: {
            formIds: {
              push: formIdString,
            },
          },
        });
      }

      if (submission.companionId) {
        const form = await prisma.form.findUnique({
          where: { id: formIdString },
          select: { orgId: true, name: true },
        });

        if (form?.orgId) {
          await AuditTrailService.recordSafely({
            organisationId: form.orgId,
            companionId: submission.companionId,
            eventType: "FORM_SUBMITTED",
            actorType: submission.parentId ? "PARENT" : "SYSTEM",
            actorId: submission.parentId ?? null,
            entityType: "FORM",
            entityId: formIdString,
            metadata: {
              submissionId: created.id,
              appointmentId: submission.appointmentId,
              formName: form.name,
            },
          });
        }
      }

      return {
        ...submission,
        _id: created.id,
      };
    }

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

    if (isReadFromPostgres()) {
      const sub = await prisma.formSubmission.findUnique({
        where: { id: sid.toString() },
      });
      if (!sub) throw new FormServiceError("Submission not found", 404);

      const version = await prisma.formVersion.findFirst({
        where: { formId: sub.formId, version: sub.formVersion },
      });

      const normalized: FormSubmission = {
        _id: sub.id,
        formId: sub.formId,
        formVersion: sub.formVersion,
        appointmentId: sub.appointmentId ?? undefined,
        companionId: sub.companionId ?? undefined,
        parentId: sub.parentId ?? undefined,
        submittedBy: sub.submittedBy ?? undefined,
        answers: sub.answers as Record<string, unknown>,
        submittedAt: sub.submittedAt,
      };

      return toFHIRQuestionnaireResponse(
        normalized,
        (version?.schemaSnapshot ?? undefined) as unknown as FormField[],
      );
    }

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

    if (isReadFromPostgres()) {
      return prisma.formSubmission.findMany({
        where: { formId: fid.toString() },
        orderBy: { submittedAt: "desc" },
      });
    }

    return FormSubmissionModel.find({ formId: fid })
      .sort({ submittedAt: -1 })
      .lean();
  },

  async listSubmissionsForCompanionInOrganisation(params: {
    organisationId: string;
    companionId: string;
  }): Promise<CompanionFormSubmission[]> {
    const organisationId = ensureNonEmptyString(
      params.organisationId,
      "organisationId",
    );
    const companionId = ensureNonEmptyString(params.companionId, "companionId");

    if (isReadFromPostgres()) {
      const submissions = await prisma.formSubmission.findMany({
        where: { companionId },
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
            companionId: submission.companionId ?? undefined,
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
    }

    const submissions = await FormSubmissionModel.find({ companionId })
      .sort({ submittedAt: -1 })
      .lean();

    if (!submissions.length) return [];

    const formIds = [
      ...new Set(
        submissions
          .map((submission) => normalizeObjectId(submission.formId))
          .filter(Boolean),
      ),
    ];
    const appointmentIds = [
      ...new Set(
        submissions
          .map((submission) => submission.appointmentId)
          .filter((id): id is string => Boolean(id))
          .filter((id) => Types.ObjectId.isValid(id)),
      ),
    ];

    const [forms, appointments] = await Promise.all([
      formIds.length
        ? FormModel.find({ _id: { $in: formIds } })
            .select({ name: 1, category: 1, orgId: 1 })
            .lean()
        : Promise.resolve([]),
      appointmentIds.length
        ? AppointmentModel.find({ _id: { $in: appointmentIds } })
            .select({ organisationId: 1 })
            .lean()
        : Promise.resolve([]),
    ]);

    const formMap = new Map(
      forms.map((form) => [normalizeObjectId(form._id), form]),
    );
    const appointmentOrgMap = new Map(
      appointments.map((appointment) => [
        appointment._id.toString(),
        appointment.organisationId,
      ]),
    );

    return submissions
      .filter((submission) => {
        const formId = normalizeObjectId(submission.formId);
        if (!formId) return false;
        if (submission.appointmentId) {
          return (
            appointmentOrgMap.get(submission.appointmentId) === organisationId
          );
        }
        const form = formMap.get(formId);
        return form?.orgId?.toString() === organisationId;
      })
      .map((submission) => {
        const formId = normalizeObjectId(submission.formId);
        const form = formId ? formMap.get(formId) : undefined;
        return {
          id: submission._id.toString(),
          formId: formId ?? "",
          formVersion: submission.formVersion,
          appointmentId: submission.appointmentId ?? undefined,
          companionId: submission.companionId ?? undefined,
          submittedBy: submission.submittedBy ?? undefined,
          submittedAt: submission.submittedAt,
          answers: (submission.answers ?? {}) as Record<string, unknown>,
          signing: submission.signing ?? undefined,
          formName: form?.name ?? null,
          formCategory: form?.category ?? null,
        };
      });
  },

  async getAutoSendForms(orgId: string, serviceId?: string) {
    const oid = ensureObjectId(orgId, "orgId");

    const filter: Record<string, unknown> = { orgId: oid, status: "published" };

    if (serviceId) filter.serviceId = { $in: [serviceId] };

    if (isReadFromPostgres()) {
      return prisma.form.findMany({
        where: {
          orgId: oid.toString(),
          status: "published",
          ...(serviceId ? { serviceId: { has: serviceId } } : {}),
        },
      });
    }

    return FormModel.find(filter).lean();
  },

  async listFormsForOrganisation(orgId: string) {
    const oid = ensureObjectId(orgId, "orgId");
    const docs = isReadFromPostgres()
      ? await prisma.form.findMany({ where: { orgId: oid.toString() } })
      : await FormModel.find({ orgId: oid }).lean();

    const nameMap = await resolveUserNameMap(
      docs.flatMap((doc) => [doc.createdBy, doc.updatedBy]),
    );

    return docs.map((doc) =>
      toFormResponseDTO(
        applyUserNamesToForm(
          isReadFromPostgres()
            ? toFormFromPrisma(
                doc as unknown as {
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
                },
              )
            : (doc as Form),
          nameMap,
        ),
      ),
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

    const appointment = isReadFromPostgres()
      ? await prisma.appointment.findUnique({
          where: { id: appointmentObjectId },
          select: { organisationId: true },
        })
      : await AppointmentModel.findById(appointmentObjectId)
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

    const submissions = (isReadFromPostgres()
      ? await prisma.formSubmission.findMany({
          where: { appointmentId: appointmentObjectId },
          orderBy: { submittedAt: "desc" },
        })
      : await FormSubmissionModel.find({
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

    const forms = (isReadFromPostgres()
      ? await prisma.form.findMany({
          where: { id: { in: formIds } },
          select: { id: true, category: true, schema: true },
        })
      : await FormModel.find({ _id: { $in: formIds } })
          .select({ _id: 1, category: 1, schema: 1 })
          .lean()) as unknown as FormLean[];

    const normalizedForms = isReadFromPostgres()
      ? (
          forms as unknown as Array<{
            id: string;
            category: Form["category"];
            schema: Form["schema"];
          }>
        ).map(
          (form) =>
            ({
              _id: form.id,
              category: form.category,
              schema: form.schema,
            }) as FormLean,
        )
      : forms;

    const formMap = new Map<string, FormLean>(
      normalizedForms.map((f) => [normalizeObjectId(f._id), f]),
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

    if (isReadFromPostgres()) {
      const form = await prisma.form.findFirst({
        where: {
          orgId: oid.toString(),
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
        schema: version.schemaSnapshot as unknown as FormField[],
        createdBy: "",
        updatedBy: "",
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
      };

      return toFormResponseDTO(clientForm);
    }

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

    if (isReadFromPostgres()) {
      const submission = await prisma.formSubmission.findUnique({
        where: { id: sid.toString() },
      });
      if (!submission) {
        throw new FormServiceError("Submission not found", 404);
      }

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
        schema: version.schemaSnapshot as unknown as FormField[],
        answers: submission.answers as Record<string, unknown>,
        submittedAt: submission.submittedAt,
      });

      const pdfBuffer = await renderPdf(vm);
      return pdfBuffer;
    }

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

    const appointment = isReadFromPostgres()
      ? await prisma.appointment.findUnique({
          where: { id: appointmentId },
          select: { organisationId: true, formIds: true },
        })
      : await AppointmentModel.findById(appointmentId).lean();
    if (!appointment) {
      throw new FormServiceError("Appointment not found", 404);
    }

    const orgType = await resolveOrganizationType(appointment.organisationId);

    const attachedFormIds = (appointment.formIds ?? []).map(String);
    let submissionFormIdStrings: string[] = [];
    if (isReadFromPostgres()) {
      const submissionFormIds = await prisma.formSubmission.findMany({
        where: { appointmentId },
        select: { formId: true },
      });
      submissionFormIdStrings = submissionFormIds.map((entry) => entry.formId);
    } else {
      const submissionFormIds = await FormSubmissionModel.distinct("formId", {
        appointmentId,
      });
      submissionFormIdStrings = (
        submissionFormIds as NormalizableObjectId[]
      ).map((id) => normalizeObjectId(id));
    }

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
