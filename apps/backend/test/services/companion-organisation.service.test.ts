import { Types } from "mongoose";
import {
  CompanionOrganisationService,
  CompanionOrganisationServiceError,
} from "../../src/services/companion-organisation.service";
import CompanionOrganisationModel from "../../src/models/companion-organisation";
import ParentCompanionModel from "../../src/models/parent-companion";
import CompanionModel from "../../src/models/companion";
import { ParentModel } from "../../src/models/parent";
import { AuditTrailService } from "../../src/services/audit-trail.service";

// --- Global Mocks Setup (TDZ Safe) ---
jest.mock("node:crypto", () => ({
  randomUUID: jest.fn(() => "mock-uuid-1234"),
}));

jest.mock("../../src/utils/sanitize", () => ({
  assertSafeString: jest.fn((val) => val), // Identity mock
}));

jest.mock("../../src/services/companion.service", () => ({
  toFHIR: jest.fn((c) => ({ id: c._id.toString(), resourceType: "Patient" })),
}));

jest.mock("../../src/services/parent.service", () => ({
  toFHIR: jest.fn((p) => ({
    id: p._id.toString(),
    resourceType: "RelatedPerson",
  })),
}));

jest.mock("../../src/services/audit-trail.service", () => ({
  AuditTrailService: {
    recordSafely: jest.fn(),
  },
}));

jest.mock("../../src/models/companion-organisation", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findByIdAndDelete: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/parent-companion", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/companion", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/parent", () => ({
  __esModule: true,
  ParentModel: {
    findById: jest.fn(),
  },
}));

// Mock Query Chain for Mongoose methods like .populate().exec()
const createQueryChain = (resolvedValue: any) => {
  const p = Promise.resolve(resolvedValue);
  (p as any).populate = jest.fn().mockReturnValue(p);
  (p as any).exec = jest.fn().mockResolvedValue(resolvedValue);
  return p;
};

// Helper for generating Mongoose-like documents
const createMockDoc = (overrides = {}) => {
  const baseId = new Types.ObjectId();
  const data = {
    _id: baseId,
    companionId: new Types.ObjectId(),
    organisationId: new Types.ObjectId(),
    status: "PENDING",
    organisationType: "HOSPITAL",
    inviteToken: "some-token" as string | null,
    acceptedAt: null as Date | null,
    rejectedAt: null as Date | null,
    ...overrides,
  };
  return {
    ...data,
    save: jest.fn().mockResolvedValue(true),
  };
};

