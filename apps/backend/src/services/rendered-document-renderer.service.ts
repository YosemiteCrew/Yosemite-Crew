import { TemplateKind } from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
  generateClinicalPdfWithMetadata,
  generateResolvedTemplatePdfWithMetadata,
  type ClinicalDocumentType,
  type DischargeSummaryDocumentData,
  type OrganizationBranding,
  type PrescriptionDocumentData,
  type ResolvedTemplatePdfInput,
  type SoapNoteDocumentData,
} from "@yosemite-crew/lib";
import { prisma } from "src/config/prisma";
import {
  renderPdf,
  type PdfField,
  type PdfSection,
  type PdfBranding,
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
  version: {
    id: string;
    version: number;
    schemaSnapshot: Prisma.JsonValue;
    renderConfigSnapshot: Prisma.JsonValue;
    validationSnapshot: Prisma.JsonValue;
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
  logoUrl?: string | null;
  phoneNo: string;
  email: string | null;
  website: string | null;
  address: {
    addressLine: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null;
};

const DEFAULT_SIGNATURE_PLACEMENT = {
  pageNumber: 1,
  pageX: 330,
  pageY: 700,
  width: 220,
  height: 96,
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
    logoUrl: organization.logoUrl ?? organization.imageUrl,
    phoneNo: organization.phoneNo,
    website: organization.website,
  };
};

const buildSharedOrganizationBranding = (
  organization: OrganizationBrand,
): OrganizationBranding => {
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
    name: organization.name,
    addressLine1: addressLines[0] ?? organization.name,
    addressLine2: addressLines.slice(1).join(" • ") || undefined,
    phone: organization.phoneNo,
    email: organization.email ?? undefined,
    logoUrl: organization.logoUrl ?? organization.imageUrl,
  };
};

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

const loadTemplateVersionOrThrow = async (
  templateId: string,
  version: number,
) => {
  const record = await prisma.templateVersion.findUnique({
    where: {
      templateId_version: {
        templateId,
        version,
      },
    },
    select: {
      id: true,
      version: true,
      schemaSnapshot: true,
      renderConfigSnapshot: true,
      validationSnapshot: true,
    },
  });

  if (!record) {
    throw new Error("Template version not found");
  }

  return record;
};

const loadLatestTemplateVersionOrThrow = async (templateId: string) => {
  const record = await prisma.templateVersion.findFirst({
    where: {
      templateId,
    },
    orderBy: {
      version: "desc",
    },
    select: {
      id: true,
      version: true,
      schemaSnapshot: true,
      renderConfigSnapshot: true,
      validationSnapshot: true,
    },
  });

  if (!record) {
    throw new Error("Template version not found");
  }

  return record;
};

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

  const version = await loadTemplateVersionOrThrow(
    record.templateId,
    record.templateVersion,
  );

  return {
    ...record,
    version,
  } as unknown as TemplateInstanceDocumentSource;
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
      email: true,
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

const buildResolvedTemplatePdfInput = (
  input: RenderedDocumentPdfSource,
  organization: OrganizationBrand,
  template: ResolvedTemplatePdfInput["template"],
  data: Record<string, unknown>,
): ResolvedTemplatePdfInput => ({
  organization: buildSharedOrganizationBranding(organization),
  template,
  data,
  title: input.title,
  signature: {
    status: "PENDING",
    label: "Signature",
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const readString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    return value.trim() || undefined;
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

  if (Array.isArray(value)) {
    const items = value
      .map((item) => readString(item))
      .filter((item): item is string => Boolean(item));
    return items.length ? items.join("\n") : undefined;
  }

  if (isRecord(value)) {
    for (const key of [
      "html",
      "text",
      "value",
      "content",
      "body",
      "richText",
    ]) {
      const nested = readString(value[key]);
      if (nested) {
        return nested;
      }
    }
  }

  return stringifyValue(value) || undefined;
};

const readStringList = (value: unknown): string[] => {
  if (value === undefined || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => readStringList(item)).filter(Boolean);
  }

  const text = readString(value);
  if (!text) {
    return [];
  }

  return text
    .split(/\r?\n/gu)
    .map((item) => item.trim())
    .filter(Boolean);
};

const readMetadata = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

const readFirstString = (
  source: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = readString(source[key]);
    if (value) {
      return value;
    }
  }

  return undefined;
};

