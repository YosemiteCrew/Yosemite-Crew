import { TemplateKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  renderPdf,
  type PdfField,
  type PdfSection,
  type PdfBranding,
  type PdfTemplateKind,
} from "src/services/formPDF.service";
import type { RenderedDocumentSource } from "@yosemite-crew/types";

type RenderedDocumentPdfSource = {
  title: string;
  source: RenderedDocumentSource;
};

type TemplateInstanceDocumentSource = {
  id: string;
  organisationId: string;
  templateId: string;
  templateVersion: number;
  appointmentId: string | null;
  caseId: string | null;
  encounterId: string | null;
  authorId: string | null;
  status: string;
  data: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
  template: {
    name: string;
    kind: TemplateKind;
  };
};

type FormSubmissionDocumentSource = {
  submission: {
    id: string;
    formId: string;
    formVersion: number;
    appointmentId: string | null;
    patientId: string | null;
    parentId: string | null;
    submittedBy: string | null;
    answers: Prisma.JsonValue;
    submittedAt: Date;
  };
  form: {
    name: string;
    category: string;
    orgId: string;
    schema: Prisma.JsonValue;
  };
  version: {
    schemaSnapshot: Prisma.JsonValue;
  };
};

type ClinicalArtifactDocumentSource = {
  artifact: {
    id: string;
    organisationId: string;
    appointmentId: string | null;
    caseId: string | null;
    encounterId: string | null;
    kind: string;
    status: string;
    templateId: string | null;
    templateVersion: number | null;
    templateVersionId: string | null;
    authorId: string | null;
    signedBy: string | null;
    signedAt: Date | null;
    summary: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  data: Record<string, unknown>;
};

type ClinicalArtifactLoaderConfig = {
  load: (
    source: RenderedDocumentSource,
  ) => Promise<ClinicalArtifactDocumentSource>;
};

type OrganizationBrand = {
  name: string;
  imageUrl: string | null;
  phoneNo: string;
  website: string | null;
  address: {
    addressLine: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
};

const humanizeLabel = (value: string) =>
  value
    .split(/[\s._/-]+/u)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const stringifyValue = (value: unknown): string => {
  if (value === undefined || value === null) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }

  return "[unsupported]";
};

const flattenJson = (value: unknown, path: string[] = []): PdfField[] => {
  if (value === undefined) {
    return [];
  }

  if (value === null || typeof value !== "object" || value instanceof Date) {
    const label = path.length ? humanizeLabel(path.join(" ")) : "Value";
    return [{ label, value: stringifyValue(value) }];
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      const label = path.length ? humanizeLabel(path.join(" ")) : "Value";
      return [{ label, value: "[]" }];
    }

    return value.flatMap((item, index) =>
      flattenJson(item, [...path, String(index + 1)]),
    );
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (!entries.length) {
    const label = path.length ? humanizeLabel(path.join(" ")) : "Value";
    return [{ label, value: "{}" }];
  }

  return entries.flatMap(([key, item]) => flattenJson(item, [...path, key]));
};

const buildDocumentDetailsSection = (
  title: string,
  source: RenderedDocumentSource,
  metadata: Record<string, unknown>,
): PdfSection => ({
  title: "Document Details",
  fields: [
    { label: "Title", value: title },
    { label: "Kind", value: source.templateKind },
    { label: "Source Kind", value: source.sourceKind },
    { label: "Source ID", value: source.sourceId },
    { label: "Organisation", value: source.organisationId },
    ...Object.entries(metadata).map(([label, value]) => ({
      label: humanizeLabel(label),
      value: stringifyValue(value),
    })),
  ],
});

const buildOrganizationBranding = (
  organization: OrganizationBrand,
): PdfBranding => {
  const addressLines = [
    organization.address?.addressLine,
    [
      organization.address?.city,
      organization.address?.state,
      organization.address?.postalCode,
    ]
      .filter((line): line is string => Boolean(line && line.trim()))
      .join(", "),
    organization.address?.country,
  ].filter((line): line is string => Boolean(line && line.trim()));

  return {
    organizationName: organization.name,
    addressLines,
    logoUrl: organization.imageUrl,
    phoneNo: organization.phoneNo,
    website: organization.website,
  };
};

const buildTemplateInstanceViewModel = (
  input: RenderedDocumentPdfSource,
  record: TemplateInstanceDocumentSource,
) => ({
  title: input.title,
  submittedAt: record.createdAt.toISOString(),
  sections: [
    buildDocumentDetailsSection(input.title, input.source, {
      templateName: record.template.name,
      templateVersion: record.templateVersion,
      templateId: record.templateId,
      templateKind: record.template.kind,
      appointmentId: record.appointmentId,
      caseId: record.caseId,
      encounterId: record.encounterId,
      authorId: record.authorId,
      status: record.status,
    }),
    {
      title: "Captured Data",
      fields: flattenJson(record.data),
    },
  ],
});

const buildFormSubmissionViewModel = (
  input: RenderedDocumentPdfSource,
  record: FormSubmissionDocumentSource,
) => ({
  title: input.title,
  submittedAt: record.submission.submittedAt.toISOString(),
  sections: [
    buildDocumentDetailsSection(input.title, input.source, {
      formName: record.form.name,
      formCategory: record.form.category,
      formId: record.submission.formId,
      formVersion: record.submission.formVersion,
      appointmentId: record.submission.appointmentId,
      patientId: record.submission.patientId,
      parentId: record.submission.parentId,
      submittedBy: record.submission.submittedBy,
    }),
    {
      title: "Captured Data",
      fields: flattenJson(record.submission.answers),
    },
  ],
});

const buildClinicalArtifactViewModel = (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
) => ({
  title: input.title,
  submittedAt: record.artifact.createdAt.toISOString(),
  sections: [
    buildDocumentDetailsSection(input.title, input.source, {
      templateVersion: record.artifact.templateVersion,
      templateVersionId: record.artifact.templateVersionId,
      templateId: record.artifact.templateId,
      appointmentId: record.artifact.appointmentId,
      caseId: record.artifact.caseId,
      encounterId: record.artifact.encounterId,
      authorId: record.artifact.authorId,
      signedBy: record.artifact.signedBy,
      signedAt: record.artifact.signedAt?.toISOString() ?? "",
      summary: record.artifact.summary,
      status: record.artifact.status,
    }),
    {
      title: "Clinical Data",
      fields: flattenJson(record.data),
    },
  ],
});

const loadTemplateInstanceDocument = async (
  source: RenderedDocumentSource,
): Promise<TemplateInstanceDocumentSource> => {
  const record = await prisma.templateInstance.findUnique({
    where: { id: source.sourceId },
    include: {
      template: {
        select: {
          name: true,
          kind: true,
        },
      },
    },
  });

  if (!record) {
    throw new Error("Template instance not found");
  }

  if (record.organisationId !== source.organisationId) {
    throw new Error("Template instance does not belong to organisation");
  }

  return record as unknown as TemplateInstanceDocumentSource;
};

const loadFormSubmissionDocument = async (
  source: RenderedDocumentSource,
): Promise<FormSubmissionDocumentSource> => {
  const submission = await prisma.formSubmission.findUnique({
    where: { id: source.sourceId },
  });

  if (!submission) {
    throw new Error("Form submission not found");
  }

  const form = await prisma.form.findUnique({
    where: { id: submission.formId },
  });

  if (!form) {
    throw new Error("Form not found");
  }

  if (source.templateId && source.templateId !== submission.formId) {
    throw new Error("Form submission does not match source form");
  }

  if (
    source.templateVersion !== undefined &&
    source.templateVersion !== submission.formVersion
  ) {
    throw new Error("Form submission does not match source version");
  }

  if (form.orgId !== source.organisationId) {
    throw new Error("Form submission does not belong to organisation");
  }

  const version = await prisma.formVersion.findUnique({
    where: {
      formId_version: {
        formId: submission.formId,
        version: submission.formVersion,
      },
    },
  });

  if (!version) {
    throw new Error("Form version not found");
  }

  return {
    submission: {
      id: submission.id,
      formId: submission.formId,
      formVersion: submission.formVersion,
      appointmentId: submission.appointmentId,
      patientId: submission.patientId,
      parentId: submission.parentId,
      submittedBy: submission.submittedBy,
      answers: submission.answers,
      submittedAt: submission.submittedAt,
    },
    form: {
      name: form.name,
      category: form.category,
      orgId: form.orgId,
      schema: form.schema,
    },
    version: {
      schemaSnapshot: version.schemaSnapshot,
    },
  };
};

const loadOrganizationBrand = async (
  organisationId: string,
): Promise<OrganizationBrand> => {
  const organization = await prisma.organization.findUnique({
    where: { id: organisationId },
    select: {
      name: true,
      imageUrl: true,
      phoneNo: true,
      website: true,
      address: {
        select: {
          addressLine: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
        },
      },
    },
  });

  if (!organization) {
    throw new Error("Organisation not found");
  }

  return organization;
};

const loadClinicalArtifactDocument = async (
  source: RenderedDocumentSource,
): Promise<ClinicalArtifactDocumentSource> => {
  const loaders: Record<string, ClinicalArtifactLoaderConfig> = {
    SOAP_NOTE: {
      load: async (clinicalSource) => {
        const record = await prisma.soapNote.findUnique({
          where: { id: clinicalSource.sourceId },
          include: { artifact: true },
        });

        if (!record) {
          throw new Error("SOAP note not found");
        }

        if (record.artifact.organisationId !== clinicalSource.organisationId) {
          throw new Error("SOAP note does not belong to organisation");
        }

        return {
          artifact: record.artifact,
          data: {
            subjective: record.subjective,
            objective: record.objective,
            assessment: record.assessment,
            plan: record.plan,
            diagnoses: record.diagnoses,
            metadata: record.metadata,
          },
        };
      },
    },
    PRESCRIPTION: {
      load: async (clinicalSource) => {
        const record = await prisma.prescription.findUnique({
          where: { id: clinicalSource.sourceId },
          include: { artifact: true },
        });

        if (!record) {
          throw new Error("Prescription not found");
        }

        if (record.artifact.organisationId !== clinicalSource.organisationId) {
          throw new Error("Prescription does not belong to organisation");
        }

        return {
          artifact: record.artifact,
          data: {
            medications: record.medications,
            instructions: record.instructions,
            notes: record.notes,
            metadata: record.metadata,
          },
        };
      },
    },
    DISCHARGE_SUMMARY: {
      load: async (clinicalSource) => {
        const record = await prisma.dischargeSummary.findUnique({
          where: { id: clinicalSource.sourceId },
          include: { artifact: true },
        });

        if (!record) {
          throw new Error("Discharge summary not found");
        }

        if (record.artifact.organisationId !== clinicalSource.organisationId) {
          throw new Error("Discharge summary does not belong to organisation");
        }

        return {
          artifact: record.artifact,
          data: {
            summary: record.summary,
            diagnoses: record.diagnoses,
            medications: record.medications,
            followUp: record.followUp,
            instructions: record.instructions,
            metadata: record.metadata,
          },
        };
      },
    },
    VITAL_RECORD: {
      load: async (clinicalSource) => {
        const record = await prisma.vitalRecord.findUnique({
          where: { id: clinicalSource.sourceId },
          include: { artifact: true },
        });

        if (!record) {
          throw new Error("Vital record not found");
        }

        if (record.artifact.organisationId !== clinicalSource.organisationId) {
          throw new Error("Vital record does not belong to organisation");
        }

        return {
          artifact: record.artifact,
          data: {
            measuredAt: record.measuredAt,
            recordedBy: record.recordedBy,
            vitals: record.vitals,
            notes: record.notes,
            metadata: record.metadata,
          },
        };
      },
    },
  };

  const loader = loaders[source.templateKind as keyof typeof loaders];
  if (!loader) {
    throw new Error("Unsupported clinical document kind");
  }

  return loader.load(source);
};

export const renderRenderedDocumentPdf = async (
  input: RenderedDocumentPdfSource,
) => {
  switch (input.source.sourceKind) {
    case "TEMPLATE_INSTANCE": {
      const record = await loadTemplateInstanceDocument(input.source);
      const organization = await loadOrganizationBrand(
        input.source.organisationId,
      );

      return renderPdf(buildTemplateInstanceViewModel(input, record), {
        templateKind: input.source.templateKind as PdfTemplateKind,
        branding: buildOrganizationBranding(organization),
      });
    }
    case "FORM_SUBMISSION": {
      const record = await loadFormSubmissionDocument(input.source);
      const organization = await loadOrganizationBrand(
        input.source.organisationId,
      );

      return renderPdf(buildFormSubmissionViewModel(input, record), {
        templateKind: "FORM",
        branding: buildOrganizationBranding(organization),
      });
    }
    case "CLINICAL_ARTIFACT": {
      const record = await loadClinicalArtifactDocument(input.source);
      const organization = await loadOrganizationBrand(
        input.source.organisationId,
      );

      return renderPdf(buildClinicalArtifactViewModel(input, record), {
        templateKind: input.source.templateKind as PdfTemplateKind,
        branding: buildOrganizationBranding(organization),
      });
    }
    default:
      throw new Error("Unsupported rendered document source kind");
  }
};
