import { FormSigningService } from "../../src/services/formSigning.service";
import { prisma } from "../../src/config/prisma";
import { DocumensoService } from "../../src/services/documenso.service";
import {
  createRenderedDocumentRecord,
  signPersistedRenderedDocument,
} from "../../src/services/rendered-document.service";

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    form: {
      findUnique: jest.fn(),
    },
    formSubmission: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/rendered-document.service", () => ({
  createRenderedDocumentRecord: jest.fn(),
  signPersistedRenderedDocument: jest.fn(),
}));

const mockedPrisma = prisma as unknown as {
  form: { findUnique: jest.Mock };
  formSubmission: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  parent: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
};
const mockedDocumensoService = DocumensoService as unknown as {
  resolveOrganisationApiKey: jest.Mock;
  downloadSignedDocument: jest.Mock;
};
const mockedCreateRenderedDocumentRecord =
  createRenderedDocumentRecord as jest.Mock;
const mockedSignPersistedRenderedDocument =
  signPersistedRenderedDocument as jest.Mock;

describe("FormSigningService.startSigning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOCUMENSO_URL = "https://documenso.example";
  });

  it("rejects parent signing when submission does not belong to the parent", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      parentId: "parent-owner",
    });

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-1",
        initiatedBy: "different-parent",
      }),
    ).rejects.toThrow("Unauthorized to sign this submission");

    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
    expect(mockedSignPersistedRenderedDocument).not.toHaveBeenCalled();
  });

  it("allows parent signing when submission belongs to the parent", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-1",
      parentId: "parent-owner",
      formId: "form-1",
      formVersion: 1,
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
    });

    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Intake",
      orgId: "org-1",
      requiredSigner: "CLIENT",
    });

    mockedPrisma.parent.findUnique.mockResolvedValueOnce({
      email: "parent@example.com",
      firstName: "Parent",
      lastName: "One",
    });

    mockedCreateRenderedDocumentRecord.mockResolvedValueOnce({
      id: "rendered-doc-1",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "rendered-doc-1",
      signing: {
        documentId: "123",
        signingUrl: "https://documenso.example/sign/recipient-token",
      },
    });

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-1",
        initiatedBy: "parent-owner",
      }),
    ).resolves.toEqual({
      documentId: "123",
      signingUrl: "https://documenso.example/sign/recipient-token",
    });

    expect(mockedPrisma.parent.findUnique).toHaveBeenCalledWith({
      where: { id: "parent-owner" },
    });
    expect(mockedCreateRenderedDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Intake",
        source: expect.objectContaining({
          sourceKind: "FORM_SUBMISSION",
          sourceId: "submission-1",
          organisationId: "org-1",
          templateKind: "FORM",
          templateId: "form-1",
          templateVersion: 1,
        }),
      }),
    );
    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        renderedDocumentId: "rendered-doc-1",
        organisationId: "org-1",
        signerType: "PARENT",
        signerEmail: "parent@example.com",
        signerName: "Parent One",
      }),
    );
    expect(mockedPrisma.formSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-1" },
      data: expect.objectContaining({
        signing: expect.objectContaining({
          status: "IN_PROGRESS",
          documentId: "123",
        }),
      }),
    });
  });

  it("rejects PMS signing when the caller is not the submission owner", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-2",
      formId: "form-2",
      formVersion: 1,
      submittedBy: "submission-owner",
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
    });

    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Clinical Form",
      orgId: "org-2",
      requiredSigner: "VET",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-2",
        initiatedBy: "attacker-user",
        organisationId: "org-2",
      }),
    ).rejects.toThrow("Unauthorized to sign this submission");

    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
    expect(mockedSignPersistedRenderedDocument).not.toHaveBeenCalled();
  });

  it("rejects PMS signing when the form belongs to another organisation", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-2b",
      formId: "form-2b",
      formVersion: 1,
      submittedBy: "submission-owner",
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
    });

    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Clinical Form",
      orgId: "org-owner",
      requiredSigner: "VET",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-2b",
        // Caller IS the submission owner, but is acting from a different org.
        initiatedBy: "submission-owner",
        organisationId: "org-attacker",
      }),
    ).rejects.toThrow("Unauthorized to sign this submission");

    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
    expect(mockedSignPersistedRenderedDocument).not.toHaveBeenCalled();
  });

  it("allows PMS signing when the caller owns the submission in their org", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-4",
      formId: "form-4",
      formVersion: 2,
      submittedBy: "user-4",
      parentId: null,
      signing: { status: "NOT_STARTED" },
    });

    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Pg Intake",
      orgId: "org-pg",
      requiredSigner: "VET",
    });

    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      email: "vet@example.com",
      firstName: "Vet",
      lastName: "User",
    });

    mockedCreateRenderedDocumentRecord.mockResolvedValueOnce({
      id: "rendered-doc-4",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "rendered-doc-4",
      signing: {
        documentId: "789",
        signingUrl: "https://documenso.example/sign/pg-token",
      },
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-4",
        initiatedBy: "user-4",
        organisationId: "org-pg",
      }),
    ).resolves.toEqual({
      documentId: "789",
      signingUrl: "https://documenso.example/sign/pg-token",
    });

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-4" },
    });
    expect(mockedCreateRenderedDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Pg Intake",
        source: expect.objectContaining({
          sourceKind: "FORM_SUBMISSION",
          sourceId: "submission-4",
          organisationId: "org-pg",
          templateKind: "FORM",
          templateId: "form-4",
          templateVersion: 2,
        }),
      }),
    );
    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        renderedDocumentId: "rendered-doc-4",
        organisationId: "org-pg",
        signerType: "PMS_USER",
        signerEmail: "vet@example.com",
        signerName: "Vet User",
      }),
    );
    expect(mockedPrisma.formSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-4" },
      data: expect.objectContaining({
        signing: expect.objectContaining({
          status: "IN_PROGRESS",
          documentId: "789",
        }),
      }),
    });
  });

  it("rejects parent signing when the required signer does not match", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-3",
      parentId: "parent-owner",
      formId: "form-3",
      formVersion: 1,
      signing: { status: "NOT_STARTED" },
      submittedBy: "submission-owner",
    });

    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Intake",
      orgId: "org-3",
      requiredSigner: "VET",
    });

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-3",
        initiatedBy: "parent-owner",
      }),
    ).rejects.toThrow("Form requires vet signature");
  });

  it("returns the signed PDF for a signed submission", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-5",
      formId: "form-5",
      submittedBy: "user-5",
      signing: { status: "SIGNED", documentId: "555" },
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      orgId: "org-5",
    });
    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValue(
      "api-key-5",
    );
    mockedDocumensoService.downloadSignedDocument.mockResolvedValue({
      downloadUrl: "https://files.example/result.pdf",
    });

    await expect(
      FormSigningService.getSignedDocument({ submissionId: "submission-5" }),
    ).resolves.toEqual({
      pdf: {
        downloadUrl: "https://files.example/result.pdf",
      },
    });
  });

  it("rejects unsigned submissions when fetching signed documents", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-6",
      formId: "form-6",
      signing: { status: "IN_PROGRESS", documentId: "666" },
    });

    await expect(
      FormSigningService.getSignedDocument({ submissionId: "submission-6" }),
    ).rejects.toThrow("Submission is not signed yet");
  });

  it("rejects signed submissions without a document id", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-7",
      formId: "form-7",
      signing: { status: "SIGNED" },
    });

    await expect(
      FormSigningService.getSignedDocument({ submissionId: "submission-7" }),
    ).rejects.toThrow("No document associated with this submission");
  });
});