const normalizePrescriptionItems = (
  value: unknown,
): PrescriptionDocumentData["items"] => {
  const items = Array.isArray(value) ? value : [];

  return items.map((item) => {
    if (isRecord(item)) {
      return {
        medication:
          readFirstString(item, ["medication", "name", "drug", "product"]) ??
          stringifyValue(item) ??
          "",
        strength: readFirstString(item, ["strength", "doseStrength"]),
        dosage: readFirstString(item, ["dosage", "dose"]),
        frequency: readFirstString(item, ["frequency", "freq"]),
        duration: readFirstString(item, ["duration", "days"]),
        quantity: readFirstString(item, ["quantity", "qty"]),
        instructions: readFirstString(item, [
          "instructions",
          "instruction",
          "sig",
        ]),
      };
    }

    return {
      medication: readString(item) ?? "",
    };
  });
};

type AppointmentClinicalHeader = {
  leadName?: string;
  patientName?: string;
  clientName?: string;
  clientId?: string;
  clientContact?: string;
  speciesBreed?: string;
  ageSex?: string;
};

const readAppointmentContact = (
  value: Record<string, unknown>,
): string | undefined =>
  readFirstString(value, [
    "clientContact",
    "contact",
    "phone",
    "phoneNumber",
    "phoneNo",
    "email",
  ]);

const readAppointmentHeader = (
  appointment: Record<string, unknown>,
): AppointmentClinicalHeader => {
  const patient = isRecord(appointment.patient) ? appointment.patient : {};
  const lead = isRecord(appointment.lead) ? appointment.lead : {};
  const parent = isRecord(patient.parent) ? patient.parent : {};
  const species = readFirstString(patient, ["species", "speciesName"]);
  const breed = readFirstString(patient, ["breed", "breedName"]);

  return {
    leadName:
      readFirstString(lead, ["name", "display"]) ??
      readString(lead.id) ??
      undefined,
    patientName: readFirstString(patient, ["name", "display"]) ?? undefined,
    clientName:
      readFirstString(parent, ["name", "display"]) ??
      readString(parent.id) ??
      undefined,
    clientId:
      readFirstString(parent, ["clientId", "id"]) ?? readString(parent.id),
    clientContact: readAppointmentContact(parent),
    speciesBreed:
      species && breed
        ? `${species} / ${breed}`
        : (species ?? breed ?? undefined),
    ageSex:
      readFirstString(patient, ["ageSex", "age", "sex", "gender"]) ?? undefined,
  };
};

const loadAppointmentClinicalHeader = async (
  appointmentId: string | null | undefined,
): Promise<AppointmentClinicalHeader> => {
  if (!appointmentId) {
    return {};
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { patient: true, lead: true },
  });

  if (!appointment) {
    return {};
  }

  return readAppointmentHeader({
    patient: appointment.patient as unknown as Record<string, unknown>,
    lead: appointment.lead as unknown as Record<string, unknown>,
  });
};

const buildTemplateFreeSoapNotePdfInput = async (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
  organization: OrganizationBranding,
): Promise<{
  documentType: ClinicalDocumentType;
  organization: OrganizationBranding;
  data: SoapNoteDocumentData;
}> => {
  const metadata = readMetadata(record.data.metadata);
  const header = await loadAppointmentClinicalHeader(
    record.artifact.appointmentId,
  );

  return {
    documentType: "SOAP_NOTE",
    organization,
    data: {
      title: input.title,
      date: record.artifact.updatedAt,
      appointmentId:
        record.artifact.appointmentId ??
        readFirstString(metadata, ["appointmentId"]) ??
        "—",
      doctorName:
        header.leadName ??
        readFirstString(metadata, ["doctorName", "providerName", "doctor"]) ??
        readString(record.artifact.authorId) ??
        "—",
      patientName:
        header.patientName ??
        readFirstString(metadata, ["patientName", "patient"]) ??
        "—",
      speciesBreed:
        header.speciesBreed ??
        readFirstString(metadata, ["speciesBreed", "species", "breed"]) ??
        "—",
      ageSex:
        header.ageSex ??
        readFirstString(metadata, ["ageSex", "age", "sex"]) ??
        "—",
      clientName:
        header.clientName ??
        readFirstString(metadata, ["clientName", "ownerName", "owner"]) ??
        "—",
      clientId:
        header.clientId ??
        readFirstString(metadata, ["clientId", "ownerId"]) ??
        "—",
      subjective: (record.data.subjective ??
        metadata.subjective ??
        "") as unknown as string,
      objective: (record.data.objective ??
        metadata.objective ??
        "") as unknown as string,
      assessment: (record.data.assessment ??
        metadata.assessment ??
        "") as unknown as string,
      plan: (record.data.plan ?? metadata.plan ?? "") as unknown as string,
      printedBy:
        readFirstString(metadata, [
          "printedBy",
          "printedByName",
          "authorName",
        ]) ?? readString(record.artifact.authorId),
      signature: {
        status: "PENDING",
        label: "Signature",
      },
    },
  };
};

