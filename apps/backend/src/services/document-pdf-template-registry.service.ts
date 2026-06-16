import path from "node:path";

export type DocumentPdfTemplateKind =
  | "FORM"
  | "SOAP_NOTE"
  | "PRESCRIPTION"
  | "DISCHARGE_SUMMARY"
  | "VITAL_RECORD";

type DocumentPdfTemplateDefinition = {
  fileName: string;
  label: string;
};

const DOCUMENT_PDF_TEMPLATE_DIRECTORY = path.join(
  process.cwd(),
  "src/utils/pdf-templates",
);

const DOCUMENT_PDF_TEMPLATES: Record<
  DocumentPdfTemplateKind,
  DocumentPdfTemplateDefinition
> = {
  FORM: {
    fileName: "form.html",
    label: "Form",
  },
  SOAP_NOTE: {
    fileName: "soap-note.html",
    label: "SOAP note",
  },
  PRESCRIPTION: {
    fileName: "prescription.html",
    label: "Prescription",
  },
  DISCHARGE_SUMMARY: {
    fileName: "discharge-summary.html",
    label: "Discharge summary",
  },
  VITAL_RECORD: {
    fileName: "vital-record.html",
    label: "Vital record",
  },
};

export const resolveDocumentPdfTemplate = (kind: DocumentPdfTemplateKind) => {
  const template = DOCUMENT_PDF_TEMPLATES[kind];

  return {
    ...template,
    kind,
    path: path.join(DOCUMENT_PDF_TEMPLATE_DIRECTORY, template.fileName),
  };
};
