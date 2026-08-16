import { FormSigningService } from "../../src/services/formSigning.service";
import { prisma } from "../../src/config/prisma";
import { DocumensoService } from "../../src/services/documenso.service";
import {
  createRenderedDocumentRecord,
  signPersistedRenderedDocument,
} from "../../src/services/rendered-document.service";
import logger from "../../src/utils/logger";

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

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
const mockedLogger = logger as unknown as {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
};

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

describe("FormSigningService.startSigning — lookup and state guards", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("throws when the submission does not exist", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.startSigning({
        submissionId: "missing-submission",
        initiatedBy: "user-1",
      }),
    ).rejects.toThrow("Form submission not found");

    expect(mockedPrisma.formSubmission.findUnique).toHaveBeenCalledWith({
      where: { id: "missing-submission" },
    });
    expect(mockedPrisma.form.findUnique).not.toHaveBeenCalled();
  });

  it("throws when the referenced form does not exist", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-nf",
      formId: "form-nf",
      formVersion: 1,
      submittedBy: "user-nf",
      signing: { status: "NOT_STARTED" },
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-nf",
        initiatedBy: "user-nf",
      }),
    ).rejects.toThrow("Form not found");

    expect(mockedPrisma.form.findUnique).toHaveBeenCalledWith({
      where: { id: "form-nf" },
    });
    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
  });

  it("rejects PMS signing when the submission records no submitting user", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-nosubmitter",
      formId: "form-nosubmitter",
      formVersion: 1,
      submittedBy: null,
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Orphan",
      orgId: "org-1",
      requiredSigner: "VET",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-nosubmitter",
        initiatedBy: "vet-1",
        organisationId: "org-1",
      }),
    ).rejects.toThrow("Unauthorized to sign this submission");

    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("rejects a second signing attempt while one is already in progress", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-ip",
      formId: "form-ip",
      formVersion: 1,
      submittedBy: "user-ip",
      signing: { status: "IN_PROGRESS", documentId: "111" },
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-ip",
        initiatedBy: "user-ip",
      }),
    ).rejects.toThrow("Submission signing is already in progress");

    expect(mockedPrisma.form.findUnique).not.toHaveBeenCalled();
  });

  it("rejects signing a submission that is already signed", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-signed",
      formId: "form-signed",
      formVersion: 1,
      submittedBy: "user-signed",
      signing: { status: "SIGNED", documentId: "222" },
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-signed",
        initiatedBy: "user-signed",
      }),
    ).rejects.toThrow("Submission already signed");

    expect(mockedPrisma.form.findUnique).not.toHaveBeenCalled();
  });

  it("treats an array signing payload as no signing state and keeps going", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-arr",
      formId: "form-arr",
      formVersion: 1,
      submittedBy: "user-arr",
      signing: ["SIGNED"],
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-arr",
        initiatedBy: "user-arr",
      }),
    ).rejects.toThrow("Form not found");
  });

  it("ignores a non-string signing status and keeps going", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-numstatus",
      formId: "form-numstatus",
      formVersion: 1,
      submittedBy: "user-numstatus",
      signing: { status: 42 },
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-numstatus",
        initiatedBy: "user-numstatus",
      }),
    ).rejects.toThrow("Form not found");
  });
});

