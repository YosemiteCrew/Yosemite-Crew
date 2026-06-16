import { FormSigningService } from "../../src/services/formSigning.service";
import { FormModel, FormSubmissionModel } from "../../src/models/form";
import { ParentModel } from "../../src/models/parent";
import UserModel from "../../src/models/user";
import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import { DocumensoService } from "../../src/services/documenso.service";
import {
  createRenderedDocumentRecord,
  signPersistedRenderedDocument,
} from "../../src/services/rendered-document.service";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => false),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    form: {
      findUnique: jest.fn(),
    },
    formSubmission: {
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    parent: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/models/form", () => ({
  FormModel: {
    findById: jest.fn(),
  },
  FormSubmissionModel: {
    findById: jest.fn(),
  },
  FormVersionModel: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/parent", () => ({
  ParentModel: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/user", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/services/documenso.service", () => ({
  DocumensoService: {
    createDocument: jest.fn(),
    distributeDocument: jest.fn(),
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));

jest.mock("../../src/services/rendered-document.service", () => ({
  createRenderedDocumentRecord: jest.fn(),
  signPersistedRenderedDocument: jest.fn(),
}));

const mockedFormSubmissionModel = FormSubmissionModel as unknown as {
  findById: jest.Mock;
};
const mockedFormModel = FormModel as unknown as {
  findById: jest.Mock;
};
const mockedParentModel = ParentModel as unknown as {
  findById: jest.Mock;
};
const mockedUserModel = UserModel as unknown as {
  findOne: jest.Mock;
};
const mockedPrisma = prisma as unknown as {
  form: { findUnique: jest.Mock };
  formSubmission: {
    findUnique: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  parent: { findUnique: jest.Mock };
  user: { findUnique: jest.Mock };
};
const mockedReadSwitch = isReadFromPostgres as jest.Mock;
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
    mockedReadSwitch.mockReturnValue(false);
  });

  it("rejects parent signing when submission does not belong to the parent", async () => {
    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
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
    const save = jest.fn().mockResolvedValue(undefined);

    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-1" },
      parentId: "parent-owner",
      formId: "form-1",
      formVersion: 1,
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
      save,
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Intake",
        orgId: "org-1",
        requiredSigner: "CLIENT",
      }),
    });

    mockedParentModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "parent@example.com",
        firstName: "Parent",
        lastName: "One",
      }),
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
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("uses submission.submittedBy instead of initiatedBy for non-parent signing", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-2" },
      formId: "form-2",
      formVersion: 1,
      submittedBy: "submission-owner",
      signing: { status: "NOT_STARTED" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
      save,
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Clinical Form",
        orgId: "org-2",
        requiredSigner: "VET",
      }),
    });

    mockedUserModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
      }),
    });

    mockedCreateRenderedDocumentRecord.mockResolvedValueOnce({
      id: "rendered-doc-2",
      signing: null,
    });
    mockedSignPersistedRenderedDocument.mockResolvedValueOnce({
      id: "rendered-doc-2",
      signing: {
        documentId: "456",
        signingUrl: "https://documenso.example/sign/vet-token",
      },
    });

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-2",
        initiatedBy: "attacker-user",
      }),
    ).resolves.toEqual({
      documentId: "456",
      signingUrl: "https://documenso.example/sign/vet-token",
    });

    expect(mockedUserModel.findOne).toHaveBeenCalledWith({
      userId: "submission-owner",
    });
    expect(mockedCreateRenderedDocumentRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Clinical Form",
        source: expect.objectContaining({
          sourceKind: "FORM_SUBMISSION",
          sourceId: "submission-2",
          organisationId: "org-2",
          templateKind: "FORM",
          templateId: "form-2",
          templateVersion: 1,
        }),
      }),
    );
    expect(mockedSignPersistedRenderedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        renderedDocumentId: "rendered-doc-2",
        organisationId: "org-2",
        signerType: "PMS_USER",
        signerEmail: "owner@example.com",
        signerName: "Owner User",
      }),
    );
  });

  it("rejects parent signing when the required signer does not match", async () => {
    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-3" },
      parentId: "parent-owner",
      formId: "form-3",
      formVersion: 1,
      signing: { status: "NOT_STARTED" },
      submittedBy: "submission-owner",
      save: jest.fn(),
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Intake",
        orgId: "org-3",
        requiredSigner: "VET",
      }),
    });

    mockedParentModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "parent@example.com",
        firstName: "Parent",
        lastName: "One",
      }),
    });

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-3",
        initiatedBy: "parent-owner",
      }),
    ).rejects.toThrow("Form requires vet signature");
  });

  it("starts signing in the postgres branch and persists the document id", async () => {
    mockedReadSwitch.mockReturnValue(true);
    mockedPrisma.formSubmission.findUnique.mockResolvedValue({
      id: "submission-4",
      formId: "form-4",
      formVersion: 2,
      submittedBy: "user-4",
      parentId: null,
      signing: { status: "NOT_STARTED" },
    });
    mockedPrisma.form.findUnique.mockResolvedValue({
      name: "Pg Intake",
      orgId: "org-pg",
      requiredSigner: "VET",
    });
    mockedPrisma.user.findUnique.mockResolvedValue({
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
      }),
    ).resolves.toEqual({
      documentId: "789",
      signingUrl: "https://documenso.example/sign/pg-token",
    });

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

  it("returns the signed PDF in the mongo branch", async () => {
    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-5" },
      formId: "form-5",
      submittedBy: "user-5",
      signing: { status: "SIGNED", documentId: "555" },
    });
    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        orgId: "org-5",
      }),
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
    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-6" },
      formId: "form-6",
      signing: { status: "IN_PROGRESS", documentId: "666" },
    });

    await expect(
      FormSigningService.getSignedDocument({ submissionId: "submission-6" }),
    ).rejects.toThrow("Submission is not signed yet");
  });

  it("rejects signed submissions without a document id", async () => {
    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-7" },
      formId: "form-7",
      signing: { status: "SIGNED" },
    });
    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        orgId: "org-7",
      }),
    });
    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValue(
      "api-key-7",
    );

    await expect(
      FormSigningService.getSignedDocument({ submissionId: "submission-7" }),
    ).rejects.toThrow("No document associated with this submission");
  });
});
