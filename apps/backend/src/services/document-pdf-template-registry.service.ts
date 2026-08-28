import path from "node:path";

export type DocumentPdfTemplateKind =
  "FORM" | "SOAP_NOTE" | "PRESCRIPTION" | "DISCHARGE_SUMMARY" | "VITAL_RECORD";

type DocumentPdfTemplateDefinition = {
  fileName: string;
  label: string;
};

export const DOCUMENT_PDF_TEMPLATE_DIRECTORY = path.join(
  process.cwd(),
  "src/utils/pdf-templates",
);

/**
 * Refuses any path that resolves outside the PDF template directory.
 *
 * Every path that reaches the template reader today is built below from a
 * closed union of kinds, so none of them can be steered by a request. The
 * guard lives at the read itself rather than only here so a future caller that
 * builds a path from request data still cannot walk out of the directory — a
 * traversal would have to get past this to reach the filesystem.
 *
 * An absolute path is not rejected on sight: the registry always produces one.
 * What matters is where it lands, so both shapes are resolved against the
 * directory and judged on the result.
 */
export const assertDocumentPdfTemplatePath = (templatePath: string): void => {
  const root = path.resolve(DOCUMENT_PDF_TEMPLATE_DIRECTORY);
  const resolved = path.resolve(root, templatePath);
  const relative = path.relative(root, resolved);

  // The directory itself is refused too, but it is not an escape - it lands
  // exactly on the root - so it says so rather than claiming otherwise.
  if (relative === "") {
    throw new Error(
      `refusing to read "${templatePath}": it is the PDF template directory, not a file inside it`,
    );
  }

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(
      `refusing to read "${templatePath}": it resolves outside the PDF template directory`,
    );
  }
};

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
