import { TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { renderRenderedDocumentPdf } from "../../src/services/rendered-document-renderer.service";
import { renderPdf } from "../../src/services/formPDF.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
    formSubmission: {
      findUnique: jest.fn(),
    },
    form: {
      findUnique: jest.fn(),
    },
    formVersion: {
      findUnique: jest.fn(),
    },
    templateInstance: {
      findUnique: jest.fn(),
    },
    soapNote: {
      findUnique: jest.fn(),
    },
    prescription: {
      findUnique: jest.fn(),
    },
    dischargeSummary: {
      findUnique: jest.fn(),
    },
    vitalRecord: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  renderPdf: jest.fn(),
}));

describe("rendered-document-renderer service", () => {
  const mockedPrisma = prisma as unknown as {
    organization: { findUnique: jest.Mock };
    formSubmission: { findUnique: jest.Mock };
    form: { findUnique: jest.Mock };
    formVersion: { findUnique: jest.Mock };
    templateInstance: { findUnique: jest.Mock };
    soapNote: { findUnique: jest.Mock };
    prescription: { findUnique: jest.Mock };
    dischargeSummary: { findUnique: jest.Mock };
    vitalRecord: { findUnique: jest.Mock };
  };
  const mockedRenderPdf = renderPdf as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRenderPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("renders a template instance document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: "https://cdn.example/logo.png",
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-1",
      templateId: "template-1",
      templateVersion: 3,
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      authorId: "author-1",
      status: "COMPLETED",
      data: {
        patient: { name: "Milo" },
        consent: true,
        weight: 5.2,
      },
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      template: {
        name: "Intake Consent",
        kind: TemplateKind.FORM,
      },
    });

    await renderRenderedDocumentPdf({
      title: "Intake Consent",
      source: {
        sourceKind: "TEMPLATE_INSTANCE",
        sourceId: "instance-1",
        organisationId: "org-1",
        templateKind: TemplateKind.FORM,
        templateId: "template-1",
        templateVersion: 3,
      },
    });

    expect(mockedRenderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake Consent",
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Document Details" }),
          expect.objectContaining({ title: "Captured Data" }),
        ]),
      }),
      expect.objectContaining({
        templateKind: "FORM",
        branding: expect.objectContaining({
          organizationName: "MediCare Hospital",
          addressLines: expect.arrayContaining([
            "123 Clinic Road",
            "Mumbai, MH, 400001",
            "IN",
          ]),
          logoUrl: "https://cdn.example/logo.png",
        }),
      }),
    );
  });

  it("renders a form submission document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: "https://cdn.example/logo.png",
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-1",
      formId: "form-1",
      formVersion: 1,
      appointmentId: "appt-1",
      companionId: null,
      parentId: "parent-1",
      submittedBy: "user-1",
      answers: {
        patientName: "Milo",
        consent: true,
      },
      submittedAt: new Date("2026-06-14T00:00:00.000Z"),
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Intake Consent",
      category: "CONSENT",
      orgId: "org-1",
      schema: {},
    });
    mockedPrisma.formVersion.findUnique.mockResolvedValueOnce({
      schemaSnapshot: [],
    });

    await renderRenderedDocumentPdf({
      title: "Intake Consent",
      source: {
        sourceKind: "FORM_SUBMISSION",
        sourceId: "submission-1",
        organisationId: "org-1",
        templateKind: "FORM",
        templateId: "form-1",
        templateVersion: 1,
      },
    });

    expect(mockedRenderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake Consent",
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Document Details" }),
          expect.objectContaining({ title: "Captured Data" }),
        ]),
      }),
      expect.objectContaining({
        templateKind: "FORM",
      }),
    );
  });

  it("renders a SOAP note document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: "https://cdn.example/logo.png",
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: "soap-1",
      subjective: { history: "shortness of breath" },
      objective: { temp: 39.1 },
      assessment: { impression: "bronchitis" },
      plan: { treatment: "rest" },
      diagnoses: [{ code: "J20" }],
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "SIGNED",
        templateId: "template-1",
        templateVersion: 2,
        templateVersionId: "template-version-1",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "SOAP summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    await renderRenderedDocumentPdf({
      title: "SOAP Note",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "soap-1",
        organisationId: "org-1",
        templateKind: "SOAP_NOTE",
        templateId: "template-1",
        templateVersion: 2,
      },
    });

    expect(mockedRenderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "SOAP Note",
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Document Details" }),
          expect.objectContaining({ title: "Clinical Data" }),
        ]),
      }),
      expect.objectContaining({
        templateKind: "SOAP_NOTE",
      }),
    );
  });

  it("renders a prescription document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
      id: "rx-1",
      medications: [{ name: "Carprofen" }],
      instructions: ["Once daily"],
      notes: { note: "with food" },
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: null,
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: null,
        templateVersion: 1,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    await renderRenderedDocumentPdf({
      title: "Prescription",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "rx-1",
        organisationId: "org-1",
        templateKind: "PRESCRIPTION",
        templateVersion: 1,
      },
    });

    expect(mockedRenderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Prescription",
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Document Details" }),
          expect.objectContaining({ title: "Clinical Data" }),
        ]),
      }),
      expect.objectContaining({
        templateKind: "PRESCRIPTION",
      }),
    );
  });

  it("renders a vital record document pdf view model", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: {
        addressLine: "123 Clinic Road",
        city: "Mumbai",
        state: "MH",
        postalCode: "400001",
        country: "IN",
      },
    });
    mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
      id: "vital-1",
      measuredAt: new Date("2026-06-14T00:00:00.000Z"),
      recordedBy: "tech-1",
      vitals: { heartRate: 88 },
      notes: null,
      metadata: { source: "device" },
      artifact: {
        id: "artifact-3",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "VITAL_RECORD",
        status: "SIGNED",
        templateId: null,
        templateVersion: 1,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Vital summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    await renderRenderedDocumentPdf({
      title: "Vital Record",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "vital-1",
        organisationId: "org-1",
        templateKind: "VITAL_RECORD",
        templateVersion: 1,
      },
    });

    expect(mockedRenderPdf).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Vital Record",
        sections: expect.arrayContaining([
          expect.objectContaining({ title: "Document Details" }),
          expect.objectContaining({ title: "Clinical Data" }),
        ]),
      }),
      expect.objectContaining({
        templateKind: "VITAL_RECORD",
      }),
    );
  });

  it("rejects unsupported source kinds", async () => {
    await expect(
      renderRenderedDocumentPdf({
        title: "Unsupported",
        source: {
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: "missing",
          organisationId: "org-1",
          templateKind: TemplateKind.CARE_PATHWAY,
        },
      }),
    ).rejects.toThrow("Template instance not found");
  });

  it("rejects template instances outside the organisation", async () => {
    mockedPrisma.templateInstance.findUnique.mockResolvedValueOnce({
      id: "instance-1",
      organisationId: "org-2",
      templateId: "template-1",
      templateVersion: 3,
      appointmentId: null,
      caseId: null,
      encounterId: null,
      authorId: null,
      status: "COMPLETED",
      data: {},
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      template: {
        name: "Intake Consent",
        kind: TemplateKind.FORM,
      },
    });

    await expect(
      renderRenderedDocumentPdf({
        title: "Intake Consent",
        source: {
          sourceKind: "TEMPLATE_INSTANCE",
          sourceId: "instance-1",
          organisationId: "org-1",
          templateKind: TemplateKind.FORM,
          templateId: "template-1",
          templateVersion: 3,
        },
      }),
    ).rejects.toThrow("Template instance does not belong to organisation");
  });

  it("rejects missing clinical artifact records", async () => {
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(null);

    await expect(
      renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-missing",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
          templateVersion: 2,
        },
      }),
    ).rejects.toThrow("SOAP note not found");
  });
});
