import { TemplateKind } from "@prisma/client";
import { prisma } from "src/config/prisma";
import { renderRenderedDocumentPdf } from "../../src/services/rendered-document-renderer.service";
import { renderPdf } from "../../src/services/formPDF.service";
import {
  generateClinicalPdfWithMetadata,
  generateResolvedTemplatePdfWithMetadata,
} from "@yosemite-crew/lib";

jest.mock("src/config/prisma", () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
    },
    appointment: {
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
    templateVersion: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    soapNote: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    prescription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    dischargeSummary: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    vitalRecord: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  renderPdf: jest.fn(),
}));

jest.mock("@yosemite-crew/lib", () => ({
  generateClinicalPdfWithMetadata: jest.fn(),
  generateResolvedTemplatePdfWithMetadata: jest.fn(),
}));

describe("rendered-document-renderer service", () => {
  const mockedPrisma = prisma as unknown as {
    organization: { findUnique: jest.Mock };
    appointment: { findUnique: jest.Mock };
    formSubmission: { findUnique: jest.Mock };
    form: { findUnique: jest.Mock };
    formVersion: { findUnique: jest.Mock };
    templateInstance: { findUnique: jest.Mock };
    templateVersion: { findUnique: jest.Mock; findFirst: jest.Mock };
    soapNote: { findUnique: jest.Mock; findFirst: jest.Mock };
    prescription: { findUnique: jest.Mock; findFirst: jest.Mock };
    dischargeSummary: { findUnique: jest.Mock; findFirst: jest.Mock };
    vitalRecord: { findUnique: jest.Mock; findFirst: jest.Mock };
  };
  const mockedRenderPdf = renderPdf as jest.Mock;
  const mockedGenerateClinicalPdfWithMetadata =
    generateClinicalPdfWithMetadata as jest.Mock;
  const mockedGenerateResolvedTemplatePdfWithMetadata =
    generateResolvedTemplatePdfWithMetadata as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRenderPdf.mockResolvedValue(Buffer.from("pdf"));
    mockedPrisma.appointment.findUnique.mockResolvedValue(null);
    mockedGenerateClinicalPdfWithMetadata.mockResolvedValue({
      pdf: Buffer.from("pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
    mockedGenerateResolvedTemplatePdfWithMetadata.mockResolvedValue({
      pdf: Buffer.from("pdf"),
      pageCount: 1,
      signaturePlacement: {
        pageNumber: 1,
        pageX: 340,
        pageY: 710,
        width: 220,
        height: 96,
      },
    });
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
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-1",
      version: 3,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
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

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake Consent",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "123 Clinic Road",
          logoUrl: "https://cdn.example/logo.png",
        }),
        template: expect.objectContaining({
          name: "Intake Consent",
          source: "TEMPLATE_INSTANCE",
          schemaSnapshot: expect.objectContaining({
            sections: [],
          }),
        }),
        signature: expect.objectContaining({
          status: "PENDING",
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
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-1",
      version: 2,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
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

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "SOAP Note",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "123 Clinic Road",
          logoUrl: "https://cdn.example/logo.png",
        }),
        template: expect.objectContaining({
          source: "CLINICAL_ARTIFACT",
          name: "SOAP Note",
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
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
    mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
      patient: {
        name: "Bella Hadid",
        species: "Canine",
        breed: "Bulldog",
        parent: {
          id: "CL-1001",
          name: "Yasmin Hadid",
          phoneNumber: "(512) 555 0111",
        },
      },
      lead: {
        name: "Dr. Tim Apple",
      },
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
      id: "rx-1",
      appointmentId: "appt-1",
      items: [],
      medications: [{ name: "Carprofen" }],
      instructions: ["Once daily"],
      notes: { note: "with food" },
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-2",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: "enc-1",
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: "template-2",
        templateVersion: 1,
        templateVersionId: "template-version-2",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-2",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
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

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Prescription",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "MediCare Hospital",
          logoUrl: null,
        }),
        data: expect.objectContaining({
          leadName: "Dr. Tim Apple",
          patientName: "Bella Hadid",
          clientName: "Yasmin Hadid",
          clientContact: "(512) 555 0111",
        }),
        template: expect.objectContaining({
          source: "CLINICAL_ARTIFACT",
          name: "Prescription",
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
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
        templateId: "template-3",
        templateVersion: 1,
        templateVersionId: "template-version-3",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Vital summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-3",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
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

    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Vital Record",
        organization: expect.objectContaining({
          name: "MediCare Hospital",
          addressLine1: "123 Clinic Road",
          logoUrl: null,
        }),
        template: expect.objectContaining({
          source: "CLINICAL_ARTIFACT",
          name: "Vital Record",
        }),
        signature: expect.objectContaining({
          status: "PENDING",
        }),
      }),
    );
  });

  it("renders a clinical artifact without loading template metadata when templateId is missing", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
      id: "soap-plain-1",
      subjective: { history: "vomiting" },
      objective: { temp: 38.9 },
      assessment: { impression: "gastritis" },
      plan: { treatment: "fluid therapy" },
      diagnoses: [],
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-plain-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "DRAFT",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "SOAP summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    await renderRenderedDocumentPdf({
      title: "SOAP Note",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "soap-plain-1",
        organisationId: "org-1",
        templateKind: "SOAP_NOTE",
      },
    });

    expect(mockedPrisma.templateVersion.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.templateVersion.findFirst).not.toHaveBeenCalled();
    expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "SOAP_NOTE",
        data: expect.objectContaining({
          title: "SOAP Note",
          subjective: { history: "vomiting" },
          objective: { temp: 38.9 },
          assessment: { impression: "gastritis" },
          plan: { treatment: "fluid therapy" },
          signature: expect.objectContaining({
            status: "PENDING",
          }),
        }),
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
          templateKind: "INPATIENT_SCHEDULE",
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
    mockedPrisma.soapNote.findFirst.mockResolvedValueOnce(null);

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

  it("falls back to artifactId when rendering a persisted clinical artifact", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      items: [],
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
        templateId: "template-2",
        templateVersion: 1,
        templateVersionId: "template-version-2",
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
      id: "template-version-2",
      version: 1,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Prescription",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-2",
        organisationId: "org-1",
        templateKind: "PRESCRIPTION",
        templateVersion: 1,
      },
    });

    expect(mockedPrisma.prescription.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "artifact-2" } }),
    );
    expect(mockedPrisma.prescription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { artifactId: "artifact-2" },
      }),
    );
    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalled();
  });

  it("uses the latest template version when the artifact version is missing", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.prescription.findUnique.mockResolvedValueOnce(null);
    mockedPrisma.prescription.findFirst.mockResolvedValueOnce({
      id: "rx-1",
      items: [],
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
        templateId: "template-2",
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "user-1",
        signedAt: new Date("2026-06-14T00:00:00.000Z"),
        summary: "Prescription summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findFirst.mockResolvedValueOnce({
      id: "template-version-latest",
      version: 9,
      schemaSnapshot: { sections: [] },
      renderConfigSnapshot: {},
      validationSnapshot: {},
    });

    await renderRenderedDocumentPdf({
      title: "Prescription",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "artifact-2",
        organisationId: "org-1",
        templateKind: "PRESCRIPTION",
        templateVersion: 1,
      },
    });

    expect(mockedPrisma.templateVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "template-2" },
        orderBy: { version: "desc" },
      }),
    );
    expect(mockedGenerateResolvedTemplatePdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        template: expect.objectContaining({
          templateVersion: 9,
          templateVersionId: "template-version-latest",
        }),
      }),
    );
  });
});