const buildTemplateFreePrescriptionPdfInput = async (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
  organization: OrganizationBranding,
): Promise<{
  documentType: ClinicalDocumentType;
  organization: OrganizationBranding;
  data: PrescriptionDocumentData;
}> => {
  const metadata = readMetadata(record.data.metadata);
  const header = await loadAppointmentClinicalHeader(
    record.artifact.appointmentId,
  );

  return {
    documentType: "PRESCRIPTION",
    organization,
    data: {
      title: input.title,
      date: record.artifact.updatedAt,
      appointmentId:
        record.artifact.appointmentId ??
        readFirstString(metadata, ["appointmentId"]) ??
        "—",
      prescriptionId: record.artifact.id,
      leadName:
        header.leadName ??
        readFirstString(metadata, [
          "leadName",
          "doctorName",
          "providerName",
          "doctor",
        ]) ??
        readString(record.artifact.authorId) ??
        "—",
      patientName:
        header.patientName ??
        readFirstString(metadata, ["patientName", "patient"]) ??
        "—",
      speciesBreed:
        header.speciesBreed ??
        readFirstString(metadata, ["speciesBreed", "species", "breed"]) ??
        "—",
      ageSex:
        header.ageSex ??
        readFirstString(metadata, ["ageSex", "age", "sex"]) ??
        "—",
      clientName:
        header.clientName ??
        readFirstString(metadata, ["clientName", "ownerName", "owner"]) ??
        "—",
      clientId:
        header.clientId ??
        readFirstString(metadata, ["clientId", "ownerId"]) ??
        "—",
      clientContact:
        header.clientContact ??
        readFirstString(metadata, [
          "clientContact",
          "contact",
          "phone",
          "phoneNo",
        ]) ??
        "—",
      items: normalizePrescriptionItems(
        record.data.items ?? record.data.medications,
      ),
      notes: (record.data.notes ?? metadata.notes ?? "") as unknown as string,
      printedBy:
        readFirstString(metadata, [
          "printedBy",
          "printedByName",
          "authorName",
        ]) ?? readString(record.artifact.authorId),
      signature: {
        status: "PENDING",
        label: "Signature",
      },
    },
  };
};

const buildTemplateFreeDischargeSummaryPdfInput = async (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
  organization: OrganizationBranding,
): Promise<{
  documentType: ClinicalDocumentType;
  organization: OrganizationBranding;
  data: DischargeSummaryDocumentData;
}> => {
  const metadata = readMetadata(record.data.metadata);
  const header = await loadAppointmentClinicalHeader(
    record.artifact.appointmentId,
  );
  const summaryText = (record.data.summary ??
    metadata.summary ??
    "") as unknown as string;
  const instructionsText = (record.data.instructions ??
    metadata.instructions ??
    "") as unknown as string;
  const followUpText = (record.data.followUp ??
    metadata.followUp ??
    "") as unknown as string;

  return {
    documentType: "DISCHARGE_SUMMARY",
    organization,
    data: {
      title: input.title,
      date: record.artifact.updatedAt,
      appointmentId:
        record.artifact.appointmentId ??
        readFirstString(metadata, ["appointmentId"]) ??
        "—",
      doctorName:
        header.leadName ??
        readFirstString(metadata, ["doctorName", "providerName", "doctor"]) ??
        readString(record.artifact.authorId) ??
        "—",
      patientName:
        header.patientName ??
        readFirstString(metadata, ["patientName", "patient"]) ??
        "—",
      speciesBreed:
        header.speciesBreed ??
        readFirstString(metadata, ["speciesBreed", "species", "breed"]) ??
        "—",
      ageSex:
        header.ageSex ??
        readFirstString(metadata, ["ageSex", "age", "sex"]) ??
        "—",
      clientName:
        header.clientName ??
        readFirstString(metadata, ["clientName", "ownerName", "owner"]) ??
        "—",
      clientId:
        header.clientId ??
        readFirstString(metadata, ["clientId", "ownerId"]) ??
        "—",
      contact:
        header.clientContact ??
        readFirstString(metadata, ["contact", "phone", "phoneNo"]) ??
        "—",
      chiefComplaint: (metadata.chiefComplaint ??
        record.data.summary ??
        "") as unknown as string,
      treatmentSummary: (metadata.treatmentSummary ??
        summaryText ??
        "") as unknown as string,
      procedures: readStringList(
        metadata.procedures ?? record.data.medications,
      ),
      diagnostics: readStringList(
        record.data.diagnoses ?? metadata.diagnostics,
      ),
      dischargeSummary: (metadata.dischargeSummary ??
        summaryText ??
        "") as unknown as string,
      homeCare: readStringList(
        metadata.homeCare ?? instructionsText ?? followUpText,
      ),
      emergencyCare: readStringList(
        metadata.emergencyCare ?? metadata.emergencyInstructions,
      ),
      emergencyContact: (metadata.emergencyContact ??
        metadata.contact ??
        readFirstString(metadata, ["contact", "phone"]) ??
        "—") as unknown as string,
      printedBy:
        readFirstString(metadata, [
          "printedBy",
          "printedByName",
          "authorName",
        ]) ?? readString(record.artifact.authorId),
      signature: {
        status: "PENDING",
        label: "Signature",
      },
    },
  };
};

