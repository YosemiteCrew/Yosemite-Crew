import { FormSigningService } from "../../src/services/formSigning.service";
import {
  FormModel,
  FormSubmissionModel,
  FormVersionModel,
} from "../../src/models/form";
import { ParentModel } from "../../src/models/parent";
import UserModel from "../../src/models/user";
import { DocumensoService } from "../../src/services/documenso.service";
import { generateFormSubmissionPdf } from "../../src/services/formPDF.service";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(() => false),
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
  },
}));

jest.mock("../../src/services/formPDF.service", () => ({
  generateFormSubmissionPdf: jest.fn(),
}));

const mockedFormSubmissionModel = FormSubmissionModel as unknown as {
  findById: jest.Mock;
};
const mockedFormVersionModel = FormVersionModel as unknown as {
  findOne: jest.Mock;
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
const mockedDocumensoService = DocumensoService as unknown as {
  createDocument: jest.Mock;
  distributeDocument: jest.Mock;
  resolveOrganisationApiKey: jest.Mock;
};
const mockedGeneratePdf = generateFormSubmissionPdf as jest.Mock;

describe("FormSigningService.startSigning", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DOCUMENSO_URL = "https://documenso.example";
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

    expect(mockedGeneratePdf).not.toHaveBeenCalled();
    expect(mockedDocumensoService.createDocument).not.toHaveBeenCalled();
  });

  it("allows parent signing when submission belongs to the parent", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-1" },
      parentId: "parent-owner",
      formId: "form-1",
      formVersion: 1,
      signing: { status: "PENDING" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
      save,
    });

    mockedFormVersionModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({ schemaSnapshot: [] }),
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Intake",
        orgId: "org-1",
        requiredSigner: "CLIENT",
      }),
    });

    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValueOnce(
      "documenso-api-key",
    );
    mockedGeneratePdf.mockResolvedValueOnce(Buffer.from("pdf"));

    mockedParentModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "parent@example.com",
        firstName: "Parent",
        lastName: "One",
      }),
    });

    mockedDocumensoService.createDocument.mockResolvedValueOnce({
      id: 123,
      recipients: [{ token: "recipient-token" }],
    });
    mockedDocumensoService.distributeDocument.mockResolvedValueOnce(undefined);

    await expect(
      FormSigningService.startSigning({
        isParent: true,
        submissionId: "submission-1",
        initiatedBy: "parent-owner",
      }),
    ).resolves.toEqual({
      documentId: 123,
      signingUrl: "https://documenso.example/sign/recipient-token",
    });

    expect(mockedDocumensoService.createDocument).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("uses submission.submittedBy instead of initiatedBy for non-parent signing", async () => {
    const save = jest.fn().mockResolvedValue(undefined);

    mockedFormSubmissionModel.findById.mockResolvedValueOnce({
      _id: { toString: () => "submission-2" },
      formId: "form-2",
      formVersion: 1,
      submittedBy: "submission-owner",
      signing: { status: "PENDING" },
      answers: { consent: true },
      submittedAt: new Date("2026-01-01"),
      save,
    });

    mockedFormVersionModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({ schemaSnapshot: [] }),
    });

    mockedFormModel.findById.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        name: "Clinical Form",
        orgId: "org-2",
        requiredSigner: "VET",
      }),
    });

    mockedDocumensoService.resolveOrganisationApiKey.mockResolvedValueOnce(
      "documenso-api-key",
    );
    mockedGeneratePdf.mockResolvedValueOnce(Buffer.from("pdf"));

    mockedUserModel.findOne.mockReturnValueOnce({
      lean: jest.fn().mockResolvedValue({
        email: "owner@example.com",
        firstName: "Owner",
        lastName: "User",
      }),
    });

    mockedDocumensoService.createDocument.mockResolvedValueOnce({
      id: 456,
      recipients: [{ token: "vet-token" }],
    });
    mockedDocumensoService.distributeDocument.mockResolvedValueOnce(undefined);

    await expect(
      FormSigningService.startSigning({
        submissionId: "submission-2",
        initiatedBy: "attacker-user",
      }),
    ).resolves.toEqual({
      documentId: 456,
      signingUrl: "https://documenso.example/sign/vet-token",
    });

    expect(mockedUserModel.findOne).toHaveBeenCalledWith({
      userId: "submission-owner",
    });
    expect(mockedDocumensoService.createDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        signerEmail: "owner@example.com",
        signerName: "Owner User",
      }),
    );
  });
});