describe("FormSigningService.startSigning — parent ownership normalisation", () => {
  const formForParent = {
    name: "Consent",
    orgId: "org-norm",
    requiredSigner: "CLIENT",
  };

  const startParentSigning = (parentId: unknown, initiatedBy?: string) => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-norm",
      parentId,
      formId: "form-norm",
      formVersion: 1,
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValue(formForParent);

    return FormSigningService.startSigning({
      isParent: true,
      submissionId: "submission-norm",
      initiatedBy,
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedPrisma.parent.findUnique.mockResolvedValue({
      email: "parent@example.com",
      firstName: "Parent",
      lastName: "Norm",
    });
    mockedCreateRenderedDocumentRecord.mockResolvedValue({
      id: "rendered-norm",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValue({
      id: "rendered-norm",
      signing: { documentId: "999", signingUrl: "https://sign.example/999" },
    });
  });

  it("accepts an ObjectId-like parent id via toHexString", async () => {
    await expect(
      startParentSigning({ toHexString: () => "parent-hex" }, "parent-hex"),
    ).resolves.toEqual({
      documentId: "999",
      signingUrl: "https://sign.example/999",
    });

    expect(mockedPrisma.parent.findUnique).toHaveBeenCalledWith({
      where: { id: "parent-hex" },
    });
  });

  it("rejects when toHexString yields an empty id", async () => {
    await expect(
      startParentSigning({ toHexString: () => "" }, "parent-hex"),
    ).rejects.toThrow("Unauthorized to sign this submission");

    expect(mockedPrisma.form.findUnique).not.toHaveBeenCalled();
  });

  it("accepts a parent id that only stringifies", async () => {
    await expect(
      startParentSigning({ toString: () => "parent-str" }, "parent-str"),
    ).resolves.toEqual({
      documentId: "999",
      signingUrl: "https://sign.example/999",
    });
  });

  it("rejects a plain object parent id that stringifies to [object Object]", async () => {
    await expect(startParentSigning({}, "parent-str")).rejects.toThrow(
      "Unauthorized to sign this submission",
    );
  });

  it("rejects a parent id that stringifies to an empty string", async () => {
    await expect(
      startParentSigning({ toString: () => "" }, "parent-str"),
    ).rejects.toThrow("Unauthorized to sign this submission");
  });

  it("rejects a non-object, non-string parent id", async () => {
    await expect(startParentSigning(42, "42")).rejects.toThrow(
      "Unauthorized to sign this submission",
    );
  });

  it("rejects when the caller did not supply an initiator", async () => {
    await expect(startParentSigning("parent-owner", undefined)).rejects.toThrow(
      "Unauthorized to sign this submission",
    );
  });
});

describe("FormSigningService.startSigning — signer resolution", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedCreateRenderedDocumentRecord.mockResolvedValue({
      id: "rendered-sig",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValue({
      id: "rendered-sig",
      signing: { documentId: "321", signingUrl: "https://sign.example/321" },
    });
  });

  it("throws when the parent record cannot be loaded", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-noparent",
      parentId: "parent-1",
      formId: "form-noparent",
      formVersion: 1,
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Consent",
      orgId: "org-1",
      requiredSigner: "CLIENT",
    });
    mockedPrisma.parent.findUnique.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-noparent",
        initiatedBy: "parent-1",
      }),
    ).rejects.toThrow("Unbale to find parent");

    expect(mockedLogger.info).toHaveBeenCalledWith(
      "Signing initiated by parent: ",
      "parent-1",
    );
  });

  it("throws when the submitting PMS user cannot be loaded", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-nouser",
      formId: "form-nouser",
      formVersion: 1,
      submittedBy: "user-gone",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Clinical",
      orgId: "org-1",
      requiredSigner: null,
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-nouser",
        initiatedBy: "user-gone",
      }),
    ).rejects.toThrow("Unable to find submitting user");

    expect(mockedPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { userId: "user-gone" },
    });
  });

  it("rejects vet signing when the form requires a client signature", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-clientonly",
      formId: "form-clientonly",
      formVersion: 1,
      submittedBy: "vet-1",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Consent",
      orgId: "org-1",
      requiredSigner: "CLIENT",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-clientonly",
        initiatedBy: "vet-1",
      }),
    ).rejects.toThrow("Form requires client signature");

    expect(mockedPrisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("skips the signer check entirely when the form has no required signer", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-anysigner",
      formId: "form-anysigner",
      formVersion: 4,
      submittedBy: "vet-2",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Any Signer",
      orgId: "org-any",
      requiredSigner: null,
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      email: "vet2@example.com",
      firstName: "Vet",
      lastName: "Two",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-anysigner",
        initiatedBy: "vet-2",
      }),
    ).resolves.toEqual({
      documentId: "321",
      signingUrl: "https://sign.example/321",
    });

    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        signerType: "PMS_USER",
        signerId: "vet-2",
        signerEmail: "vet2@example.com",
        signerName: "Vet Two",
      }),
    );
  });

  it("allows PMS signing when the form has no organisation of its own", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-noorg",
      formId: "form-noorg",
      formVersion: 1,
      submittedBy: "vet-3",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Orgless",
      orgId: "",
      requiredSigner: "VET",
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      email: "vet3@example.com",
      firstName: "Vet",
      lastName: "Three",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-noorg",
        initiatedBy: "vet-3",
        organisationId: "org-caller",
      }),
    ).resolves.toEqual({
      documentId: "321",
      signingUrl: "https://sign.example/321",
    });
  });

  it("throws when the submission id cannot be normalised", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "",
      formId: "form-badid",
      formVersion: 1,
      submittedBy: "vet-4",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Bad Id",
      orgId: "org-badid",
      requiredSigner: "VET",
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      email: "vet4@example.com",
      firstName: "Vet",
      lastName: "Four",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-badid",
        initiatedBy: "vet-4",
      }),
    ).rejects.toThrow("Unable to determine submission id");

    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
  });

  it("throws and logs when the resolved signer has no email", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-noemail",
      formId: "form-noemail",
      formVersion: 1,
      submittedBy: "vet-5",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "No Email",
      orgId: "org-noemail",
      requiredSigner: "VET",
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      email: "",
      firstName: "Vet",
      lastName: "Five",
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-noemail",
        initiatedBy: "vet-5",
      }),
    ).rejects.toThrow("Signer email is required for signing");

    expect(mockedLogger.error).toHaveBeenCalledWith("Signer email is missing");
    expect(mockedCreateRenderedDocumentRecord).not.toHaveBeenCalled();
  });

  it("falls back to the rendered document id and a null signing url when the provider returns no signing block", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-fallback",
      formId: "form-fallback",
      formVersion: 7,
      submittedBy: "vet-6",
      signing: null,
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({
      name: "Fallback",
      orgId: "org-fallback",
      requiredSigner: "VET",
    });
    mockedPrisma.user.findUnique.mockResolvedValueOnce({
      email: "vet6@example.com",
      firstName: "Vet",
      lastName: "Six",
    });
    mockedCreateRenderedDocumentRecord.mockResolvedValueOnce({
      id: "rendered-fallback",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "rendered-fallback",
      signing: null,
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-fallback",
        initiatedBy: "vet-6",
      }),
    ).resolves.toEqual({
      documentId: "rendered-fallback",
      signingUrl: null,
    });

    expect(mockedPrisma.formSubmission.update).toHaveBeenCalledWith({
      where: { id: "submission-fallback" },
      data: {
        signing: {
          required: true,
          status: "IN_PROGRESS",
          provider: "DOCUMENSO",
          documentId: "rendered-fallback",
          signer: { email: "vet6@example.com", role: "VET" },
        },
      },
    });
  });
});