const renderTemplateFreeClinicalArtifactPdf = async (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
  organization: OrganizationBranding,
) => {
  switch (input.source.templateKind) {
    case "SOAP_NOTE":
      return generateClinicalPdfWithMetadata(
        await buildTemplateFreeSoapNotePdfInput(input, record, organization),
      );
    case "PRESCRIPTION":
      return generateClinicalPdfWithMetadata(
        await buildTemplateFreePrescriptionPdfInput(
          input,
          record,
          organization,
        ),
      );
    case "DISCHARGE_SUMMARY":
      return generateClinicalPdfWithMetadata(
        await buildTemplateFreeDischargeSummaryPdfInput(
          input,
          record,
          organization,
        ),
      );
    default:
      return undefined;
  }
};

const buildClinicalArtifactResolvedTemplate = async (
  input: RenderedDocumentPdfSource,
  record: ClinicalArtifactDocumentSource,
) => {
  if (record.artifact.templateId === null) {
    return undefined;
  }

  const templateVersion =
    record.artifact.templateVersion === null
      ? await loadLatestTemplateVersionOrThrow(record.artifact.templateId)
      : await loadTemplateVersionOrThrow(
          record.artifact.templateId,
          record.artifact.templateVersion,
        );

  return {
    templateId: record.artifact.templateId,
    templateVersion: templateVersion.version,
    templateVersionId: templateVersion.id,
    source: "CLINICAL_ARTIFACT",
    ownerUserId: null,
    kind: input.source.templateKind as string,
    name: input.title,
    reason: "Rendered from a persisted clinical artifact.",
    schemaSnapshot: {
      sections:
        (
          templateVersion.schemaSnapshot as {
            sections?: ResolvedTemplatePdfInput["template"]["schemaSnapshot"]["sections"];
          }
        ).sections ?? [],
    },
    renderConfigSnapshot:
      (templateVersion.renderConfigSnapshot as Record<
        string,
        unknown
      > | null) ?? null,
    validationSnapshot:
      (templateVersion.validationSnapshot as Record<string, unknown> | null) ??
      null,
    appliesTo: null,
  };
};

const loadClinicalDocumentByIdOrArtifactId = async <
  TRecord extends {
    artifact: {
      organisationId: string;
    };
  } | null,
>(
  primaryLoader: () => Promise<TRecord>,
  fallbackLoader: () => Promise<TRecord>,
  notFoundMessage: string,
  organizationId: string,
  ownershipMessage: string,
) => {
  const record = await primaryLoader();
  const fallbackRecord = record ?? (await fallbackLoader());
  if (!fallbackRecord) {
    throw new Error(notFoundMessage);
  }

  if (fallbackRecord.artifact.organisationId !== organizationId) {
    throw new Error(ownershipMessage);
  }

  return fallbackRecord;
};

