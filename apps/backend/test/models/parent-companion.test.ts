import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { Types, Error as MongooseError } from "mongoose";
import ParentCompanionModel, {
  toCompanionParentLink,
  ParentCompanionDocument,
  ParentCompanionMongo,
} from "../../src/models/parent-companion";

describe("ParentCompanion Model & Helpers", () => {
  // ======================================================================
  // 1. Helper Function: toCompanionParentLink
  // ======================================================================
  describe("toCompanionParentLink", () => {
    const mockDate = new Date();
    const mockId = new Types.ObjectId();
    const mockParentId = new Types.ObjectId();
    const mockCompanionId = new Types.ObjectId();

    it("should transform a document with a plain ObjectId parentId", () => {
      const mockDoc = {
        toObject: jest.fn().mockReturnValue({
          _id: mockId,
          // Pass as string to ensure isPopulatedParent returns false
          parentId: mockParentId.toString(),
          companionId: mockCompanionId,
          role: "PRIMARY",
          status: "ACTIVE",
          permissions: { tasks: true },
          createdAt: mockDate,
          updatedAt: mockDate,
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);

      expect(result).toEqual({
        parentId: mockParentId.toString(),
        role: "PRIMARY",
        status: "ACTIVE",
        permissions: { tasks: true },
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString(),
        parent: undefined,
        invitedByParentId: undefined,
        acceptedAt: undefined,
      });
    });

    it("should transform a document with a POPULATED parentId", () => {
      const populatedParent = {
        _id: mockParentId,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
        phoneNumber: "1234567890",
        profileImageUrl: "http://img.url",
      };

      const mockDoc = {
        toObject: jest.fn().mockReturnValue({
          _id: mockId,
          parentId: populatedParent, // populated object
          companionId: mockCompanionId,
          role: "CO_PARENT",
          status: "PENDING",
          permissions: { tasks: false },
          createdAt: mockDate,
          updatedAt: mockDate,
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);

      expect(result).toEqual({
        parentId: mockParentId.toString(),
        role: "CO_PARENT",
        status: "PENDING",
        permissions: { tasks: false },
        createdAt: mockDate.toISOString(),
        updatedAt: mockDate.toISOString(),
        invitedByParentId: undefined,
        acceptedAt: undefined,
        // Expect populated fields
        parent: {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phoneNumber: "1234567890",
          profileImageUrl: "http://img.url",
        },
      });
    });

    it("should throw an error if parentId is missing", () => {
      const mockDoc = {
        toObject: jest.fn().mockReturnValue({
          _id: mockId,
          // parentId missing
          companionId: mockCompanionId,
          role: "PRIMARY",
          status: "ACTIVE",
          permissions: {},
        }),
      } as unknown as ParentCompanionDocument;

      expect(() => toCompanionParentLink(mockDoc)).toThrow(
        "Parent companion missing parentId",
      );
    });

    it("should handle optional timestamp fields being undefined", () => {
      const mockDoc = {
        toObject: jest.fn().mockReturnValue({
          _id: mockId,
          parentId: mockParentId.toString(), // plain ID as string
          companionId: mockCompanionId,
          role: "PRIMARY",
          status: "ACTIVE",
          permissions: {},
          // dates missing
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);
      expect(result.createdAt).toBeUndefined();
      expect(result.updatedAt).toBeUndefined();
      expect(result.acceptedAt).toBeUndefined();
    });

    it("should handle invitedByParentId conversion", () => {
      const inviteId = new Types.ObjectId();
      const mockDoc = {
        toObject: jest.fn().mockReturnValue({
          _id: mockId,
          parentId: mockParentId.toString(), // plain ID as string
          companionId: mockCompanionId,
          role: "PRIMARY",
          status: "ACTIVE",
          permissions: {},
          invitedByParentId: inviteId,
        }),
      } as unknown as ParentCompanionDocument;

      const result = toCompanionParentLink(mockDoc);
      expect(result.invitedByParentId).toBe(inviteId.toString());
    });
  });

  // ======================================================================
  // 2. Schema Validation (Validation Logic)
  // ======================================================================
  describe("Schema Validation", () => {
    it("should validate a correct payload", () => {
      const doc = new ParentCompanionModel({
        parentId: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        role: "PRIMARY",
        status: "ACTIVE",
        permissions: {
          assignAsPrimaryParent: true,
        },
      });

      const err = doc.validateSync();
      expect(err).toBeUndefined();
      expect(doc.status).toBe("ACTIVE"); // Default check
      expect(doc.permissions.appointments).toBe(false); // Default permission check
    });

    it("should require parentId and companionId", () => {
      const doc = new ParentCompanionModel({
        role: "PRIMARY",
        status: "ACTIVE",
        permissions: {},
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["parentId"]).toBeDefined();
      expect(err?.errors["companionId"]).toBeDefined();
    });

    it("should validate enum values for role and status", () => {
      const doc = new ParentCompanionModel({
        parentId: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        role: "INVALID_ROLE",
        status: "INVALID_STATUS",
        permissions: {},
      });

      const err = doc.validateSync();
      expect(err).toBeDefined();
      expect(err?.errors["role"]).toBeDefined();
      expect(err?.errors["status"]).toBeDefined();
    });

    it("should require permissions object", () => {
      const doc = new ParentCompanionModel({
        parentId: new Types.ObjectId(),
        companionId: new Types.ObjectId(),
        role: "PRIMARY",
        status: "ACTIVE",
        // permissions missing
      });
      const err = doc.validateSync();
      expect(err?.errors["permissions"]).toBeDefined();
    });
  });
});