describe("FormSigningService.getSignedDocument — download failures", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("treats a missing signing block as not signed yet", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-nosigning",
      formId: "form-nosigning",
      signing: null,
    });

    await expect(
      FormSigningService.getSignedDocument({
        submissionId: "submission-nosigning",
      }),
    ).rejects.toThrow("Submission is not signed yet");
  });

  it("rejects a non-string document id", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-numdoc",
      formId: "form-numdoc",
      signing: { status: "SIGNED", documentId: 555 },
    });

    await expect(
      FormSigningService.getSignedDocument({
        submissionId: "submission-numdoc",
      }),
    ).rejects.toThrow("No document associated with this submission");
  });

  it("ignores an array signing payload when reading the document id", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-arrdoc",
      formId: "form-arrdoc",
      signing: [],
    });

    await expect(
      FormSigningService.getSignedDocument({
        submissionId: "submission-arrdoc",
      }),
    ).rejects.toThrow("Submission is not signed yet");
  });

  it("throws when the organisation has no Documenso API key", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-nokey",
      formId: "form-nokey",
      signing: { status: "SIGNED", documentId: "777" },
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({ orgId: "org-nokey" });
    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValueOnce(
      null,
    );

    await expect(
      FormSigningService.getSignedDocument({
        submissionId: "submission-nokey",
      }),
    ).rejects.toThrow("Documenso API key not configured for organisation");

    expect(
      mockedDocumensoService.downloadSignedDocument,
    ).not.toHaveBeenCalled();
  });

  it("throws when the signed document cannot be downloaded", async () => {
    mockedPrisma.formSubmission.findUnique.mockResolvedValueOnce({
      id: "submission-nodl",
      formId: "form-nodl",
      signing: { status: "SIGNED", documentId: "888" },
    });
    mockedPrisma.form.findUnique.mockResolvedValueOnce({ orgId: "org-nodl" });
    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValueOnce(
      "api-key-nodl",
    );
    mockedDocumensoService.downloadSignedDocument.mockResolvedValueOnce(null);

    await expect(
      FormSigningService.getSignedDocument({ submissionId: "submission-nodl" }),
    ).rejects.toThrow("Unable to download signed document");

    expect(mockedDocumensoService.downloadSignedDocument).toHaveBeenCalledWith({
      documentId: 888,
      apiKey: "api-key-nodl",
    });
  });
});
