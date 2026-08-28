import { describe, expect, it } from "@jest/globals";
import path from "node:path";
import {
  assertDocumentPdfTemplatePath,
  DOCUMENT_PDF_TEMPLATE_DIRECTORY,
  resolveDocumentPdfTemplate,
  type DocumentPdfTemplateKind,
} from "../../src/services/document-pdf-template-registry.service";

describe("document-pdf-template-registry service", () => {
  it("resolves the form template path and label", () => {
    const template = resolveDocumentPdfTemplate("FORM");

    expect(template).toEqual(
      expect.objectContaining({
        kind: "FORM",
        label: "Form",
      }),
    );
    expect(template.path).toContain("src/utils/pdf-templates/form.html");
  });

  it("resolves clinical document template paths", () => {
    const soapNote = resolveDocumentPdfTemplate("SOAP_NOTE");
    const prescription = resolveDocumentPdfTemplate("PRESCRIPTION");

    expect(soapNote.path).toContain("src/utils/pdf-templates/soap-note.html");
    expect(prescription.path).toContain(
      "src/utils/pdf-templates/prescription.html",
    );
  });

  describe("assertDocumentPdfTemplatePath", () => {
    const KINDS: DocumentPdfTemplateKind[] = [
      "FORM",
      "SOAP_NOTE",
      "PRESCRIPTION",
      "DISCHARGE_SUMMARY",
      "VITAL_RECORD",
    ];

    // The registry always builds an absolute path, so a guard that rejected
    // absolute paths on sight would reject every real template. Each kind is
    // asserted individually to keep that regression impossible to reintroduce.
    it.each(KINDS)("accepts the registry path for %s", (kind) => {
      const { path: templatePath } = resolveDocumentPdfTemplate(kind);

      expect(() => assertDocumentPdfTemplatePath(templatePath)).not.toThrow();
    });

    it("accepts a relative name inside the template directory", () => {
      expect(() => assertDocumentPdfTemplatePath("form.html")).not.toThrow();
    });

    it.each([
      ["a relative traversal", "../../../etc/passwd"],
      ["a traversal that re-enters", "subdir/../../../etc/passwd"],
      ["an absolute path elsewhere", "/etc/passwd"],
      [
        "an absolute traversal out of the directory",
        path.join(DOCUMENT_PDF_TEMPLATE_DIRECTORY, "..", "..", "secrets.env"),
      ],
      [
        "a sibling directory sharing the prefix",
        `${DOCUMENT_PDF_TEMPLATE_DIRECTORY}-private/form.html`,
      ],
    ])("rejects %s", (_label, templatePath) => {
      expect(() => assertDocumentPdfTemplatePath(templatePath)).toThrow(
        /resolves outside the PDF template directory/,
      );
    });

    it("rejects the template directory itself", () => {
      expect(() =>
        assertDocumentPdfTemplatePath(DOCUMENT_PDF_TEMPLATE_DIRECTORY),
      ).toThrow(/resolves outside the PDF template directory/);
    });
  });
});
