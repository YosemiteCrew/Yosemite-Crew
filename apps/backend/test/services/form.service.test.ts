import { Types } from "mongoose";
import {
  FormModel,
  FormFieldModel,
  FormVersionModel,
  FormSubmissionModel,
} from "src/models/form";
import UserModel from "src/models/user";
import { FormService } from "src/services/form.service";
import {
  fromFormRequestDTO,
  fromFormSubmissionRequestDTO,
  toFHIRQuestionnaireResponse,
  toFormResponseDTO,
} from "@yosemite-crew/types";

jest.mock("src/models/form", () => ({
  __esModule: true,
  FormModel: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
  FormFieldModel: {
    deleteMany: jest.fn(),
    insertMany: jest.fn(),
    find: jest.fn(),
  },
  FormVersionModel: {
    findOne: jest.fn(),
    create: jest.fn(),
  },
  FormSubmissionModel: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("src/models/user", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock("@yosemite-crew/types", () => {
  const actual = jest.requireActual("@yosemite-crew/types");
  return {
    __esModule: true,
    ...actual,
    fromFormRequestDTO: jest.fn(),
    toFormResponseDTO: jest.fn(),
    fromFormSubmissionRequestDTO: jest.fn(),
    toFHIRQuestionnaireResponse: jest.fn(),
  };
});

const mockedFormModel = FormModel as unknown as {
  create: jest.Mock;
  findOne: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
};

const mockedFieldModel = FormFieldModel as unknown as {
  deleteMany: jest.Mock;
  insertMany: jest.Mock;
  find: jest.Mock;
};

const mockedVersionModel = FormVersionModel as unknown as {
  findOne: jest.Mock;
  create: jest.Mock;
};

const mockedSubmissionModel = FormSubmissionModel as unknown as {
  create: jest.Mock;
  findById: jest.Mock;
  find: jest.Mock;
};

const mockedUserModel = UserModel as unknown as {
  find: jest.Mock;
};

const mockedMapper = toFormResponseDTO as jest.Mock;
const mockedFromFormRequest = fromFormRequestDTO as jest.Mock;
const mockedFromSubmission = fromFormSubmissionRequestDTO as jest.Mock;
const mockedToFHIR = toFHIRQuestionnaireResponse as jest.Mock;

const validId = "507f1f77bcf86cd799439011";

const makeFormDoc = (overrides: Record<string, unknown> = {}) => ({
  _id: new Types.ObjectId(validId),
  name: "Form",
  category: "Cat",
  description: "Desc",
  visibilityType: "public",
  status: "draft",
  schema: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  updatedBy: "user",
  ...overrides,
  save: jest.fn(),
  toObject: jest.fn().mockReturnValue({
    _id: validId,
    name: "Form",
    ...overrides,
  }),
});

describe("FormService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedMapper.mockImplementation((val: unknown) => val);
    mockedFromFormRequest.mockImplementation((val: unknown) => val);
    mockedFromSubmission.mockImplementation((resp: any) => resp);
    mockedToFHIR.mockImplementation((val: unknown) => val);
    mockedVersionModel.findOne.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(null),
    });
    mockedUserModel.find.mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
  });

  describe("create", () => {
    it("throws for invalid org id", async () => {
      await expect(
        FormService.create("invalid", {} as any, "user-1"),
      ).rejects.toThrow("Invalid orgId");
    });

    it("creates form and syncs fields", async () => {
      const doc = makeFormDoc();
      mockedFormModel.create.mockResolvedValueOnce(doc);
      mockedFieldModel.deleteMany.mockResolvedValueOnce(undefined);
      mockedFieldModel.insertMany.mockResolvedValueOnce(undefined);
      const schema = [
        { id: "f1", type: "text", label: "Name", order: 1 },
        {
          id: "g1",
          type: "group",
          label: "Group",
          order: 2,
          fields: [{ id: "f2", type: "text", label: "Child", order: 1 }],
        },
      ];
      mockedFromFormRequest.mockReturnValueOnce({
        name: "New",
        category: "c",
        description: "d",
        visibilityType: "public",
        serviceId: undefined,
        speciesFilter: [],
        schema,
      });

      const result = await FormService.create(validId, {} as any, "user-1");

      expect(mockedFormModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orgId: expect.any(Types.ObjectId),
          status: "draft",
          createdBy: "user-1",
          updatedBy: "user-1",
          schema,
        }),
      );
      expect(mockedFieldModel.deleteMany).toHaveBeenCalledWith({
        formId: validId,
      });
      expect(mockedFieldModel.insertMany).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: "f1", formId: validId }),
          expect.objectContaining({ id: "f2", formId: validId }),
        ]),
      );
      expect(result).toEqual(doc.toObject());
    });
  });

  describe("getFormForAdmin", () => {
    it("throws when not found", async () => {
      mockedFormModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(
        FormService.getFormForAdmin(validId, validId),
      ).rejects.toThrow("Form not found");
    });

    it("returns mapped form", async () => {
      const doc = makeFormDoc();
      mockedFormModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(doc.toObject()),
      });

      const result = await FormService.getFormForAdmin(validId, validId);

      expect(mockedFormModel.findOne).toHaveBeenCalledWith({
        _id: expect.any(Types.ObjectId),
        orgId: expect.any(Types.ObjectId),
      });
      expect(result).toEqual(doc.toObject());
    });
  });

  describe("getFormForUser", () => {
    it("requires published version", async () => {
      mockedVersionModel.findOne.mockReturnValueOnce({
        sort: jest.fn().mockResolvedValue(null),
      });

      await expect(FormService.getFormForUser(validId)).rejects.toThrow(
        "Form has no published version",
      );
    });

    it("throws if form not found", async () => {
      mockedVersionModel.findOne.mockReturnValueOnce({
        sort: jest.fn().mockResolvedValue({ formId: validId, version: 1 }),
      });
      mockedFormModel.findById.mockResolvedValueOnce(null);

      await expect(FormService.getFormForUser(validId)).rejects.toThrow(
        "Form not found",
      );
    });

    it("returns latest published version", async () => {
      mockedVersionModel.findOne.mockReturnValueOnce({
        sort: jest.fn().mockResolvedValue({
          formId: validId,
          version: 2,
          schemaSnapshot: [],
        }),
      });
      mockedFormModel.findById.mockResolvedValueOnce(
        makeFormDoc({ status: "published", visibilityType: "private" }),
      );

      const result = await FormService.getFormForUser(validId);

      expect(mockedVersionModel.findOne).toHaveBeenCalled();
      expect(mockedMapper).toHaveBeenCalledWith(
        expect.objectContaining({ _id: validId, status: "published" }),
      );
      expect(result).toBeDefined();
    });
  });

  describe("update", () => {
    it("throws when form missing", async () => {
      mockedFormModel.findById.mockResolvedValueOnce(null);

      await expect(
        FormService.update(validId, {} as any, "user-1", "org-1"),
      ).rejects.toThrow("Form not found");
    });

    it("updates form fields and saves", async () => {
      const doc = makeFormDoc({
        name: "Old",
        orgId: "org-1",
        category: "old",
        description: "old",
        visibilityType: "public",
        serviceId: "svc-1",
        speciesFilter: [],
        schema: [],
      });
      mockedFormModel.findById.mockResolvedValueOnce(doc);
      mockedFieldModel.deleteMany.mockResolvedValueOnce(undefined);
      mockedFieldModel.insertMany.mockResolvedValueOnce(undefined);

      mockedFromFormRequest.mockReturnValueOnce({
        name: "Updated",
        category: "new",
        description: "new",
        visibilityType: "private",
        serviceId: "svc-2",
        speciesFilter: ["dog"],
        schema: [{ id: "f1", type: "text", label: "Name", order: 1 }],
      });

      await FormService.update(validId, {} as any, "user-2", "org-1");

      expect(doc.name).toBe("Updated");
      expect(doc.status).toBe("draft");
      expect(doc.updatedBy).toBe("user-2");
      expect(doc.save).toHaveBeenCalled();
      expect(mockedFieldModel.deleteMany).toHaveBeenCalledWith({
        formId: validId,
      });
      expect(mockedFieldModel.insertMany).toHaveBeenCalled();
    });
  });

  describe("publish", () => {
    it("throws when form missing", async () => {
      mockedFormModel.findById.mockResolvedValueOnce(null);

      await expect(FormService.publish(validId, "user-1")).rejects.toThrow(
        "Form not found",
      );
    });

    it("creates next version and updates status", async () => {
      const form = makeFormDoc({ schema: [{ id: "f1" }] });
      mockedFormModel.findById.mockResolvedValueOnce(form);
      mockedFieldModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([{ id: "f1" }]),
      });
      mockedVersionModel.findOne.mockReturnValueOnce({
        sort: jest.fn().mockResolvedValue({ version: 2 }),
      });
      mockedVersionModel.create.mockResolvedValueOnce(undefined);

      const result = await FormService.publish(validId, "user-9");

      expect(mockedVersionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          formId: expect.any(Types.ObjectId),
          version: 3,
          schemaSnapshot: form.schema,
        }),
      );
      expect(form.status).toBe("published");
      expect(form.updatedBy).toBe("user-9");
      expect(form.save).toHaveBeenCalled();
      expect(result).toEqual({ formId: validId, version: 3 });
    });
  });

  describe("unpublish and archive", () => {
    it("unpublishes a form", async () => {
      const form = makeFormDoc({ status: "published" });
      mockedFormModel.findById.mockResolvedValueOnce(form);

      const result = await FormService.unpublish(validId, "user-1");

      expect(form.status).toBe("draft");
      expect(form.updatedBy).toBe("user-1");
      expect(form.save).toHaveBeenCalled();
      expect(result).toEqual(form.toObject());
    });

    it("archives a form", async () => {
      const form = makeFormDoc({ status: "published" });
      mockedFormModel.findById.mockResolvedValueOnce(form);

      const result = await FormService.archive(validId, "user-2");

      expect(form.status).toBe("archived");
      expect(form.updatedBy).toBe("user-2");
      expect(form.save).toHaveBeenCalled();
      expect(result).toEqual(form.toObject());
    });
  });

  describe("submitFHIR", () => {
    it("creates submission from DTO", async () => {
      mockedFromSubmission.mockReturnValueOnce({
        formId: validId,
        formVersion: 1,
        submittedAt: new Date(),
        answers: [],
      });
      mockedSubmissionModel.create.mockResolvedValueOnce({
        toObject: jest.fn().mockReturnValue({ id: "sub-1" }),
      });

      const result = await FormService.submitFHIR({ formId: validId } as any);

      expect(mockedSubmissionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({ formId: validId }),
      );
      expect(result).toEqual({ id: "sub-1" });
    });
  });

  describe("getSubmission", () => {
    it("throws for missing submission", async () => {
      mockedSubmissionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(null),
      });

      await expect(FormService.getSubmission(validId)).rejects.toThrow(
        "Submission not found",
      );
    });

    it("returns mapped submission", async () => {
      mockedSubmissionModel.findById.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(validId),
          formId: new Types.ObjectId(validId),
          formVersion: 1,
          appointmentId: "apt",
          companionId: "c1",
          parentId: "p1",
          submittedBy: "u1",
          answers: [],
          submittedAt: new Date(),
        }),
      });
      mockedVersionModel.findOne.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue({ schemaSnapshot: [] }),
      });
      mockedToFHIR.mockReturnValueOnce({ normalized: true });

      const result = await FormService.getSubmission(validId);

      expect(mockedToFHIR).toHaveBeenCalled();
      expect(result).toEqual({ normalized: true });
    });
  });

  describe("listSubmissions", () => {
    it("lists submissions sorted", async () => {
      mockedSubmissionModel.find.mockReturnValueOnce({
        sort: jest.fn().mockReturnValue({
          lean: jest.fn().mockResolvedValue([{ id: "s1" }]),
        }),
      });

      const result = await FormService.listSubmissions(validId);

      expect(mockedSubmissionModel.find).toHaveBeenCalledWith({
        formId: expect.any(Types.ObjectId),
      });
      expect(result).toEqual([{ id: "s1" }]);
    });
  });

  describe("getAutoSendForms", () => {
    it("filters by serviceId when provided", async () => {
      mockedFormModel.find.mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue([{ id: "f1" }]),
      });

      const result = await FormService.getAutoSendForms(validId, "service-1");

      expect(mockedFormModel.find).toHaveBeenCalledWith({
        orgId: expect.any(Types.ObjectId),
        status: "published",
        serviceId: { $in: ["service-1"] },
      });
      expect(result).toEqual([{ id: "f1" }]);
    });
  });
});
