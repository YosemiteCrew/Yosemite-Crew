import { describe, expect, it } from "@jest/globals";
import { resolveDocumentPdfTemplate } from "../../src/services/document-pdf-template-registry.service";

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
});
