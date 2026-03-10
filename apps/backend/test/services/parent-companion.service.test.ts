import { Types } from "mongoose";
import {
  ParentCompanionService,
  ParentCompanionServiceError,
} from "../../src/services/parent-companion.service";
import ParentCompanionModel from "../../src/models/parent-companion";

// 1. Mock the Mongoose Model and Utilities
jest.mock("../../src/models/parent-companion", () => {
  return {
    __esModule: true,
    default: {
      create: jest.fn(),
      findOne: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findByIdAndUpdate: jest.fn(),
      deleteOne: jest.fn(),
      deleteMany: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
    },
    toCompanionParentLink: jest.fn((doc) => ({ ...doc, mapped: true })),
  };
});

// 2. Helper to mock Mongoose queries (fixes SonarQube S7739)
// Instead of creating a fake object with a .then(), we augment a real Promise.
const createMockQuery = (val: any) => {
  const promise = Promise.resolve(val);
  Object.assign(promise, {
    exec: jest.fn().mockResolvedValue(val),
    populate: jest.fn().mockReturnValue(promise),
  });
  return promise;
};

// 3. Strict Interface to satisfy TypeScript (fixes TS 2339 errors)
interface MockParentCompanionDoc {
  _id: Types.ObjectId;
  parentId: Types.ObjectId;
  companionId: Types.ObjectId;
  role: string;
  status: string;
  permissions: Record<string, any>;
  acceptedAt?: Date;
  save: jest.Mock;
  [key: string]: any;
}

const makeMockDoc = (
  overrides: Partial<MockParentCompanionDoc> = {}
): MockParentCompanionDoc => ({
  _id: new Types.ObjectId(),
  parentId: new Types.ObjectId(),
  companionId: new Types.ObjectId(),
  role: "CO_PARENT",
  status: "ACTIVE",
  permissions: {},
  save: jest.fn().mockResolvedValue(true),
  ...overrides,
});

