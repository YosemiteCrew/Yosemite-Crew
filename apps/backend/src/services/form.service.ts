import { Types } from "mongoose";
import {
  FormModel,
  FormFieldModel,
  FormVersionModel,
  FormSubmissionModel,
  FormSubmissionDocument,
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
} from "@yosemite-crew/types";
import { buildPdfViewModel, renderPdf } from "./formPDF.service";

export class FormServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "FormServiceError";
  }
}

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
};

export const FormService = {
  async create(orgId: string, fhir: FormRequestDTO, userId: string) {
    const oid = ensureObjectId(orgId, "orgId");

    const internal: Form = fromFormRequestDTO(fhir);
    internal.orgId = oid.toString();
    internal.createdBy = userId;
    internal.updatedBy = userId;
    internal.status = "draft";

    const doc = await FormModel.create({
      orgId: oid,
      name: internal.name,
      category: internal.category,
      description: internal.description,
      visibilityType: internal.visibilityType,
      serviceId: internal.serviceId,
      speciesFilter: internal.speciesFilter,
      status: "draft",
      schema: internal.schema,
      createdBy: userId,
      updatedBy: userId,
    });

    await syncFormFields(doc._id.toString(), internal.schema);

    return toFormResponseDTO(doc.toObject());
  },

  async getFormForAdmin(orgId: string, formId: string) {
    const oid = ensureObjectId(orgId, "orgId");
    const fid = ensureObjectId(formId, "formId");

    const doc = await FormModel.findOne({ _id: fid, orgId: oid });
    if (!doc) {
      throw new FormServiceError("Form not found", 404);
    }

    return toFormResponseDTO(doc.toObject());
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
      name: "",
      category: "",
      description: "",
      visibilityType: form.visibilityType,
      serviceId: undefined,
      speciesFilter: [],
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

    existing.name = internal.name;
    existing.category = internal.category;
    existing.description = internal.description;
    existing.visibilityType = internal.visibilityType;
    existing.serviceId = internal.serviceId;
    existing.speciesFilter = internal.speciesFilter;
    (existing.schema as unknown as FormField[]) = internal.schema;
    existing.updatedBy = userId;
    existing.status = "draft"; // IMPORTANT

    await existing.save();

    await syncFormFields(formId, internal.schema);

    return existing.toObject();
  },

  async publish(formId: string, userId: string) {
    const fid = ensureObjectId(formId, "formId");

    const form = await FormModel.findById(fid);
    if (!form) throw new FormServiceError("Form not found", 404);

    const fields = await FormFieldModel.find({ formId: fid }).lean();

    const lastVersion =
      (await FormVersionModel.findOne({ formId: fid }).sort({
        version: -1,
      })) || undefined;

    const nextVersion = lastVersion ? lastVersion.version + 1 : 1;

    await FormVersionModel.create({
      formId: fid,
      version: nextVersion,
      schemaSnapshot: form.schema,
      fieldsSnapshot: fields,
      publishedAt: new Date(),
    });

    form.status = "published";
    form.updatedBy = userId;
    await form.save();

    return { formId, version: nextVersion };
  },

  async unpublish(formId: string, userId: string) {
    const fid = ensureObjectId(formId, "formId");

    const form = await FormModel.findById(fid);
    if (!form) throw new FormServiceError("Form not found", 404);

    form.status = "draft"; // or "unpublished" if you want another state
    form.updatedBy = userId;
    await form.save();

    return form.toObject();
  },

  async archive(formId: string, userId: string) {
    const fid = ensureObjectId(formId, "formId");

    const form = await FormModel.findById(fid);
    if (!form) throw new FormServiceError("Form not found", 404);

    form.status = "archived";
    form.updatedBy = userId;
    await form.save();

    return form.toObject();
  },

  async submitFHIR(response: FormSubmissionRequestDTO, schema?: FormField[]) {
    const submission: FormSubmission = fromFormSubmissionRequestDTO(
      response,
      schema,
    );

    const created = await FormSubmissionModel.create({
      formId: submission.formId,
      formVersion: submission.formVersion,
      appointmentId: submission.appointmentId,
      companionId: submission.companionId,
      parentId: submission.parentId,
      submittedBy: submission.submittedBy,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
    });

    return created.toObject();
  },

  async getSubmission(submissionId: string) {
    const sid = ensureObjectId(submissionId, "submissionId");

    const sub = await FormSubmissionModel.findById(sid).lean();
    if (!sub) throw new FormServiceError("Submission not found", 404);

    const version = await FormVersionModel.findOne({
      formId: sub.formId,
      version: sub.formVersion,
    }).lean();

    const formId =
      typeof sub.formId === "string"
        ? sub.formId
        : sub.formId instanceof Types.ObjectId
          ? sub.formId.toHexString()
          : "";

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
    const docs = await FormModel.find({ orgId: oid });

    return docs.map((doc) => toFormResponseDTO(doc));
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

    const submissions = (await FormSubmissionModel.find({ appointmentId })
      .sort({ submittedAt: -1 })
      .lean()) as unknown as SubmissionLean[];

    if (!submissions.length) {
      return {
        appointmentId,
        soapNotes: {
          Subjective: [],
          Objective: [],
          Assessment: [],
          Plan: [],
        },
      };
    }

    // Load forms for soapType lookup
    const formIds: string[] = [
      ...new Set(
        submissions.map((submission) => normalizeObjectId(submission.formId)),
      ),
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

    const grouped: SoapNoteGroup = {
      Subjective: [],
      Objective: [],
      Assessment: [],
      Plan: [],
      Discharge: [],
    };

    for (const sub of submissions) {
      const form = formMap.get(normalizeObjectId(sub.formId));
      if (!form) continue;

      const soapType =
        form.category === "SOAP-Subjective"
          ? "Subjective"
          : form.category === "SOAP-Objective"
            ? "Objective"
            : form.category === "SOAP-Assessment"
              ? "Assessment"
              : form.category === "SOAP-Plan"
                ? "Plan"
                : form.category === "Discharge"
                  ? "Discharge"
                  : undefined;

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
      Object.keys(grouped).forEach((k) => {
        grouped[k as keyof typeof grouped] = grouped[
          k as keyof typeof grouped
        ].slice(0, 1);
      });
    }

    return {
      appointmentId,
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

  async generatePDFForSubmission(
    submissionId: string,
  ): Promise<Buffer> {
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
};
