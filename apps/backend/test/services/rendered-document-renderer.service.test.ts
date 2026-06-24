import { TemplateKind } from "@prisma/client";
import type { RenderedDocumentSource } from "@yosemite-crew/types";
import { prisma } from "src/config/prisma";
import {
  buildPrescriptionLabelPdfInput,
  renderCombinedClinicalPacketPdf,
  renderPrescriptionLabelPdf,
  renderRenderedDocumentPdf,
} from "../../src/services/rendered-document-renderer.service";
import { renderPdf } from "../../src/services/formPDF.service";
import {
  generateClinicalPdf,
  generateClinicalPdfWithMetadata,
  generateCombinedClinicalPdfWithMetadata,
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
    admission: {
      findUnique: jest.fn(),
    },
    roomUnit: {
      findUnique: jest.fn(),
    },
    organisationRoom: {
      findUnique: jest.fn(),
    },
    roomUnitAssignment: {
      findFirst: jest.fn(),
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
    inventoryItem: {
      findMany: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  renderPdf: jest.fn(),
}));

jest.mock("@yosemite-crew/lib", () => ({
  generateClinicalPdf: jest.fn(),
  generateClinicalPdfWithMetadata: jest.fn(),
  generateCombinedClinicalPdfWithMetadata: jest.fn(),
  generateResolvedTemplatePdfWithMetadata: jest.fn(),
}));