const loadClinicalArtifactDocument = async (
  source: RenderedDocumentSource,
): Promise<ClinicalArtifactDocumentSource> => {
  const loaders: Record<string, ClinicalArtifactLoaderConfig> = {
    SOAP_NOTE: {
      load: async (clinicalSource) => {
        const record = await loadClinicalDocumentByIdOrArtifactId(
          () =>
            prisma.soapNote.findUnique({
              where: { id: clinicalSource.sourceId },
              include: { artifact: true },
            }),
          () =>
            prisma.soapNote.findFirst({
              where: { artifactId: clinicalSource.sourceId },
              include: { artifact: true },
            }),
          "SOAP note not found",
          clinicalSource.organisationId,
          "SOAP note does not belong to organisation",
        );

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
        const record = await loadClinicalDocumentByIdOrArtifactId(
          () =>
            prisma.prescription.findUnique({
              where: { id: clinicalSource.sourceId },
              include: { artifact: true, items: true },
            }),
          () =>
            prisma.prescription.findFirst({
              where: { artifactId: clinicalSource.sourceId },
              include: { artifact: true, items: true },
            }),
          "Prescription not found",
          clinicalSource.organisationId,
          "Prescription does not belong to organisation",
        );

        return {
          artifact: record.artifact,
          data: {
            items: record.items,
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
        const record = await loadClinicalDocumentByIdOrArtifactId(
          () =>
            prisma.dischargeSummary.findUnique({
              where: { id: clinicalSource.sourceId },
              include: { artifact: true },
            }),
          () =>
            prisma.dischargeSummary.findFirst({
              where: { artifactId: clinicalSource.sourceId },
              include: { artifact: true },
            }),
          "Discharge summary not found",
          clinicalSource.organisationId,
          "Discharge summary does not belong to organisation",
        );

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
        const record = await loadClinicalDocumentByIdOrArtifactId(
          () =>
            prisma.vitalRecord.findUnique({
              where: { id: clinicalSource.sourceId },
              include: { artifact: true },
            }),
          () =>
            prisma.vitalRecord.findFirst({
              where: { artifactId: clinicalSource.sourceId },
              include: { artifact: true },
            }),
          "Vital record not found",
          clinicalSource.organisationId,
          "Vital record does not belong to organisation",
        );

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

export const renderRenderedDocumentPdfWithMetadata = async (
  input: RenderedDocumentPdfSource,
): Promise<{
  pdf: Buffer;
  pageCount: number;
  signaturePlacement: {
    pageNumber: number;
    pageX: number;
    pageY: number;
    width: number;
    height: number;
  };
}> => {
  switch (input.source.sourceKind) {
    case "TEMPLATE_INSTANCE": {
      const record = await loadTemplateInstanceDocument(input.source);
      const organization = await loadOrganizationBrand(
        input.source.organisationId,
      );
      return generateResolvedTemplatePdfWithMetadata(
        buildResolvedTemplatePdfInput(
          input,
          organization,
          {
            templateId: record.templateId,
            templateVersion: record.templateVersion,
            templateVersionId: record.version.id,
            source: "TEMPLATE_INSTANCE",
            ownerUserId: null,
            kind: record.template.kind,
            name: record.template.name,
            reason: "Rendered from a persisted template instance.",
            schemaSnapshot: {
              sections:
                (
                  record.version.schemaSnapshot as {
                    sections?: ResolvedTemplatePdfInput["template"]["schemaSnapshot"]["sections"];
                  }
                ).sections ?? [],
            },
            renderConfigSnapshot:
              (record.version.renderConfigSnapshot as Record<
                string,
                unknown
              > | null) ?? null,
            validationSnapshot:
              (record.version.validationSnapshot as Record<
                string,
                unknown
              > | null) ?? null,
            appliesTo: null,
          },
          record.data as Record<string, unknown>,
        ),
      );
    }
    case "FORM_SUBMISSION": {
      const record = await loadFormSubmissionDocument(input.source);
      const organization = await loadOrganizationBrand(
        input.source.organisationId,
      );

      return {
        pdf: await renderPdf(buildFormSubmissionViewModel(input, record), {
          templateKind: "FORM",
          branding: buildOrganizationBranding(organization),
        }),
        pageCount: 1,
        signaturePlacement: DEFAULT_SIGNATURE_PLACEMENT,
      };
    }
    case "CLINICAL_ARTIFACT": {
      const record = await loadClinicalArtifactDocument(input.source);
      const organization = await loadOrganizationBrand(
        input.source.organisationId,
      );

      if (record.artifact.templateId === null) {
        const templateFreeRender = await renderTemplateFreeClinicalArtifactPdf(
          input,
          record,
          buildSharedOrganizationBranding(organization),
        );

        if (templateFreeRender) {
          return templateFreeRender;
        }
      }

      const template = await buildClinicalArtifactResolvedTemplate(
        input,
        record,
      );
      const appointmentHeader = await loadAppointmentClinicalHeader(
        record.artifact.appointmentId,
      );

      if (!template) {
        throw new Error("Clinical artifact template version not found");
      }

      return generateResolvedTemplatePdfWithMetadata(
        buildResolvedTemplatePdfInput(input, organization, template, {
          ...record.data,
          ...appointmentHeader,
        }),
      );
    }
    default:
      throw new Error("Unsupported rendered document source kind");
  }
};

export const renderRenderedDocumentPdf = async (
  input: RenderedDocumentPdfSource,
) => (await renderRenderedDocumentPdfWithMetadata(input)).pdf;