describe("ParentCompanionService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ParentCompanionServiceError", () => {
    it("should construct properly", () => {
      const error = new ParentCompanionServiceError("Test error", 400);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ParentCompanionServiceError");
    });
  });

  describe("linkParent", () => {
    const parentId = new Types.ObjectId();
    const companionId = new Types.ObjectId();

    it("throws if parentId is missing", async () => {
      await expect(
        ParentCompanionService.linkParent({
          parentId: null as any,
          companionId,
        })
      ).rejects.toThrow(ParentCompanionServiceError);
    });

    it("throws if companionId is missing", async () => {
      await expect(
        ParentCompanionService.linkParent({
          parentId,
          companionId: null as any,
        })
      ).rejects.toThrow(ParentCompanionServiceError);
    });

    it("creates a PRIMARY link with default ACTIVE status", async () => {
      const mockResult = makeMockDoc({ role: "PRIMARY" });
      (ParentCompanionModel.create as jest.Mock).mockResolvedValue([
        mockResult,
      ]);

      const result = await ParentCompanionService.linkParent({
        parentId,
        companionId,
        role: "PRIMARY",
      });

      expect(result).toEqual(mockResult);
      expect(ParentCompanionModel.create).toHaveBeenCalledWith([
        expect.objectContaining({ status: "ACTIVE", role: "PRIMARY" }),
      ]);
    });

    it("creates a CO_PARENT link with default PENDING status", async () => {
      (ParentCompanionModel.create as jest.Mock).mockResolvedValue([
        makeMockDoc(),
      ]);
      await ParentCompanionService.linkParent({
        parentId,
        companionId,
        role: "CO_PARENT",
      });

      expect(ParentCompanionModel.create).toHaveBeenCalledWith([
        expect.objectContaining({ status: "PENDING", role: "CO_PARENT" }),
      ]);
    });

    it("creates a link with explicitly provided status and overrides", async () => {
      (ParentCompanionModel.create as jest.Mock).mockResolvedValue([
        makeMockDoc(),
      ]);
      await ParentCompanionService.linkParent({
        parentId,
        companionId,
        status: "REVOKED",
        permissionsOverride: { tasks: true },
      });

      expect(ParentCompanionModel.create).toHaveBeenCalledWith([
        expect.objectContaining({
          status: "REVOKED",
          permissions: expect.objectContaining({ tasks: true }),
        }),
      ]);
    });

    it("throws 409 if duplicate key error for PRIMARY role", async () => {
      (ParentCompanionModel.create as jest.Mock).mockRejectedValue({
        code: 11000,
      });
      await expect(
        ParentCompanionService.linkParent({
          parentId,
          companionId,
          role: "PRIMARY",
        })
      ).rejects.toMatchObject({
        statusCode: 409,
        message: /already has an active primary/,
      });
    });

    it("throws 409 if duplicate key error for CO_PARENT role", async () => {
      (ParentCompanionModel.create as jest.Mock).mockRejectedValue({
        code: 11000,
      });
      await expect(
        ParentCompanionService.linkParent({
          parentId,
          companionId,
          role: "CO_PARENT",
        })
      ).rejects.toMatchObject({ statusCode: 409, message: /already linked/ });
    });

    it("rethrows generic errors (and tests isDuplicateKey checks)", async () => {
      (ParentCompanionModel.create as jest.Mock).mockRejectedValue(null);
      await expect(
        ParentCompanionService.linkParent({ parentId, companionId })
      ).rejects.toBeNull();

      (ParentCompanionModel.create as jest.Mock).mockRejectedValue(
        "string err"
      );
      await expect(
        ParentCompanionService.linkParent({ parentId, companionId })
      ).rejects.toBe("string err");

      (ParentCompanionModel.create as jest.Mock).mockRejectedValue({
        status: 500,
      });
      await expect(
        ParentCompanionService.linkParent({ parentId, companionId })
      ).rejects.toEqual({ status: 500 });

      (ParentCompanionModel.create as jest.Mock).mockRejectedValue({
        code: 400,
      });
      await expect(
        ParentCompanionService.linkParent({ parentId, companionId })
      ).rejects.toEqual({ code: 400 });
    });
  });

  describe("activateLink", () => {
    it("updates link to ACTIVE", async () => {
      const mockDoc = makeMockDoc();
      (ParentCompanionModel.findOneAndUpdate as jest.Mock).mockReturnValue(
        createMockQuery(mockDoc)
      );

      const result = await ParentCompanionService.activateLink(
        new Types.ObjectId(),
        new Types.ObjectId()
      );
      expect(result).toBe(mockDoc);
    });
  });

  describe("revokeLink", () => {
    it("throws 404 if link not found", async () => {
      (ParentCompanionModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(
        null
      );
      await expect(
        ParentCompanionService.revokeLink(new Types.ObjectId())
      ).rejects.toThrow(ParentCompanionServiceError);
    });

    it("revokes link successfully", async () => {
      const mockDoc = makeMockDoc();
      (ParentCompanionModel.findByIdAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc
      );
      const result = await ParentCompanionService.revokeLink(
        new Types.ObjectId()
      );
      expect(result).toBe(mockDoc);
    });
  });

  describe("updatePermissions", () => {
    const requestingParentId = new Types.ObjectId();
    const targetParentId = new Types.ObjectId();
    const companionId = new Types.ObjectId();
    const primaryLink = makeMockDoc({ role: "PRIMARY", status: "ACTIVE" });

    it("throws 404 if target link not found", async () => {
      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink)) // ownership check
        .mockReturnValueOnce(createMockQuery(null)); // target check

      await expect(
        ParentCompanionService.updatePermissions(
          requestingParentId,
          targetParentId,
          companionId,
          {}
        )
      ).rejects.toThrow(/Link not found/);
    });

    it("throws 400 if removing primary without transfer", async () => {
      const targetDoc = makeMockDoc({ role: "PRIMARY", status: "ACTIVE" });
      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc));

      await expect(
        ParentCompanionService.updatePermissions(
          requestingParentId,
          targetParentId,
          companionId,
          { assignAsPrimaryParent: false }
        )
      ).rejects.toThrow(/Cannot remove primary/);
    });

    it("updates permissions normally (not primary)", async () => {
      const targetDoc = makeMockDoc({ role: "CO_PARENT" });
      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc));

      const result = await ParentCompanionService.updatePermissions(
        requestingParentId,
        targetParentId,
        companionId,
        { tasks: true }
      );

      expect(targetDoc.permissions.tasks).toBe(true);
      expect(targetDoc.save).toHaveBeenCalled();
      expect(result).toHaveProperty("mapped", true);
    });

    it("updates permissions normally for primary (keeps flag true)", async () => {
      const targetDoc = makeMockDoc({ role: "PRIMARY", status: "ACTIVE" });
      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc));

      await ParentCompanionService.updatePermissions(
        requestingParentId,
        targetParentId,
        companionId,
        { tasks: true, assignAsPrimaryParent: true }
      );

      expect(targetDoc.permissions.assignAsPrimaryParent).toBe(true);
      expect(targetDoc.save).toHaveBeenCalled();
    });

    it("promotes co-parent to primary", async () => {
      const targetDoc = makeMockDoc({ role: "CO_PARENT" });
      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc))
        .mockReturnValueOnce(createMockQuery(null));

      await ParentCompanionService.updatePermissions(
        requestingParentId,
        targetParentId,
        companionId,
        { assignAsPrimaryParent: true }
      );

      expect(targetDoc.role).toBe("PRIMARY");
      expect(targetDoc.save).toHaveBeenCalled();
    });
  });

  describe("promoteToPrimary (Internal helper paths)", () => {
    const requestingParentId = new Types.ObjectId();
    const targetParentId = new Types.ObjectId();
    const companionId = new Types.ObjectId();
    const primaryLink = makeMockDoc({ role: "PRIMARY", status: "ACTIVE" });

    it("throws 404 if co-parent link to promote is not found", async () => {
      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(null));

      await expect(
        ParentCompanionService.promoteToPrimary(
          requestingParentId,
          companionId,
          targetParentId
        )
      ).rejects.toThrow(/Co-parent link not found/);
    });

    it("demotes existing primary and promotes target", async () => {
      const targetDoc = makeMockDoc({ role: "CO_PARENT" });
      const existingPrimary = makeMockDoc({
        role: "PRIMARY",
        status: "ACTIVE",
      });

      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc))
        .mockReturnValueOnce(createMockQuery(existingPrimary));

      await ParentCompanionService.promoteToPrimary(
        requestingParentId,
        companionId,
        targetParentId
      );

      expect(existingPrimary.role).toBe("CO_PARENT");
      expect(existingPrimary.save).toHaveBeenCalled();
      expect(targetDoc.role).toBe("PRIMARY");
      expect(targetDoc.acceptedAt).toBeDefined();
      expect(targetDoc.save).toHaveBeenCalled();
    });

    it("throws 409 race condition if duplicate key occurs", async () => {
      const targetDoc = makeMockDoc({ role: "CO_PARENT" });
      targetDoc.save.mockRejectedValueOnce({ code: 11000 });

      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc))
        .mockReturnValueOnce(createMockQuery(null));

      await expect(
        ParentCompanionService.promoteToPrimary(
          requestingParentId,
          companionId,
          targetParentId
        )
      ).rejects.toMatchObject({ statusCode: 409 });
    });

    it("rethrows generic error if save fails", async () => {
      const targetDoc = makeMockDoc({ role: "CO_PARENT" });
      targetDoc.save.mockRejectedValueOnce(new Error("DB Crash"));

      (ParentCompanionModel.findOne as jest.Mock)
        .mockReturnValueOnce(createMockQuery(primaryLink))
        .mockReturnValueOnce(createMockQuery(targetDoc))
        .mockReturnValueOnce(createMockQuery(null));

      await expect(
        ParentCompanionService.promoteToPrimary(
          requestingParentId,
          companionId,
          targetParentId
        )
      ).rejects.toThrow("DB Crash");
    });
  });

  describe("removeCoParent", () => {
    const reqParentId = new Types.ObjectId();
    const coParentId = new Types.ObjectId();
    const compId = new Types.ObjectId();
    const primaryLink = makeMockDoc({ role: "PRIMARY", status: "ACTIVE" });

    it("soft deletes and throws 404 if not found", async () => {
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValueOnce(
        createMockQuery(primaryLink)
      );
      (ParentCompanionModel.findOneAndUpdate as jest.Mock).mockReturnValue(
        createMockQuery(null)
      );

      await expect(
        ParentCompanionService.removeCoParent(
          reqParentId,
          coParentId,
          compId,
          true
        )
      ).rejects.toThrow(/Co-parent link not found/);
    });

    it("soft deletes successfully", async () => {
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValueOnce(
        createMockQuery(primaryLink)
      );
      (ParentCompanionModel.findOneAndUpdate as jest.Mock).mockReturnValue(
        createMockQuery(makeMockDoc())
      );

      await ParentCompanionService.removeCoParent(
        reqParentId,
        coParentId,
        compId,
        true
      );
      expect(ParentCompanionModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it("hard deletes and throws 404 if none deleted", async () => {
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValueOnce(
        createMockQuery(primaryLink)
      );
      (ParentCompanionModel.deleteOne as jest.Mock).mockResolvedValue({
        deletedCount: 0,
      });

      await expect(
        ParentCompanionService.removeCoParent(
          reqParentId,
          coParentId,
          compId,
          false
        )
      ).rejects.toThrow(/Co-parent link not found/);
    });

    it("hard deletes successfully", async () => {
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValueOnce(
        createMockQuery(primaryLink)
      );
      (ParentCompanionModel.deleteOne as jest.Mock).mockResolvedValue({
        deletedCount: 1,
      });

      await ParentCompanionService.removeCoParent(
        reqParentId,
        coParentId,
        compId,
        false
      );
      expect(ParentCompanionModel.deleteOne).toHaveBeenCalled();
    });
  });

  describe("Retrieve and Delete Helpers", () => {
    it("getLinksForCompanion maps results", async () => {
      (ParentCompanionModel.find as jest.Mock).mockReturnValue(
        createMockQuery([makeMockDoc()])
      );
      const res = await ParentCompanionService.getLinksForCompanion(
        new Types.ObjectId()
      );
      expect(res[0]).toHaveProperty("mapped", true);
    });

    it("getLinksForParent maps results", async () => {
      (ParentCompanionModel.find as jest.Mock).mockReturnValue(
        createMockQuery([makeMockDoc()])
      );
      const res = await ParentCompanionService.getLinksForParent(
        new Types.ObjectId()
      );
      expect(res[0]).toHaveProperty("mapped", true);
    });

    it("getActiveCompanionIdsForParent maps ids", async () => {
      const cId = new Types.ObjectId();
      (ParentCompanionModel.find as jest.Mock).mockReturnValue(
        createMockQuery([{ companionId: cId }])
      );
      const res = await ParentCompanionService.getActiveCompanionIdsForParent(
        new Types.ObjectId()
      );
      expect(res[0]).toBe(cId);
    });

    it("hasAnyLinks returns true if count > 0", async () => {
      (ParentCompanionModel.countDocuments as jest.Mock).mockResolvedValue(1);
      const res = await ParentCompanionService.hasAnyLinks(
        new Types.ObjectId()
      );
      expect(res).toBe(true);
    });

    it("hasAnyLinks returns false if count is 0", async () => {
      (ParentCompanionModel.countDocuments as jest.Mock).mockResolvedValue(0);
      const res = await ParentCompanionService.hasAnyLinks(
        new Types.ObjectId()
      );
      expect(res).toBe(false);
    });

    it("deleteLinksForCompanion returns deletedCount or 0", async () => {
      (ParentCompanionModel.deleteMany as jest.Mock).mockResolvedValue({
        deletedCount: 5,
      });
      let res = await ParentCompanionService.deleteLinksForCompanion(
        new Types.ObjectId()
      );
      expect(res).toBe(5);

      (ParentCompanionModel.deleteMany as jest.Mock).mockResolvedValue({});
      res = await ParentCompanionService.deleteLinksForCompanion(
        new Types.ObjectId()
      );
      expect(res).toBe(0);
    });

    it("deleteLinksForParent returns deletedCount or 0", async () => {
      (ParentCompanionModel.deleteMany as jest.Mock).mockResolvedValue({
        deletedCount: 2,
      });
      let res = await ParentCompanionService.deleteLinksForParent(
        new Types.ObjectId()
      );
      expect(res).toBe(2);

      (ParentCompanionModel.deleteMany as jest.Mock).mockResolvedValue({});
      res = await ParentCompanionService.deleteLinksForParent(
        new Types.ObjectId()
      );
      expect(res).toBe(0);
    });
  });

  describe("ensurePrimaryOwnership", () => {
    it("resolves if user is primary owner", async () => {
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue(
        createMockQuery(makeMockDoc())
      );
      await expect(
        ParentCompanionService.ensurePrimaryOwnership(
          new Types.ObjectId(),
          new Types.ObjectId()
        )
      ).resolves.toBeUndefined();
    });

    it("throws 403 if user is not primary owner", async () => {
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue(
        createMockQuery(null)
      );
      await expect(
        ParentCompanionService.ensurePrimaryOwnership(
          new Types.ObjectId(),
          new Types.ObjectId()
        )
      ).rejects.toThrow(/not authorized/);
    });
  });
});