describe("rendered-document-renderer service", () => {
  const mockedPrisma = prisma as unknown as {
    organization: { findUnique: jest.Mock };
    appointment: { findUnique: jest.Mock };
    admission: { findUnique: jest.Mock };
    roomUnit: { findUnique: jest.Mock };
    organisationRoom: { findUnique: jest.Mock };
    roomUnitAssignment: { findFirst: jest.Mock };
    formSubmission: { findUnique: jest.Mock };
    form: { findUnique: jest.Mock };
    formVersion: { findUnique: jest.Mock };
    templateInstance: { findUnique: jest.Mock };
    templateVersion: { findUnique: jest.Mock; findFirst: jest.Mock };
    soapNote: { findUnique: jest.Mock; findFirst: jest.Mock };
    prescription: { findUnique: jest.Mock; findFirst: jest.Mock };
    dischargeSummary: { findUnique: jest.Mock; findFirst: jest.Mock };
    vitalRecord: { findUnique: jest.Mock; findFirst: jest.Mock };
    inventoryItem: { findMany: jest.Mock };
    user: { findFirst: jest.Mock };
  };
  const mockedRenderPdf = renderPdf as jest.Mock;
  const mockedGenerateClinicalPdf = generateClinicalPdf as jest.Mock;
  const mockedGenerateClinicalPdfWithMetadata =
    generateClinicalPdfWithMetadata as jest.Mock;
  const mockedGenerateCombinedClinicalPdfWithMetadata =
    generateCombinedClinicalPdfWithMetadata as jest.Mock;
  const mockedGenerateResolvedTemplatePdfWithMetadata =
    generateResolvedTemplatePdfWithMetadata as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedRenderPdf.mockResolvedValue(Buffer.from("pdf"));
    mockedGenerateClinicalPdf.mockResolvedValue(Buffer.from("label-pdf"));
    mockedPrisma.appointment.findUnique.mockResolvedValue(null);
    mockedPrisma.admission.findUnique.mockResolvedValue(null);
    mockedPrisma.roomUnit.findUnique.mockResolvedValue(null);
    mockedPrisma.organisationRoom.findUnique.mockResolvedValue(null);
    mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValue(null);
    mockedPrisma.inventoryItem.findMany.mockResolvedValue([]);
    mockedPrisma.user.findFirst.mockResolvedValue(null);
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
    mockedGenerateCombinedClinicalPdfWithMetadata.mockResolvedValue({
      pdf: Buffer.from("combined-pdf"),
      pageCount: 2,
      signaturePlacement: {
        pageNumber: 2,
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

  it("renders a vital record document without template metadata through the fallback path", async () => {
    mockedPrisma.organization.findUnique.mockResolvedValueOnce({
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    });
    mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
      id: "vital-plain-1",
      measuredAt: new Date("2026-06-14T00:00:00.000Z"),
      recordedBy: null,
      vitals: [
        { label: "Heart rate", value: 88, unit: "bpm" },
        { label: "Temperature", value: 38.7, unit: "C" },
      ],
      notes: "Patient stable",
      metadata: { author: "vet-1", ward: "ICU" },
      artifact: {
        id: "artifact-plain-3",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "VITAL_RECORD",
        status: "DRAFT",
        templateId: "template-3",
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: null,
        signedAt: null,
        summary: "Vital summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });
    mockedPrisma.templateVersion.findFirst.mockResolvedValueOnce(null);

    await renderRenderedDocumentPdf({
      title: "Vital Record",
      source: {
        sourceKind: "CLINICAL_ARTIFACT",
        sourceId: "vital-plain-1",
        organisationId: "org-1",
        templateKind: "VITAL_RECORD",
      },
    });

    expect(mockedPrisma.templateVersion.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.templateVersion.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { templateId: "template-3" },
        orderBy: { version: "desc" },
      }),
    );
    expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "VITAL_RECORD",
        data: expect.objectContaining({
          title: "Vital Record",
          recordedBy: "author-1",
          measurements: [
            {
              label: "Heart rate",
              value: "88",
              unit: "bpm",
            },
            {
              label: "Temperature",
              value: "38.7",
              unit: "C",
            },
          ],
          notes: "Patient stable",
          metadata: { author: "vet-1", ward: "ICU" },
          signature: expect.objectContaining({
            status: "PENDING",
          }),
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

  describe("prescription label PDF", () => {
    const labelOrganization = {
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
    };

    const buildLabelPrescription = (
      overrides: {
        items?: unknown[];
        medications?: unknown;
      } = {},
    ) => ({
      id: "rx-1",
      items: overrides.items ?? [
        {
          medication: "Carprofen",
          strength: "25mg",
          dosage: "1 tablet",
          route: "PO",
          frequency: "BID",
          duration: "7 days",
          quantity: "14",
          instructions: "Give with food.",
          sortOrder: 0,
        },
      ],
      medications: overrides.medications ?? [
        { inventoryItemId: "inv-controlled" },
      ],
      instructions: null,
      notes: null,
      metadata: { clientName: "Yasmin Hadid" },
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

    it("maps prescription fields and marks controlled items", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
        patient: {
          name: "Bella Hadid",
          parent: { id: "CL-1001", name: "Yasmin Hadid" },
        },
        lead: { name: "Dr. Tim Apple" },
      });
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription(),
      );
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        { id: "inv-controlled", controlledItem: true },
      ]);

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1", id: { in: ["inv-controlled"] } },
        }),
      );
      expect(input.documentType).toBe("PRESCRIPTION_LABEL");
      expect(input.organization.name).toBe("MediCare Hospital");
      expect(input.data).toEqual(
        expect.objectContaining({
          patientName: "Bella Hadid",
          clientName: "Yasmin Hadid",
          prescriberName: "Dr. Tim Apple",
          organisationName: "MediCare Hospital",
          prescriptionId: "rx-1",
        }),
      );
      expect(input.data.items[0]).toEqual(
        expect.objectContaining({
          medication: "Carprofen",
          strength: "25mg",
          dosage: "1 tablet",
          route: "PO",
          frequency: "BID",
          duration: "7 days",
          quantity: "14",
          instructions: "Give with food.",
          controlled: true,
        }),
      );
    });

    it("treats items as not controlled when the inventory item is not controlled", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription(),
      );
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([
        { id: "inv-controlled", controlledItem: false },
      ]);

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(input.data.items[0].controlled).toBe(false);
    });

    it("treats items with no inventory link as not controlled", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription({ medications: [] }),
      );

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
      expect(input.data.items[0].controlled).toBe(false);
    });

    it("renders label PDF bytes via the clinical PDF engine", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        buildLabelPrescription({ medications: [] }),
      );

      const pdf = await renderPrescriptionLabelPdf({
        organisationId: "org-1",
        prescriptionId: "rx-1",
      });

      expect(mockedGenerateClinicalPdf).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: "PRESCRIPTION_LABEL" }),
      );
      expect(pdf).toEqual(Buffer.from("label-pdf"));
    });

    it("throws when the prescription label record is missing", async () => {
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(null);

      await expect(
        renderPrescriptionLabelPdf({
          organisationId: "org-1",
          prescriptionId: "rx-missing",
        }),
      ).rejects.toThrow("Prescription not found");
    });
  });

  describe("template-free clinical artifact signature", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const signedSoapNote = () => ({
      id: "soap-signed-1",
      subjective: { history: "cough" },
      objective: { temp: 38.5 },
      assessment: { impression: "kennel cough" },
      plan: { treatment: "rest" },
      diagnoses: [],
      metadata: { author: "vet-1" },
      artifact: {
        id: "artifact-signed-1",
        organisationId: "org-1",
        appointmentId: "appt-1",
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "signer-user-id",
        signedAt: new Date("2026-06-20T00:00:00.000Z"),
        summary: "SOAP summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
    });

    it("renders a SIGNED signature with resolved signer name/email and authMethod", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(signedSoapNote());
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Tim",
        lastName: "Apple",
        email: "tim.apple@example.com",
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-1",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "signer-user-id" },
        }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            signature: {
              status: "SIGNED",
              label: "Signature",
              signerName: "Tim Apple",
              signerEmail: "tim.apple@example.com",
              authMethod: "Email",
              signedAt: new Date("2026-06-20T00:00:00.000Z"),
            },
          }),
        }),
      );
    });

    it("still renders SIGNED with authMethod when the signer user cannot be resolved", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(signedSoapNote());
      mockedPrisma.user.findFirst.mockResolvedValueOnce(null);

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-1",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            signature: expect.objectContaining({
              status: "SIGNED",
              authMethod: "Email",
              signerName: undefined,
              signerEmail: undefined,
              signedAt: new Date("2026-06-20T00:00:00.000Z"),
            }),
          }),
        }),
      );
    });
  });

  describe("combined clinical packet header", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const unsignedArtifact = (overrides: Record<string, unknown>) => ({
      id: "artifact-x",
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
      summary: "summary",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      ...overrides,
    });

    it("merges appointment room/unit and client contact into the shared header even when SOAP is first", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // Appointment is read by each section builder AND once for the shared
      // header — keep the same record for every call.
      mockedPrisma.appointment.findUnique.mockResolvedValue({
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
        lead: { name: "Dr. Tim Apple" },
        room: {
          id: "room-1",
          name: "Exam Room 3",
          unit: { displayName: "Unit B" },
        },
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-combined-1",
        subjective: { history: "cough" },
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({ id: "art-soap", kind: "SOAP_NOTE" }),
      });
      mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
        id: "rx-combined-1",
        items: [],
        medications: [{ name: "Carprofen" }],
        instructions: [],
        notes: {},
        metadata: {},
        artifact: unsignedArtifact({ id: "art-rx", kind: "PRESCRIPTION" }),
      });

      const result = await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap",
            sourceId: "soap-combined-1",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
          {
            documentId: "doc-rx",
            sourceId: "rx-combined-1",
            kind: "PRESCRIPTION",
            title: "Prescription",
          },
        ],
      });

      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            patientName: "Bella Hadid",
            clientName: "Yasmin Hadid",
            clientId: "CL-1001",
            speciesBreed: "Canine / Bulldog",
            doctorName: "Dr. Tim Apple",
            clientContact: "(512) 555 0111",
            roomName: "Exam Room 3",
            unitName: "Unit B",
          }),
          signature: expect.objectContaining({ status: "PENDING" }),
        }),
      );
      expect(result.pdf).toEqual(Buffer.from("combined-pdf"));
    });

    it("leaves unitName undefined when the appointment room has no unit", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        patient: { name: "Milo", parent: { id: "CL-2", name: "Owner" } },
        lead: { name: "Dr. Vet" },
        room: { id: "room-2", name: "Ward A" },
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-combined-2",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({ id: "art-soap-2", kind: "SOAP_NOTE" }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-2",
            sourceId: "soap-combined-2",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            roomName: "Ward A",
            unitName: undefined,
          }),
        }),
      );
    });

    it("populates inpatient room/unit/admission details from admission, unit, room and assignment", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // First call (per-section header) returns the patient/lead; the shared
      // location lookup re-reads with the inpatient kind + encounter id.
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: "enc-inpatient",
        patient: {
          name: "Bella Hadid",
          parent: { id: "CL-1001", name: "Yasmin Hadid" },
        },
        lead: { name: "Dr. Tim Apple" },
        room: { id: "room-appt", name: "Reception" },
      });
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-inpatient",
        unitId: "unit-1",
        admittedAt: new Date("2026-06-20T09:30:00.000Z"),
        dischargedAt: null,
      });
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValueOnce({
        id: "assign-1",
        encounterId: "enc-inpatient",
        unitId: "unit-1",
        assignedAt: new Date("2026-06-20T09:30:00.000Z"),
        releasedAt: null,
        assignedBy: "admitting-user-id",
      });
      mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
        id: "unit-1",
        roomId: "room-ward",
        code: "U-1",
        displayName: "ICU Bed 4",
      });
      mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
        id: "room-ward",
        name: "Intensive Care Ward",
        code: "ICU",
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Nina",
        lastName: "Patel",
        email: "nina.patel@example.com",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-inpatient",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-inpatient",
          kind: "SOAP_NOTE",
          encounterId: "enc-inpatient",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-inpatient",
            sourceId: "soap-inpatient",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.admission.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounterId: "enc-inpatient" },
        }),
      );
      expect(mockedPrisma.roomUnitAssignment.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { encounterId: "enc-inpatient", releasedAt: null },
          orderBy: { assignedAt: "desc" },
        }),
      );
      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "admitting-user-id" },
        }),
      );
      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            roomName: "Intensive Care Ward",
            unitName: "ICU Bed 4",
            admittedAt: "2026-06-20 09:30",
            admittedBy: "Nina Patel",
          }),
        }),
      );
    });

    it("uses the appointment room and leaves admission details undefined for outpatient encounters", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "OUTPATIENT",
        encounterId: null,
        patient: { name: "Milo", parent: { id: "CL-2", name: "Owner" } },
        lead: { name: "Dr. Vet" },
        room: { id: "room-2", name: "Exam Room 7" },
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-outpatient",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-outpatient",
          kind: "SOAP_NOTE",
          encounterId: null,
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-outpatient",
            sourceId: "soap-outpatient",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.admission.findUnique).not.toHaveBeenCalled();
      expect(mockedPrisma.roomUnit.findUnique).not.toHaveBeenCalled();
      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          header: expect.objectContaining({
            roomName: "Exam Room 7",
            unitName: undefined,
            admittedAt: undefined,
            admittedBy: undefined,
          }),
        }),
      );
    });
  });

  describe("vital record recorder and timestamp", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    it("resolves the VitalRecord.recordedBy user and formats measuredAt", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-recorder-1",
        measuredAt: new Date("2026-06-21T14:05:00.000Z"),
        recordedBy: "tech-user-id",
        vitals: { heartRate: 92 },
        notes: null,
        metadata: { author: "vet-1" },
        artifact: {
          id: "artifact-vital-recorder",
          organisationId: "org-1",
          appointmentId: "appt-1",
          caseId: null,
          encounterId: null,
          kind: "VITAL_RECORD",
          status: "DRAFT",
          templateId: null,
          templateVersion: null,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "Vital summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Ravi",
        lastName: "Kumar",
        email: "ravi.kumar@example.com",
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "vital-recorder-1",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: "tech-user-id" },
        }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: "VITAL_RECORD",
          data: expect.objectContaining({
            recordedBy: "Ravi Kumar",
            recordedAt: "2026-06-21 14:05",
          }),
        }),
      );
    });

    it("falls back to the appointment header recorder and omits recordedAt when both are absent", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValueOnce({
        patient: { name: "Milo", parent: { id: "CL-2", name: "Owner" } },
        lead: { name: "Dr. Vet" },
        room: { name: "Exam 1" },
      });
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-no-recorder",
        measuredAt: null,
        recordedBy: null,
        vitals: { heartRate: 92 },
        notes: null,
        metadata: {},
        artifact: {
          id: "artifact-vital-no-recorder",
          organisationId: "org-1",
          appointmentId: "appt-1",
          caseId: null,
          encounterId: null,
          kind: "VITAL_RECORD",
          status: "DRAFT",
          templateId: null,
          templateVersion: null,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "Vital summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "vital-no-recorder",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: "VITAL_RECORD",
          data: expect.objectContaining({
            recordedBy: "Dr. Vet",
            recordedAt: undefined,
          }),
        }),
      );
    });
  });

  describe("clinical artifact loader edge cases", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const dischargeArtifact = (overrides: Record<string, unknown> = {}) => ({
      id: "artifact-discharge",
      organisationId: "org-1",
      appointmentId: "appt-1",
      caseId: null,
      encounterId: null,
      kind: "DISCHARGE_SUMMARY",
      status: "DRAFT",
      templateId: null,
      templateVersion: null,
      templateVersionId: null,
      authorId: "author-1",
      signedBy: null,
      signedAt: null,
      summary: "Discharge summary",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      ...overrides,
    });

    it("loads a discharge summary via findUnique and renders the template-free PDF", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
        id: "discharge-1",
        summary: "Discharged in stable condition",
        diagnoses: ["Gastritis"],
        medications: ["Carprofen"],
        followUp: "Recheck in 7 days",
        instructions: "Rest and fluids",
        metadata: { chiefComplaint: "Vomiting" },
        artifact: dischargeArtifact(),
      });

      await renderRenderedDocumentPdf({
        title: "Discharge Summary",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "discharge-1",
          organisationId: "org-1",
          templateKind: "DISCHARGE_SUMMARY",
        },
      });

      expect(mockedPrisma.dischargeSummary.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "discharge-1" } }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: "DISCHARGE_SUMMARY",
          data: expect.objectContaining({
            title: "Discharge Summary",
            chiefComplaint: "Vomiting",
          }),
        }),
      );
    });

    it("falls back to artifactId when loading a discharge summary", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce(null);
      mockedPrisma.dischargeSummary.findFirst.mockResolvedValueOnce({
        id: "discharge-2",
        summary: "Discharged",
        diagnoses: [],
        medications: [],
        followUp: "",
        instructions: "",
        metadata: {},
        artifact: dischargeArtifact({ id: "artifact-discharge-2" }),
      });

      await renderRenderedDocumentPdf({
        title: "Discharge Summary",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "artifact-discharge-2",
          organisationId: "org-1",
          templateKind: "DISCHARGE_SUMMARY",
        },
      });

      expect(mockedPrisma.dischargeSummary.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { artifactId: "artifact-discharge-2" },
        }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: "DISCHARGE_SUMMARY" }),
      );
    });

    it("rejects a discharge summary outside the organisation", async () => {
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
        id: "discharge-3",
        summary: "Discharged",
        diagnoses: [],
        medications: [],
        followUp: "",
        instructions: "",
        metadata: {},
        artifact: dischargeArtifact({
          id: "artifact-discharge-3",
          organisationId: "org-2",
        }),
      });

      await expect(
        renderRenderedDocumentPdf({
          title: "Discharge Summary",
          source: {
            sourceKind: "CLINICAL_ARTIFACT",
            sourceId: "discharge-3",
            organisationId: "org-1",
            templateKind: "DISCHARGE_SUMMARY",
          },
        }),
      ).rejects.toThrow("Discharge summary does not belong to organisation");
    });

    it("loads a vital record via the artifactId findFirst fallback", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce(null);
      mockedPrisma.vitalRecord.findFirst.mockResolvedValueOnce({
        id: "vital-fallback-1",
        measuredAt: new Date("2026-06-14T00:00:00.000Z"),
        recordedBy: null,
        vitals: { heartRate: 80 },
        notes: null,
        metadata: {},
        artifact: {
          id: "artifact-vital-fallback",
          organisationId: "org-1",
          appointmentId: "appt-1",
          caseId: null,
          encounterId: null,
          kind: "VITAL_RECORD",
          status: "DRAFT",
          templateId: null,
          templateVersion: null,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "Vital summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "artifact-vital-fallback",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      expect(mockedPrisma.vitalRecord.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { artifactId: "artifact-vital-fallback" },
        }),
      );
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: "VITAL_RECORD" }),
      );
    });

    it("rejects an unsupported clinical document kind", async () => {
      await expect(
        renderRenderedDocumentPdf({
          title: "Unsupported",
          source: {
            sourceKind: "CLINICAL_ARTIFACT",
            sourceId: "whatever-1",
            organisationId: "org-1",
            templateKind: "INPATIENT_SCHEDULE",
          },
        }),
      ).rejects.toThrow("Unsupported clinical document kind");
    });
  });

  describe("combined clinical packet sections and location edge cases", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const unsignedArtifact = (overrides: Record<string, unknown>) => ({
      id: "artifact-x",
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
      summary: "summary",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      ...overrides,
    });

    it("builds a section for every clinical kind and leads the header with a discharge summary", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // No appointment lookup match — exercises loadAppointmentLocationContext
      // and loadAppointmentClinicalHeader null-appointment branches.
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
        id: "discharge-combined",
        summary: "Discharged stable",
        diagnoses: [],
        medications: [],
        followUp: "",
        instructions: "",
        metadata: { contact: "(555) 222 0000", doctorName: "Dr. House" },
        artifact: unsignedArtifact({
          id: "art-discharge",
          kind: "DISCHARGE_SUMMARY",
        }),
      });
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-combined",
        measuredAt: new Date("2026-06-14T00:00:00.000Z"),
        recordedBy: null,
        vitals: { heartRate: 80 },
        notes: null,
        metadata: { contact: "(555) 222 0001" },
        artifact: unsignedArtifact({ id: "art-vital", kind: "VITAL_RECORD" }),
      });
      mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
        id: "rx-combined",
        items: [],
        medications: [{ name: "Carprofen" }],
        instructions: [],
        notes: {},
        metadata: {},
        artifact: unsignedArtifact({ id: "art-rx", kind: "PRESCRIPTION" }),
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-combined",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({ id: "art-soap", kind: "SOAP_NOTE" }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-discharge",
            sourceId: "discharge-combined",
            kind: "DISCHARGE_SUMMARY",
            title: "Discharge Summary",
          },
          {
            documentId: "doc-vital",
            sourceId: "vital-combined",
            kind: "VITAL_RECORD",
            title: "Vital Record",
          },
          {
            documentId: "doc-rx",
            sourceId: "rx-combined",
            kind: "PRESCRIPTION",
            title: "Prescription",
          },
          {
            documentId: "doc-soap",
            sourceId: "soap-combined",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.sections).toHaveLength(4);
      expect(
        call.sections.map((s: { documentType: string }) => s.documentType),
      ).toEqual([
        "DISCHARGE_SUMMARY",
        "VITAL_RECORD",
        "PRESCRIPTION",
        "SOAP_NOTE",
      ]);
      // Discharge summary leads, so its doctorName/contact seed the header.
      expect(call.header.doctorName).toBe("Dr. House");
      expect(call.header.clientContact).toBe("(555) 222 0000");
    });

    it("leads the header with a prescription section (leadName + clientContact)", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);
      mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
        id: "rx-lead",
        items: [],
        medications: [{ name: "Carprofen" }],
        instructions: [],
        notes: {},
        metadata: {
          leadName: "Dr. Strange",
          clientContact: "(555) 111 2222",
        },
        artifact: unsignedArtifact({ id: "art-rx-lead", kind: "PRESCRIPTION" }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-rx-lead",
            sourceId: "rx-lead",
            kind: "PRESCRIPTION",
            title: "Prescription",
          },
        ],
      });

      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.header.doctorName).toBe("Dr. Strange");
      expect(call.header.clientContact).toBe("(555) 111 2222");
    });

    it("leads the header with a vital record section (recordedBy + contact)", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-lead",
        measuredAt: new Date("2026-06-14T00:00:00.000Z"),
        recordedBy: null,
        vitals: { heartRate: 80 },
        notes: null,
        metadata: {
          recordedBy: "Nurse Joy",
          contact: "(555) 333 4444",
        },
        artifact: unsignedArtifact({
          id: "art-vital-lead",
          kind: "VITAL_RECORD",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-vital-lead",
            sourceId: "vital-lead",
            kind: "VITAL_RECORD",
            title: "Vital Record",
          },
        ],
      });

      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.header.doctorName).toBe("Nurse Joy");
      expect(call.header.clientContact).toBe("(555) 333 4444");
    });

    it("skips non-combinable kinds and throws when no combinable sections remain", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );

      await expect(
        renderCombinedClinicalPacketPdf({
          organisationId: "org-1",
          documents: [
            {
              documentId: "doc-form",
              sourceId: "form-1",
              kind: "FORM",
              title: "Intake Form",
            },
          ],
        }),
      ).rejects.toThrow(
        "Combined clinical packet has no combinable clinical sections",
      );
      expect(
        mockedGenerateCombinedClinicalPdfWithMetadata,
      ).not.toHaveBeenCalled();
    });

    it("falls back to the appointment room when the unit row cannot be found", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: "enc-no-unit-row",
        patient: { name: "Bella", parent: { id: "CL-1", name: "Owner" } },
        lead: { name: "Dr. Tim" },
        room: { name: "Appointment Room" },
      });
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-no-unit-row",
        unitId: "unit-missing",
        admittedAt: new Date("2026-06-20T08:00:00.000Z"),
        admittedBy: null,
        dischargedAt: null,
      });
      // roomUnit.findUnique returns null (default) → roomName falls back to
      // the appointment room and unitName stays undefined.
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-no-unit-row",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-no-unit-row",
          kind: "SOAP_NOTE",
          encounterId: "enc-no-unit-row",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-no-unit-row",
            sourceId: "soap-no-unit-row",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.roomUnit.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "unit-missing" } }),
      );
      expect(mockedPrisma.organisationRoom.findUnique).not.toHaveBeenCalled();
      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.header.roomName).toBe("Appointment Room");
      expect(call.header.unitName).toBeUndefined();
      expect(call.header.admittedAt).toBe("2026-06-20 08:00");
      expect(call.header.admittedBy).toBeUndefined();
    });

    it("falls back to the appointment room when the unit's room row is missing", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: "enc-no-room",
        patient: { name: "Bella", parent: { id: "CL-1", name: "Owner" } },
        lead: { name: "Dr. Tim" },
        room: { name: "Appointment Room" },
      });
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-no-room",
        unitId: "unit-1",
        admittedAt: new Date("2026-06-20T08:00:00.000Z"),
        admittedBy: null,
        dischargedAt: null,
      });
      mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
        id: "unit-1",
        roomId: "room-missing",
        code: "U-9",
        displayName: "Ward Bed 9",
      });
      // organisationRoom.findUnique returns null (default) → roomName falls
      // back to the appointment room; unitName still resolves.
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-no-room",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-no-room",
          kind: "SOAP_NOTE",
          encounterId: "enc-no-room",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-no-room",
            sourceId: "soap-no-room",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.organisationRoom.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "room-missing" } }),
      );
      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.header.roomName).toBe("Appointment Room");
      expect(call.header.unitName).toBe("Ward Bed 9");
    });

    it("resolves the unit from the assignment and the admitter from assignment.assignedBy", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: "enc-assignment",
        patient: { name: "Bella", parent: { id: "CL-1", name: "Owner" } },
        lead: { name: "Dr. Tim" },
        room: { name: "Appointment Room" },
      });
      // Admission exists but carries no unitId and no admittedBy — both must be
      // sourced from the assignment instead.
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-assignment",
        unitId: null,
        admittedAt: new Date("2026-06-20T08:00:00.000Z"),
        admittedBy: null,
        dischargedAt: null,
      });
      mockedPrisma.roomUnitAssignment.findFirst.mockResolvedValueOnce({
        id: "assign-2",
        encounterId: "enc-assignment",
        unitId: "unit-2",
        assignedAt: new Date("2026-06-20T08:00:00.000Z"),
        releasedAt: null,
        assignedBy: "assigner-user-id",
      });
      mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
        id: "unit-2",
        roomId: "room-2",
        code: "U-2",
        displayName: "ICU Bed 2",
      });
      mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
        id: "room-2",
        name: "Critical Care",
        code: "CC",
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Sam",
        lastName: "Wells",
        email: "sam.wells@example.com",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-assignment",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-assignment",
          kind: "SOAP_NOTE",
          encounterId: "enc-assignment",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-assignment",
            sourceId: "soap-assignment",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.roomUnit.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "unit-2" } }),
      );
      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "assigner-user-id" } }),
      );
      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.header.roomName).toBe("Critical Care");
      expect(call.header.unitName).toBe("ICU Bed 2");
      expect(call.header.admittedBy).toBe("Sam Wells");
    });

    it("treats an encounter with an admission as inpatient even when no unit can be resolved", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "OUTPATIENT",
        encounterId: "enc-admission-only",
        patient: { name: "Bella", parent: { id: "CL-1", name: "Owner" } },
        lead: { name: "Dr. Tim" },
        room: { name: "Appointment Room" },
      });
      // Admission present (so inpatient) but no unitId; assignment absent too.
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-admission-only",
        unitId: null,
        admittedAt: new Date("2026-06-20T08:00:00.000Z"),
        admittedBy: "admitter-user-id",
        dischargedAt: null,
      });
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Ada",
        lastName: "Byron",
        email: "ada@example.com",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-admission-only",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-admission-only",
          kind: "SOAP_NOTE",
          encounterId: "enc-admission-only",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-admission-only",
            sourceId: "soap-admission-only",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.roomUnit.findUnique).not.toHaveBeenCalled();
      expect(mockedPrisma.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: "admitter-user-id" } }),
      );
      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      // No unit → resolveUnitRoomNames returns just the fallback room name.
      expect(call.header.roomName).toBe("Appointment Room");
      expect(call.header.unitName).toBeUndefined();
      expect(call.header.admittedBy).toBe("Ada Byron");
    });

    it("resolves location from the encounterId on the artifact when the appointment is absent", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // No appointmentId on the artifact, but the encounterId drives the
      // admission/assignment lookups directly (loadAppointmentLocationContext
      // short-circuits on the missing appointment).
      mockedPrisma.appointment.findUnique.mockResolvedValue(null);
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-direct",
        unitId: "unit-3",
        admittedAt: new Date("2026-06-20T08:00:00.000Z"),
        admittedBy: null,
        dischargedAt: null,
      });
      mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
        id: "unit-3",
        roomId: "room-3",
        code: "U-3",
        displayName: "Recovery Bed 3",
      });
      mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
        id: "room-3",
        name: "Recovery Ward",
        code: "RW",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-direct",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-direct",
          kind: "SOAP_NOTE",
          appointmentId: null,
          encounterId: "enc-direct",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-direct",
            sourceId: "soap-direct",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      expect(mockedPrisma.admission.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { encounterId: "enc-direct" } }),
      );
      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.header.roomName).toBe("Recovery Ward");
      expect(call.header.unitName).toBe("Recovery Bed 3");
    });
  });

  describe("template-free builder fallback branches", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    // An artifact with no appointmentId (so loadAppointmentClinicalHeader
    // returns {} and every header.* field is undefined), no template, and
    // no signedAt (PENDING). Each field's `data.X ?? metadata.X ?? default`
    // chain therefore depends purely on `data`/`metadata`.
    const templateFreeArtifact = (overrides: Record<string, unknown> = {}) => ({
      id: "artifact-fallback",
      organisationId: "org-1",
      appointmentId: null,
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
      summary: "summary",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      ...overrides,
    });

    it("SOAP note falls back to metadata for narrative + author for doctorName", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-meta",
        subjective: null,
        objective: null,
        assessment: null,
        plan: null,
        diagnoses: [],
        metadata: {
          subjective: "meta subjective",
          objective: "meta objective",
          assessment: "meta assessment",
          plan: "meta plan",
        },
        artifact: templateFreeArtifact({ id: "art-soap-meta" }),
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-meta",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          documentType: "SOAP_NOTE",
          data: expect.objectContaining({
            subjective: "meta subjective",
            objective: "meta objective",
            assessment: "meta assessment",
            plan: "meta plan",
            // header.leadName + metadata[doctorName] absent → authorId.
            doctorName: "author-1",
            // header + metadata patient fields absent → "—" defaults.
            patientName: "—",
            speciesBreed: "—",
            ageSex: "—",
            clientName: "—",
            clientId: "—",
            // metadata has no appointmentId and artifact.appointmentId is null.
            appointmentId: "—",
            printedBy: "author-1",
          }),
        }),
      );
    });

    it("SOAP note falls back to empty strings and '—' when data, metadata and author are all absent", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-empty",
        subjective: null,
        objective: null,
        assessment: null,
        plan: null,
        diagnoses: [],
        metadata: {},
        artifact: templateFreeArtifact({
          id: "art-soap-empty",
          authorId: null,
        }),
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-empty",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            subjective: "",
            objective: "",
            assessment: "",
            plan: "",
            doctorName: "—",
            printedBy: undefined,
          }),
        }),
      );
    });

    it("prescription falls back to data.medications, metadata contact and author lead", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
        id: "rx-meta",
        // items is null/empty → normalizePrescriptionItems falls through to
        // data.medications.
        items: null,
        medications: [{ name: "Amoxicillin" }],
        instructions: [],
        notes: null,
        metadata: { contact: "(555) 000 1111" },
        artifact: templateFreeArtifact({
          id: "art-rx-meta",
          kind: "PRESCRIPTION",
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Prescription",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "rx-meta",
          organisationId: "org-1",
          templateKind: "PRESCRIPTION",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.documentType).toBe("PRESCRIPTION");
      expect(call.data.items).toEqual([
        expect.objectContaining({ medication: "Amoxicillin" }),
      ]);
      // header.clientContact absent + metadata.contact present.
      expect(call.data.clientContact).toBe("(555) 000 1111");
      // metadata.notes / data.notes absent → readRecordNotes returns "".
      expect(call.data.notes).toBe("");
      // leadName: header + metadata[lead keys] absent → authorId.
      expect(call.data.leadName).toBe("author-1");
    });

    it("prescription falls back to '—' contact when neither header nor metadata supply it", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.prescription.findUnique.mockResolvedValueOnce({
        id: "rx-empty",
        items: [],
        medications: null,
        instructions: [],
        notes: null,
        metadata: {},
        artifact: templateFreeArtifact({
          id: "art-rx-empty",
          kind: "PRESCRIPTION",
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Prescription",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "rx-empty",
          organisationId: "org-1",
          templateKind: "PRESCRIPTION",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data.clientContact).toBe("—");
      // Neither items nor medications → empty list.
      expect(call.data.items).toEqual([]);
    });

    it("discharge summary falls back to metadata for every narrative field", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
        id: "discharge-meta",
        summary: null,
        diagnoses: null,
        medications: null,
        followUp: null,
        instructions: null,
        metadata: {
          summary: "meta summary",
          instructions: "meta instructions",
          followUp: "meta follow up",
          chiefComplaint: "meta chief complaint",
          treatmentSummary: "meta treatment",
          procedures: ["Surgery"],
          diagnostics: ["X-ray"],
          dischargeSummary: "meta discharge",
          homeCare: ["Rest"],
          emergencyCare: ["Call vet"],
          emergencyContact: "(555) 999 0000",
          contact: "(555) 999 1111",
        },
        artifact: templateFreeArtifact({
          id: "art-discharge-meta",
          kind: "DISCHARGE_SUMMARY",
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Discharge Summary",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "discharge-meta",
          organisationId: "org-1",
          templateKind: "DISCHARGE_SUMMARY",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.documentType).toBe("DISCHARGE_SUMMARY");
      expect(call.data).toEqual(
        expect.objectContaining({
          chiefComplaint: "meta chief complaint",
          treatmentSummary: "meta treatment",
          procedures: ["Surgery"],
          diagnostics: ["X-ray"],
          dischargeSummary: "meta discharge",
          homeCare: ["Rest"],
          emergencyCare: ["Call vet"],
          emergencyContact: "(555) 999 0000",
          // header.clientContact absent → metadata contact.
          contact: "(555) 999 1111",
          doctorName: "author-1",
        }),
      );
    });

    it("discharge summary falls back through summaryText and '—' contact when metadata is empty", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
        id: "discharge-data",
        // data.summary feeds chiefComplaint/treatmentSummary/dischargeSummary
        // via the summaryText fallback; instructions feed homeCare.
        summary: "data summary",
        diagnoses: ["Gastritis"],
        medications: ["Carprofen"],
        followUp: "data follow up",
        instructions: "data instructions",
        metadata: {},
        artifact: templateFreeArtifact({
          id: "art-discharge-data",
          kind: "DISCHARGE_SUMMARY",
          authorId: null,
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Discharge Summary",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "discharge-data",
          organisationId: "org-1",
          templateKind: "DISCHARGE_SUMMARY",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data).toEqual(
        expect.objectContaining({
          // metadata.chiefComplaint absent → data.summary.
          chiefComplaint: "data summary",
          // metadata.treatmentSummary absent → summaryText (data.summary).
          treatmentSummary: "data summary",
          // metadata.dischargeSummary absent → summaryText.
          dischargeSummary: "data summary",
          // metadata.procedures absent → data.medications.
          procedures: ["Carprofen"],
          // data.diagnoses present → diagnostics.
          diagnostics: ["Gastritis"],
          // metadata.homeCare absent → instructionsText.
          homeCare: ["data instructions"],
          // metadata emergency fields absent → [].
          emergencyCare: [],
          // emergencyContact + contact metadata absent → "—".
          emergencyContact: "—",
          contact: "—",
          // author null → "—".
          doctorName: "—",
        }),
      );
    });

    it("discharge summary derives homeCare from the instructions text", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.dischargeSummary.findUnique.mockResolvedValueOnce({
        id: "discharge-homecare",
        summary: null,
        diagnoses: [],
        medications: [],
        followUp: "Recheck in 7 days",
        instructions: "Keep the wound dry\nLimit activity",
        metadata: {},
        artifact: templateFreeArtifact({
          id: "art-discharge-homecare",
          kind: "DISCHARGE_SUMMARY",
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Discharge Summary",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "discharge-homecare",
          organisationId: "org-1",
          templateKind: "DISCHARGE_SUMMARY",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      // metadata.homeCare absent → instructionsText (multi-line → list).
      // followUpText is an unreachable fallback because instructionsText is
      // always a string (`?? ""`), so `?? followUpText` never triggers.
      expect(call.data.homeCare).toEqual([
        "Keep the wound dry",
        "Limit activity",
      ]);
    });

    it("vital record falls back to metadata vitals, metadata recorder and contact", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-meta",
        measuredAt: null,
        // recordedBy not a resolvable user id → readString returns it, but
        // resolveSigner(user.findFirst=null) yields no name → falls through.
        recordedBy: null,
        // data.vitals absent → metadata.vitals.
        vitals: null,
        notes: null,
        metadata: {
          vitals: [{ label: "Heart rate", value: 88, unit: "bpm" }],
          recordedBy: "Nurse Meta",
          contact: "(555) 222 3333",
        },
        artifact: templateFreeArtifact({
          id: "art-vital-meta",
          kind: "VITAL_RECORD",
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "vital-meta",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.documentType).toBe("VITAL_RECORD");
      expect(call.data.measurements).toEqual([
        expect.objectContaining({ label: "Heart rate", value: "88" }),
      ]);
      // recordedByName + header.leadName absent → metadata.recordedBy.
      expect(call.data.recordedBy).toBe("Nurse Meta");
      // measuredAt null → recordedAt undefined.
      expect(call.data.recordedAt).toBeUndefined();
      // header.clientContact absent → metadata.contact.
      expect(call.data.contact).toBe("(555) 222 3333");
      // data.metadata is defined → metadata object passed through.
      expect(call.data.metadata).toEqual(
        expect.objectContaining({ recordedBy: "Nurse Meta" }),
      );
    });

    it("vital record falls back to metadata.vitalRows and '—' contact, defaulting recordedBy to author", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-rows",
        measuredAt: null,
        recordedBy: null,
        vitals: null,
        notes: null,
        // metadata.vitals absent → falls through to metadata.vitalRows.
        metadata: { vitalRows: [{ label: "Temp", value: 38.6, unit: "C" }] },
        artifact: templateFreeArtifact({
          id: "art-vital-rows",
          kind: "VITAL_RECORD",
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "vital-rows",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data.measurements).toEqual([
        expect.objectContaining({ label: "Temp", value: "38.6" }),
      ]);
      // recordedByName + header.leadName + metadata recorder keys absent →
      // artifact.authorId.
      expect(call.data.recordedBy).toBe("author-1");
      expect(call.data.contact).toBe("—");
    });

    it("vital record defaults recordedBy to '—' when even the author id is absent", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.vitalRecord.findUnique.mockResolvedValueOnce({
        id: "vital-noauthor",
        measuredAt: null,
        recordedBy: null,
        vitals: { heartRate: 70 },
        notes: null,
        metadata: {},
        artifact: templateFreeArtifact({
          id: "art-vital-noauthor",
          kind: "VITAL_RECORD",
          authorId: null,
        }),
      });

      await renderRenderedDocumentPdf({
        title: "Vital Record",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "vital-noauthor",
          organisationId: "org-1",
          templateKind: "VITAL_RECORD",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data.recordedBy).toBe("—");
    });
  });

  describe("signer resolution fallback branches", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const signedArtifact = (overrides: Record<string, unknown> = {}) => ({
      id: "soap-signed-fallback",
      subjective: { history: "cough" },
      objective: {},
      assessment: {},
      plan: {},
      diagnoses: [],
      metadata: {},
      artifact: {
        id: "art-signed-fallback",
        organisationId: "org-1",
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "SOAP_NOTE",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-1",
        signedBy: "signer-id",
        signedAt: new Date("2026-06-20T00:00:00.000Z"),
        summary: "summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        ...overrides,
      },
    });

    it("resolves a signer with only an email (no name) so the name '|| undefined' branch runs", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(signedArtifact());
      // Blank/whitespace names collapse to undefined; email trims to a value.
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "   ",
        lastName: null,
        email: "  signer@example.com  ",
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-fallback",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data.signature).toEqual(
        expect.objectContaining({
          status: "SIGNED",
          signerName: undefined,
          signerEmail: "signer@example.com",
          authMethod: "Email",
        }),
      );
    });

    it("resolves a signer name but no email so the email '|| undefined' branch runs", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(signedArtifact());
      mockedPrisma.user.findFirst.mockResolvedValueOnce({
        firstName: "Tim",
        lastName: "Apple",
        email: "   ",
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-fallback",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data.signature).toEqual(
        expect.objectContaining({
          status: "SIGNED",
          signerName: "Tim Apple",
          signerEmail: undefined,
        }),
      );
    });

    it("returns an empty signer when the artifact is signed without a signedBy id", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce(
        signedArtifact({ signedBy: null }),
      );

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-signed-fallback",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
        },
      });

      // resolveSigner short-circuits on the null id → user.findFirst skipped.
      expect(mockedPrisma.user.findFirst).not.toHaveBeenCalled();
      const call = mockedGenerateClinicalPdfWithMetadata.mock.calls[0][0];
      expect(call.data.signature).toEqual(
        expect.objectContaining({
          status: "SIGNED",
          signerName: undefined,
          signerEmail: undefined,
          authMethod: "Email",
        }),
      );
    });
  });

  describe("prescription label fallback branches", () => {
    const labelOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const labelPrescription = (overrides: Record<string, unknown> = {}) => ({
      id: "rx-label-fallback",
      items: [
        {
          medication: "Carprofen",
          strength: null,
          dosage: null,
          route: null,
          frequency: null,
          duration: null,
          quantity: null,
          instructions: null,
          sortOrder: 0,
        },
      ],
      medications: [{ name: "Carprofen" }, { inventoryItemId: "inv-1" }],
      instructions: null,
      notes: null,
      metadata: {},
      artifact: {
        id: "art-label-fallback",
        organisationId: "org-1",
        appointmentId: null,
        caseId: null,
        encounterId: null,
        kind: "PRESCRIPTION",
        status: "SIGNED",
        templateId: null,
        templateVersion: null,
        templateVersionId: null,
        authorId: "author-label",
        signedBy: null,
        signedAt: null,
        summary: "summary",
        createdAt: new Date("2026-06-14T00:00:00.000Z"),
        updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      },
      ...overrides,
    });

    it("maps item fields to undefined and marks them not controlled when no inventory link resolves", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        labelPrescription(),
      );
      // inv-1 is queried but returns no controlled flag → defaults to false.
      mockedPrisma.inventoryItem.findMany.mockResolvedValueOnce([]);

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-label-fallback",
      });

      // collectMedicationInventoryIds: first line has no inventoryItemId ("")
      // and second resolves to "inv-1".
      expect(mockedPrisma.inventoryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organisationId: "org-1", id: { in: ["inv-1"] } },
        }),
      );
      expect(input.data.items[0]).toEqual(
        expect.objectContaining({
          medication: "Carprofen",
          strength: undefined,
          dosage: undefined,
          route: undefined,
          frequency: undefined,
          duration: undefined,
          quantity: undefined,
          instructions: undefined,
          controlled: false,
        }),
      );
      // header (no appointment) + metadata empty → "—" / author fallbacks.
      expect(input.data.patientName).toBe("—");
      expect(input.data.clientName).toBe("—");
      expect(input.data.prescriberName).toBe("author-label");
    });

    it("falls back to metadata for patient/client and defaults prescriber to '—' when author is absent", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        labelOrganization,
      );
      mockedPrisma.prescription.findFirst.mockResolvedValueOnce(
        labelPrescription({
          medications: "not-an-array",
          metadata: { patientName: "Milo", clientName: "Owner Meta" },
          artifact: {
            id: "art-label-no-author",
            organisationId: "org-1",
            appointmentId: null,
            caseId: null,
            encounterId: null,
            kind: "PRESCRIPTION",
            status: "SIGNED",
            templateId: null,
            templateVersion: null,
            templateVersionId: null,
            authorId: null,
            signedBy: null,
            signedAt: null,
            summary: "summary",
            createdAt: new Date("2026-06-14T00:00:00.000Z"),
            updatedAt: new Date("2026-06-14T00:00:00.000Z"),
          },
        }),
      );

      const input = await buildPrescriptionLabelPdfInput({
        organisationId: "org-1",
        prescriptionId: "rx-label-fallback",
      });

      // medications is not an array → collectMedicationInventoryIds returns []
      // → inventory lookup skipped.
      expect(mockedPrisma.inventoryItem.findMany).not.toHaveBeenCalled();
      expect(input.data.patientName).toBe("Milo");
      expect(input.data.clientName).toBe("Owner Meta");
      expect(input.data.prescriberName).toBe("—");
    });
  });

  describe("combined header and location fallback branches", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    const unsignedArtifact = (overrides: Record<string, unknown>) => ({
      id: "artifact-x",
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
      summary: "summary",
      createdAt: new Date("2026-06-14T00:00:00.000Z"),
      updatedAt: new Date("2026-06-14T00:00:00.000Z"),
      ...overrides,
    });

    it("resolves the unit name from the unit code when the unit has no displayName", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "INPATIENT",
        encounterId: "enc-code-unit",
        patient: { name: "Bella", parent: { id: "CL-1", name: "Owner" } },
        lead: { name: "Dr. Tim" },
        room: { name: "Appointment Room" },
      });
      mockedPrisma.admission.findUnique.mockResolvedValueOnce({
        encounterId: "enc-code-unit",
        unitId: "unit-code",
        admittedAt: new Date("2026-06-20T08:00:00.000Z"),
        admittedBy: null,
        dischargedAt: null,
      });
      mockedPrisma.roomUnit.findUnique.mockResolvedValueOnce({
        id: "unit-code",
        roomId: "room-code",
        code: "U-CODE",
        displayName: null,
      });
      mockedPrisma.organisationRoom.findUnique.mockResolvedValueOnce({
        id: "room-code",
        name: "Coded Ward",
        code: "CW",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-code-unit",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-code-unit",
          kind: "SOAP_NOTE",
          encounterId: "enc-code-unit",
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-code-unit",
            sourceId: "soap-code-unit",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      // displayName null → unitName falls back to unit.code.
      expect(call.header.unitName).toBe("U-CODE");
      expect(call.header.roomName).toBe("Coded Ward");
    });

    it("ignores a non-record appointment room when resolving the location context", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      // room is a string (non-record) → loadAppointmentLocationContext uses {}.
      mockedPrisma.appointment.findUnique.mockResolvedValue({
        appointmentKind: "OUTPATIENT",
        encounterId: null,
        patient: { name: "Bella", parent: { id: "CL-1", name: "Owner" } },
        lead: { name: "Dr. Tim" },
        room: "not-a-record",
      });
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-bad-room",
        subjective: {},
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: unsignedArtifact({
          id: "art-soap-bad-room",
          kind: "SOAP_NOTE",
          encounterId: null,
        }),
      });

      await renderCombinedClinicalPacketPdf({
        organisationId: "org-1",
        documents: [
          {
            documentId: "doc-soap-bad-room",
            sourceId: "soap-bad-room",
            kind: "SOAP_NOTE",
            title: "SOAP Note",
          },
        ],
      });

      const call =
        mockedGenerateCombinedClinicalPdfWithMetadata.mock.calls[0][0];
      // Outpatient with non-record room → no roomName from location context;
      // the per-section/appointment header still supplies the room (string
      // room JSON yields no name), so it stays undefined.
      expect(call.header.roomName).toBeUndefined();
      expect(call.header.unitName).toBeUndefined();
    });
  });

  describe("clinical artifact resolved-template fallback branches", () => {
    const baseOrganization = {
      name: "MediCare Hospital",
      imageUrl: null,
      phoneNo: "+91 99999 00000",
      website: "https://medicare.example",
      address: null,
    };

    it("falls back to the template-free path when the template version cannot be found", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-missing-version",
        subjective: { history: "cough" },
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: {
          id: "art-soap-missing-version",
          organisationId: "org-1",
          appointmentId: null,
          caseId: null,
          encounterId: null,
          kind: "SOAP_NOTE",
          status: "DRAFT",
          templateId: "template-x",
          templateVersion: 4,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });
      // Specific version lookup misses → "Template version not found" is
      // swallowed and the builder returns undefined (template-free path).
      mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce(null);

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-missing-version",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
          templateVersion: 4,
        },
      });

      expect(
        mockedGenerateResolvedTemplatePdfWithMetadata,
      ).not.toHaveBeenCalled();
      expect(mockedGenerateClinicalPdfWithMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ documentType: "SOAP_NOTE" }),
      );
    });

    it("re-throws non-'Template version not found' errors from the template version lookup", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-db-down",
        subjective: { history: "cough" },
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: {
          id: "art-soap-db-down",
          organisationId: "org-1",
          appointmentId: null,
          caseId: null,
          encounterId: null,
          kind: "SOAP_NOTE",
          status: "DRAFT",
          templateId: "template-db-down",
          templateVersion: 4,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });
      // The version lookup rejects with an unrelated error → not swallowed by
      // the "Template version not found" guard, so it propagates out.
      mockedPrisma.templateVersion.findUnique.mockRejectedValueOnce(
        new Error("db down"),
      );

      await expect(
        renderRenderedDocumentPdf({
          title: "SOAP Note",
          source: {
            sourceKind: "CLINICAL_ARTIFACT",
            sourceId: "soap-db-down",
            organisationId: "org-1",
            templateKind: "SOAP_NOTE",
            templateVersion: 4,
          },
        }),
      ).rejects.toThrow("db down");

      expect(
        mockedGenerateResolvedTemplatePdfWithMetadata,
      ).not.toHaveBeenCalled();
      expect(mockedGenerateClinicalPdfWithMetadata).not.toHaveBeenCalled();
    });

    it("re-throws non-'Template version not found' errors from the latest-version lookup", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-latest-down",
        subjective: { history: "cough" },
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: {
          id: "art-soap-latest-down",
          organisationId: "org-1",
          appointmentId: null,
          caseId: null,
          encounterId: null,
          kind: "SOAP_NOTE",
          status: "DRAFT",
          templateId: "template-latest-down",
          // templateVersion null → loadLatestTemplateVersionOrThrow path.
          templateVersion: null,
          templateVersionId: null,
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });
      mockedPrisma.templateVersion.findFirst.mockRejectedValueOnce(
        new Error("db down"),
      );

      await expect(
        renderRenderedDocumentPdf({
          title: "SOAP Note",
          source: {
            sourceKind: "CLINICAL_ARTIFACT",
            sourceId: "soap-latest-down",
            organisationId: "org-1",
            templateKind: "SOAP_NOTE",
          },
        }),
      ).rejects.toThrow("db down");
    });

    it("rejects unsupported rendered document source kinds", async () => {
      await expect(
        renderRenderedDocumentPdf({
          title: "Unsupported",
          source: {
            sourceKind: "UNKNOWN_KIND",
            sourceId: "whatever",
            organisationId: "org-1",
            templateKind: "SOAP_NOTE",
          } as unknown as RenderedDocumentSource,
        }),
      ).rejects.toThrow("Unsupported rendered document source kind");
    });

    it("defaults missing snapshot sections/config to empty/null in the resolved template", async () => {
      mockedPrisma.organization.findUnique.mockResolvedValueOnce(
        baseOrganization,
      );
      mockedPrisma.soapNote.findUnique.mockResolvedValueOnce({
        id: "soap-empty-snapshot",
        subjective: { history: "cough" },
        objective: {},
        assessment: {},
        plan: {},
        diagnoses: [],
        metadata: {},
        artifact: {
          id: "art-soap-empty-snapshot",
          organisationId: "org-1",
          appointmentId: null,
          caseId: null,
          encounterId: null,
          kind: "SOAP_NOTE",
          status: "DRAFT",
          templateId: "template-y",
          templateVersion: 2,
          templateVersionId: "template-version-y",
          authorId: "author-1",
          signedBy: null,
          signedAt: null,
          summary: "summary",
          createdAt: new Date("2026-06-14T00:00:00.000Z"),
          updatedAt: new Date("2026-06-14T00:00:00.000Z"),
        },
      });
      // schemaSnapshot has no sections; render/validation snapshots are null.
      mockedPrisma.templateVersion.findUnique.mockResolvedValueOnce({
        id: "template-version-y",
        version: 2,
        schemaSnapshot: {},
        renderConfigSnapshot: null,
        validationSnapshot: null,
      });

      await renderRenderedDocumentPdf({
        title: "SOAP Note",
        source: {
          sourceKind: "CLINICAL_ARTIFACT",
          sourceId: "soap-empty-snapshot",
          organisationId: "org-1",
          templateKind: "SOAP_NOTE",
          templateVersion: 2,
        },
      });

      expect(
        mockedGenerateResolvedTemplatePdfWithMetadata,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          template: expect.objectContaining({
            schemaSnapshot: { sections: [] },
            renderConfigSnapshot: null,
            validationSnapshot: null,
          }),
        }),
      );
    });
  });
});
