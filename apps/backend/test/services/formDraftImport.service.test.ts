jest.mock("src/config/prisma", () => ({
  prisma: {
    form: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
    formVersion: {
      findFirst: jest.fn(),
    },
    formDraftImport: {
      create: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

jest.mock("../../src/services/form.service", () => {
  const actual = jest.requireActual("../../src/services/form.service");
  return {
    ...actual,
    FormService: { create: jest.fn() },
  };
});

jest.mock("@yosemite-crew/types", () => ({
  toFHIRQuestionnaire: jest.fn((form) => ({ __questionnaireFrom: form })),
}));

jest.mock("../../src/utils/logger", () => ({
  __esModule: true,
  default: { error: jest.fn(), info: jest.fn(), warn: jest.fn() },
}));

import { prisma } from "src/config/prisma";
import { FormService, FormServiceError } from "../../src/services/form.service";
import { FormDraftImportService } from "../../src/services/formDraftImport.service";

const mockedPrisma = prisma as unknown as {
  form: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    delete: jest.Mock;
  };
  formVersion: { findFirst: jest.Mock };
  formDraftImport: {
    create: jest.Mock;
    findFirst: jest.Mock;
    delete: jest.Mock;
  };
};

const mockedFormService = FormService as unknown as { create: jest.Mock };

describe("FormDraftImportService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const baseInput = {
      organisationId: "org-1",
      userId: "user-1",
      suppliedText: "Owner Name | input | required",
    };

    it("rejects empty suppliedText", async () => {
      await expect(
        FormDraftImportService.create({ ...baseInput, suppliedText: "   " }),
      ).rejects.toThrow(FormServiceError);
      expect(mockedFormService.create).not.toHaveBeenCalled();
    });

    it("rejects suppliedText over the length ceiling", async () => {
      await expect(
        FormDraftImportService.create({
          ...baseInput,
          suppliedText: "a".repeat(20_001),
        }),
      ).rejects.toThrow("must not exceed 20000 characters");
      expect(mockedFormService.create).not.toHaveBeenCalled();
    });

    it("rejects text with no supported fields", async () => {
      await expect(
        FormDraftImportService.create({
          ...baseInput,
          suppliedText: "Vitals Table | table | required",
        }),
      ).rejects.toThrow("No supported fields were found");
    });

    it("404s when sourceFormId does not belong to the organisation", async () => {
      mockedPrisma.form.findFirst.mockResolvedValueOnce(null);

      await expect(
        FormDraftImportService.create({
          ...baseInput,
          sourceFormId: "form-in-another-org",
        }),
      ).rejects.toThrow("Source form not found");

      expect(mockedPrisma.form.findFirst).toHaveBeenCalledWith({
        where: { id: "form-in-another-org", orgId: "org-1" },
        select: { id: true, name: true, category: true, updatedAt: true },
      });
    });

    it("creates a draft Form via the existing FormService.create path and records the import", async () => {
      mockedFormService.create.mockResolvedValueOnce({ id: "draft-form-1" });
      mockedPrisma.formDraftImport.create.mockResolvedValueOnce({
        id: "import-1",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });

      const result = await FormDraftImportService.create(baseInput);

      expect(mockedFormService.create).toHaveBeenCalledWith(
        "org-1",
        expect.objectContaining({ __questionnaireFrom: expect.any(Object) }),
        "user-1",
      );
      expect(mockedPrisma.formDraftImport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organisationId: "org-1",
          draftFormId: "draft-form-1",
          sourceFormId: undefined,
          createdByUserId: "user-1",
        }),
      });
      expect(result.draftFormId).toBe("draft-form-1");
      expect(result.fields).toHaveLength(1);
      expect(result.diff).toEqual([
        {
          id: "owner-name",
          change: "added",
          after: { type: "input", label: "Owner Name", required: true },
        },
      ]);
      expect(result.stale).toBe(false);
    });

    it("sets requiredSigner when a signature field is present, so the reused create path does not reject it", async () => {
      mockedFormService.create.mockResolvedValueOnce({ id: "draft-form-2" });
      mockedPrisma.formDraftImport.create.mockResolvedValueOnce({
        id: "import-2",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await FormDraftImportService.create({
        ...baseInput,
        suppliedText: "Signature | signature | required",
      });

      const questionnaireArg = mockedFormService.create.mock.calls[0][1];
      expect(questionnaireArg.__questionnaireFrom.requiredSigner).toBe(
        "CLIENT",
      );
    });

    it("carries a choice field's options into the schema passed to FormService.create", async () => {
      mockedFormService.create.mockResolvedValueOnce({ id: "draft-form-4" });
      mockedPrisma.formDraftImport.create.mockResolvedValueOnce({
        id: "import-4",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      await FormDraftImportService.create({
        ...baseInput,
        suppliedText: "Contact Method | dropdown | optional | Email, Phone",
      });

      const questionnaireArg = mockedFormService.create.mock.calls[0][1];
      expect(questionnaireArg.__questionnaireFrom.schema[0]).toMatchObject({
        type: "dropdown",
        options: [
          { label: "Email", value: "email" },
          { label: "Phone", value: "phone" },
        ],
      });
    });

    it("diffs against the source form's latest published version when one exists", async () => {
      mockedPrisma.form.findFirst.mockResolvedValueOnce({
        id: "source-1",
        name: "Intake",
        category: "General",
        updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      });
      mockedPrisma.formVersion.findFirst.mockResolvedValueOnce({
        version: 3,
        fieldsSnapshot: [
          {
            id: "owner-name",
            type: "input",
            label: "Owner Name",
            required: true,
          },
        ],
      });
      mockedFormService.create.mockResolvedValueOnce({ id: "draft-form-3" });
      mockedPrisma.formDraftImport.create.mockResolvedValueOnce({
        id: "import-3",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await FormDraftImportService.create({
        ...baseInput,
        sourceFormId: "source-1",
      });

      expect(result.diff).toEqual([
        {
          id: "owner-name",
          change: "unchanged",
          before: { type: "input", label: "Owner Name", required: true },
          after: { type: "input", label: "Owner Name", required: true },
        },
      ]);
      expect(mockedPrisma.formDraftImport.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sourceFormId: "source-1",
          sourceFormVersionAtImport: 3,
        }),
      });
    });
  });

  describe("get", () => {
    it("404s when the import does not belong to the organisation", async () => {
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce(null);
      await expect(
        FormDraftImportService.get("org-1", "import-1"),
      ).rejects.toThrow("Draft import not found");
    });

    it("is not stale when the source form is unchanged since import", async () => {
      const importedAt = new Date("2026-01-01T00:00:00.000Z");
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce({
        id: "import-1",
        organisationId: "org-1",
        sourceFormId: "source-1",
        draftFormId: "draft-1",
        suppliedText: "Owner Name | input | required",
        sourceFormVersionAtImport: 2,
        sourceFormUpdatedAtImport: importedAt,
        createdAt: importedAt,
        updatedAt: importedAt,
      });
      mockedPrisma.form.findUnique.mockResolvedValueOnce({
        updatedAt: importedAt,
      });
      mockedPrisma.formVersion.findFirst.mockResolvedValueOnce({
        version: 2,
        fieldsSnapshot: [],
      });

      const result = await FormDraftImportService.get("org-1", "import-1");
      expect(result.stale).toBe(false);
    });

    it("is stale when the source form was published to a new version since import", async () => {
      const importedAt = new Date("2026-01-01T00:00:00.000Z");
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce({
        id: "import-1",
        organisationId: "org-1",
        sourceFormId: "source-1",
        draftFormId: "draft-1",
        suppliedText: "Owner Name | input | required",
        sourceFormVersionAtImport: 2,
        sourceFormUpdatedAtImport: importedAt,
        createdAt: importedAt,
        updatedAt: importedAt,
      });
      mockedPrisma.form.findUnique.mockResolvedValueOnce({
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      });
      mockedPrisma.formVersion.findFirst.mockResolvedValueOnce({
        version: 3,
        fieldsSnapshot: [],
      });

      const result = await FormDraftImportService.get("org-1", "import-1");
      expect(result.stale).toBe(true);
    });

    it("is stale when the source form was edited without a new publish", async () => {
      const importedAt = new Date("2026-01-01T00:00:00.000Z");
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce({
        id: "import-1",
        organisationId: "org-1",
        sourceFormId: "source-1",
        draftFormId: "draft-1",
        suppliedText: "Owner Name | input | required",
        sourceFormVersionAtImport: 2,
        sourceFormUpdatedAtImport: importedAt,
        createdAt: importedAt,
        updatedAt: importedAt,
      });
      mockedPrisma.form.findUnique.mockResolvedValueOnce({
        updatedAt: new Date("2026-01-01T12:00:00.000Z"),
      });
      mockedPrisma.formVersion.findFirst.mockResolvedValueOnce({
        version: 2,
        fieldsSnapshot: [],
      });

      const result = await FormDraftImportService.get("org-1", "import-1");
      expect(result.stale).toBe(true);
    });
  });

  describe("discard", () => {
    it("404s when the import does not belong to the organisation", async () => {
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce(null);
      await expect(
        FormDraftImportService.discard("org-1", "import-1"),
      ).rejects.toThrow("Draft import not found");
    });

    it("deletes the draft Form when it is still a draft", async () => {
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce({
        id: "import-1",
        organisationId: "org-1",
        draftFormId: "draft-1",
      });
      mockedPrisma.form.findUnique.mockResolvedValueOnce({ status: "draft" });

      await FormDraftImportService.discard("org-1", "import-1");

      expect(mockedPrisma.form.delete).toHaveBeenCalledWith({
        where: { id: "draft-1" },
      });
    });

    it("refuses to discard a draft that has already been published", async () => {
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce({
        id: "import-1",
        organisationId: "org-1",
        draftFormId: "draft-1",
      });
      mockedPrisma.form.findUnique.mockResolvedValueOnce({
        status: "published",
      });

      await expect(
        FormDraftImportService.discard("org-1", "import-1"),
      ).rejects.toThrow("already been published");
      expect(mockedPrisma.form.delete).not.toHaveBeenCalled();
    });

    it("cleans up an orphaned tracking row whose draft Form is already gone", async () => {
      mockedPrisma.formDraftImport.findFirst.mockResolvedValueOnce({
        id: "import-1",
        organisationId: "org-1",
        draftFormId: "draft-1",
      });
      mockedPrisma.form.findUnique.mockResolvedValueOnce(null);

      await FormDraftImportService.discard("org-1", "import-1");

      expect(mockedPrisma.formDraftImport.delete).toHaveBeenCalledWith({
        where: { id: "import-1" },
      });
      expect(mockedPrisma.form.delete).not.toHaveBeenCalled();
    });
  });
});