describe("CompanionOrganisationService", () => {
  const validIdStr = new Types.ObjectId().toHexString();
  const validObjId = new Types.ObjectId();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("CompanionOrganisationServiceError & ensureObjectId", () => {
    it("should set error properties correctly", () => {
      const err = new CompanionOrganisationServiceError("Test message", 403);
      expect(err.message).toBe("Test message");
      expect(err.statusCode).toBe(403);
      expect(err.name).toBe("CompanionOrganisationServiceError");
    });

    // We can implicitly test `ensureObjectId` by passing bad params to `linkByParent`
    it("should throw if id is not a string (e.g. number)", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: 123 as any,
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid parentId", 400),
      );
    });

    it("should throw if string contains injection characters ($ or .)", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "invalid$id",
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid parentId", 400),
      );

      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "invalid.id",
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid parentId", 400),
      );
    });

    it("should throw if string length is not exactly 24 hex characters", async () => {
      await expect(
        CompanionOrganisationService.linkByParent({
          parentId: "abc123",
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid parentId", 400),
      );
    });

    it("should accept a valid Types.ObjectId instance directly", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(true); // Return existing immediately
      await CompanionOrganisationService.linkByParent({
        parentId: validObjId,
        companionId: validObjId,
        organisationId: validObjId,
        organisationType: "HOSPITAL",
      });
      expect(CompanionOrganisationModel.findOne).toHaveBeenCalled();
    });
  });

  describe("linkByParent", () => {
    it("should return early if an active/pending link already exists", async () => {
      const mockExisting = { _id: validObjId, status: "ACTIVE" };
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        mockExisting,
      );

      const res = await CompanionOrganisationService.linkByParent({
        parentId: validIdStr,
        companionId: validIdStr,
        organisationId: validIdStr,
        organisationType: "HOSPITAL",
      });
      expect(res).toEqual(mockExisting);
      expect(CompanionOrganisationModel.create).not.toHaveBeenCalled();
    });

    it("should create link and record audit safely", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      const mockCreated = createMockDoc({ status: "ACTIVE" });
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue(
        mockCreated,
      );

      const res = await CompanionOrganisationService.linkByParent({
        parentId: validIdStr,
        companionId: validIdStr,
        organisationId: validIdStr,
        organisationType: "HOSPITAL",
      });

      expect(CompanionOrganisationModel.create).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_LINK_CREATED" }),
      );
      expect(res._id).toBeDefined();
    });
  });

  describe("linkByPmsUser & linkOnCompanionCreatedByPms", () => {
    it("should return early if existing link found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: validObjId,
      });
      const res = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "u1",
        companionId: validIdStr,
        organisationId: validIdStr,
        organisationType: "HOSPITAL",
      });
      expect(res._id).toBeDefined();
    });

    it("should create link and record audit", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue(
        createMockDoc({ status: "PENDING" }),
      );

      const res = await CompanionOrganisationService.linkByPmsUser({
        pmsUserId: "u1",
        companionId: validIdStr,
        organisationId: validIdStr,
        organisationType: "HOSPITAL",
      });

      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_LINK_REQUESTED" }),
      );
      expect(res.status).toBe("PENDING");
    });

    it("linkOnCompanionCreatedByPms maps directly to linkByPmsUser", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: validObjId,
      });
      const res =
        await CompanionOrganisationService.linkOnCompanionCreatedByPms({
          pmsUserId: "u1",
          companionId: validIdStr,
          organisationId: validIdStr,
          organisationType: "HOSPITAL",
        });
      expect(res._id).toBeDefined();
    });
  });

  describe("linkOnAppointmentBooked", () => {
    it("should return early if existing link found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: validObjId,
      });
      const res = await CompanionOrganisationService.linkOnAppointmentBooked({
        companionId: validIdStr,
        organisationId: validIdStr,
        organisationType: "HOSPITAL",
      });
      expect(res._id).toBeDefined();
    });

    it("should create link and record audit", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue(
        createMockDoc({ status: "ACTIVE" }),
      );

      const res = await CompanionOrganisationService.linkOnAppointmentBooked({
        companionId: validIdStr,
        organisationId: validIdStr,
        organisationType: "HOSPITAL",
      });

      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_LINK_AUTO" }),
      );
      expect(res.status).toBe("ACTIVE");
    });
  });

  describe("sendInvite", () => {
    it("should throw 400 if both email and name are missing", async () => {
      await expect(
        CompanionOrganisationService.sendInvite({
          parentId: validIdStr,
          companionId: validIdStr,
          organisationType: "HOSPITAL",
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Email required or Name", 400),
      );
    });

    it("should successfully generate UUID and create PENDING invite", async () => {
      (CompanionOrganisationModel.create as jest.Mock).mockResolvedValue(
        createMockDoc(),
      );

      const res = await CompanionOrganisationService.sendInvite({
        parentId: validIdStr,
        companionId: validIdStr,
        organisationType: "HOSPITAL",
        email: "test@test.com",
      });
      expect(CompanionOrganisationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          inviteToken: "mock-uuid-1234",
          status: "PENDING",
        }),
      );
      expect(res).toBeDefined();
    });
  });

  describe("validateInvite", () => {
    it("should throw 400 if token is missing", async () => {
      await expect(
        CompanionOrganisationService.validateInvite(""),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invite token missing", 400),
      );
    });

    it("should throw 404 if invite is not found or not pending", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.validateInvite("tkn"),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid or expired invite", 404),
      );
    });

    it("should return the invite if valid", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue({
        _id: validObjId,
      });
      const res = await CompanionOrganisationService.validateInvite("tkn");
      expect(res._id).toBeDefined();
    });
  });

  describe("acceptInvite & rejectInvite", () => {
    it("acceptInvite: should throw 404 if invite invalid", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.acceptInvite({
          token: "tkn",
          organisationId: validIdStr,
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid invite token", 404),
      );
    });

    it("acceptInvite: should update, save, and audit on success", async () => {
      const mockDoc: any = createMockDoc({
        status: "PENDING",
        inviteToken: "tkn",
      });
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        mockDoc,
      );

      const res = await CompanionOrganisationService.acceptInvite({
        token: "tkn",
        organisationId: validIdStr,
      });
      expect(mockDoc.status).toBe("ACTIVE");
      expect(mockDoc.inviteToken).toBeNull();
      expect(mockDoc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_INVITE_ACCEPTED" }),
      );
      expect(res.status).toBe("ACTIVE");
    });

    it("rejectInvite: should throw 404 if invite invalid", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.rejectInvite({
          token: "tkn",
          organisationId: validIdStr,
        }),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Invalid invite token", 404),
      );
    });

    it("rejectInvite: should update, save, and audit on success", async () => {
      const mockDoc: any = createMockDoc({
        status: "PENDING",
        inviteToken: "tkn",
      });
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        mockDoc,
      );

      await CompanionOrganisationService.rejectInvite({
        token: "tkn",
        organisationId: validIdStr,
      });
      expect(mockDoc.status).toBe("REVOKED");
      expect(mockDoc.inviteToken).toBeNull();
      expect(mockDoc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_INVITE_REJECTED" }),
      );
    });
  });

  describe("revokeLink", () => {
    it("should throw 404 if link not found", async () => {
      (
        CompanionOrganisationModel.findByIdAndDelete as jest.Mock
      ).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.revokeLink(validIdStr),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Link not found", 404),
      );
    });

    it("should securely audit and handle missing organisationId fallback", async () => {
      // Testing fallback `organisationId?.toString() ?? ""`
      const mockDoc = createMockDoc({ organisationId: null });
      (
        CompanionOrganisationModel.findByIdAndDelete as jest.Mock
      ).mockResolvedValue(mockDoc);

      const res = await CompanionOrganisationService.revokeLink(validIdStr);
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: "", // Proves fallback worked without throwing undefined error
          eventType: "COMPANION_ORG_LINK_REVOKED",
        }),
      );
      expect(res._id).toBeDefined();
    });
  });

  describe("parentApproveLink & parentRejectLink", () => {
    it("parentApproveLink: should throw 404 if link not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      // Fixed: passed validIdStr instead of "tkn" which fails hex length validation internally
      await expect(
        CompanionOrganisationService.parentApproveLink(validObjId, validIdStr),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Pending link not found.", 404),
      );
    });

    it("parentApproveLink: should update, save, and audit", async () => {
      const mockDoc: any = createMockDoc();
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        mockDoc,
      );

      await CompanionOrganisationService.parentApproveLink(
        validObjId,
        validIdStr,
      );
      expect(mockDoc.status).toBe("ACTIVE");
      expect(mockDoc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_LINK_APPROVED" }),
      );
    });

    it("parentRejectLink: should throw 404 if link not found", async () => {
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(
        CompanionOrganisationService.parentRejectLink(validObjId, validIdStr),
      ).rejects.toThrow(
        new CompanionOrganisationServiceError("Pending link not found.", 404),
      );
    });

    it("parentRejectLink: should update, save, and audit", async () => {
      const mockDoc: any = createMockDoc();
      (CompanionOrganisationModel.findOne as jest.Mock).mockResolvedValue(
        mockDoc,
      );

      await CompanionOrganisationService.parentRejectLink(
        validObjId,
        validIdStr,
      );
      expect(mockDoc.status).toBe("REVOKED");
      expect(mockDoc.save).toHaveBeenCalled();
      expect(AuditTrailService.recordSafely).toHaveBeenCalledWith(
        expect.objectContaining({ eventType: "COMPANION_ORG_LINK_REJECTED" }),
      );
    });
  });

  describe("Fetching and Mapping Methods", () => {
    it("getLinksForCompanion should return raw array", async () => {
      (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
        createMockDoc(),
      ]);
      const res =
        await CompanionOrganisationService.getLinksForCompanion(validIdStr);
      expect(res).toHaveLength(1);
    });

    it("getLinksForCompanionByOrganisationTye should assemble populated response", async () => {
      (CompanionOrganisationModel.find as jest.Mock).mockReturnValue(
        createQueryChain([{ status: "ACTIVE" }]),
      );
      (ParentCompanionModel.findOne as jest.Mock).mockReturnValue(
        createQueryChain({ parentId: validIdStr }),
      );
      (CompanionModel.findById as jest.Mock).mockResolvedValue({
        name: "Fido",
      });
      (ParentModel.findById as jest.Mock).mockResolvedValue({
        firstName: "John",
        lastName: "Doe",
        email: "a@a.com",
        phoneNumber: "123",
      });

      const res =
        await CompanionOrganisationService.getLinksForCompanionByOrganisationTye(
          validIdStr,
          "HOSPITAL",
        );
      expect(res.links).toHaveLength(1);
      expect(res.parentName).toBe("John Doe");
      expect(res.email).toBe("a@a.com");
      expect(res.companionName).toBe("Fido");
      expect(res.phoneNumber).toBe("123");
    });

    describe("getLinksForOrganisation", () => {
      it("should return empty if no links exist", async () => {
        (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([]);
        expect(
          await CompanionOrganisationService.getLinksForOrganisation(
            validIdStr,
          ),
        ).toEqual([]);
      });

      it("should filter out links if the companion is orphaned (missing from CompanionModel)", async () => {
        const link = createMockDoc();
        (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
          link,
        ]);
        (CompanionModel.findById as jest.Mock).mockResolvedValue(null); // Triggers filter(Boolean)

        const res =
          await CompanionOrganisationService.getLinksForOrganisation(
            validIdStr,
          );
        expect(res).toHaveLength(0); // Nulls removed
      });

      it("should map companion and handle missing parent link gracefully", async () => {
        const link = createMockDoc();
        (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
          link,
        ]);
        (CompanionModel.findById as jest.Mock).mockResolvedValue({
          _id: validObjId,
        });
        (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue(null); // No parent

        const res =
          await CompanionOrganisationService.getLinksForOrganisation(
            validIdStr,
          );
        expect(res).toHaveLength(1);
        expect(res[0]?.parent).toBeNull();
        expect(res[0]?.companion?.resourceType).toBe("Patient");
      });

      it("should map both companion and parent successfully", async () => {
        const link = createMockDoc();
        (CompanionOrganisationModel.find as jest.Mock).mockResolvedValue([
          link,
        ]);
        (CompanionModel.findById as jest.Mock).mockResolvedValue({
          _id: validObjId,
        });
        (ParentCompanionModel.findOne as jest.Mock).mockResolvedValue({
          parentId: validObjId,
        });
        (ParentModel.findById as jest.Mock).mockResolvedValue({
          _id: validObjId,
        });

        const res =
          await CompanionOrganisationService.getLinksForOrganisation(
            validIdStr,
          );
        expect(res).toHaveLength(1);
        expect(res[0]?.parent?.resourceType).toBe("RelatedPerson");
      });
    });
  });
});
