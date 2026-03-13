import { Types } from "mongoose";
import {
  UserOrganizationService,
  UserOrganizationServiceError,
} from "../../src/services/user-organization.service";
import UserOrganizationModel from "../../src/models/user-organization";
import OrganizationModel from "../../src/models/organization";
import UserProfileModel from "../../src/models/user-profile";
import SpecialityModel from "../../src/models/speciality";
import UserModel from "../../src/models/user";
import { OccupancyModel } from "../../src/models/occupancy";
import { OrgBilling } from "../../src/models/organization.billing";
import { OrgUsageCounters } from "../../src/models/organisation.usage.counter";
import { AvailabilityService } from "../../src/services/availability.service";
import { StripeService } from "../../src/services/stripe.service";
import * as OrgUsageNotifications from "../../src/utils/org-usage-notifications";
import * as EmailUtils from "../../src/utils/email";
import logger from "../../src/utils/logger";

// --- Mocks ---
jest.mock("../../src/models/user-organization");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/user-profile");
jest.mock("../../src/models/speciality");
jest.mock("../../src/models/user");
jest.mock("../../src/models/occupancy");
jest.mock("../../src/models/organization.billing");
jest.mock("../../src/models/organisation.usage.counter");
jest.mock("../../src/services/availability.service");
jest.mock("../../src/services/stripe.service");
jest.mock("../../src/utils/org-usage-notifications");
jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

// Mock Types helpers
jest.mock("@yosemite-crew/types", () => ({
  fromUserOrganizationRequestDTO: jest.fn((dto) => dto),
  toUserOrganizationResponseDTO: jest.fn((domain) => domain),
}));

// --- Helper: Mongoose Chain Mock ---
const mockChain = (result: any = null) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    sort: jest.fn().mockReturnThis(),
    setOptions: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain as any;
};

// --- Helper: Mock Mongoose Document ---
const mockDoc = (data: any) => ({
  ...data,
  toObject: jest.fn(() => data),
});

describe("UserOrganizationService", () => {
  let mockOrgId: Types.ObjectId;
  let mockUserId: Types.ObjectId;
  let mockMappingId: Types.ObjectId;
  let validPayload: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgId = new Types.ObjectId();
    mockUserId = new Types.ObjectId();
    mockMappingId = new Types.ObjectId();

    validPayload = {
      resourceType: "PractitionerRole",
      id: mockMappingId.toHexString(),
      practitionerReference: `Practitioner/${mockUserId.toHexString()}`,
      organizationReference: `Organization/${mockOrgId.toHexString()}`,
      roleCode: "VETERINARIAN",
      active: true,
    };

    // Default Mongoose Mocks
    (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
      mockChain(null),
    );
    (UserOrganizationModel.find as jest.Mock).mockReturnValue(mockChain([]));
    // Important: Default create mock to return a valid doc to prevent crashes in complex flows
    (UserOrganizationModel.create as jest.Mock).mockResolvedValue(
      mockDoc({ ...validPayload, _id: mockMappingId }),
    );

    (OrganizationModel.findOne as jest.Mock).mockReturnValue(
      mockChain({ _id: mockOrgId, name: "Test Org" }),
    );
    (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockReturnValue(
      mockChain({ _id: "counter-1" }),
    );
    (OrgBilling.findOne as jest.Mock).mockReturnValue(
      mockChain({ plan: "pro" }),
    );
  });

  describe("Validation & Internals", () => {
    it("should throw error for invalid FHIR resource type", async () => {
      await expect(
        UserOrganizationService.upsert({ resourceType: "Patient" } as any),
      ).rejects.toThrow("Invalid payload. Expected FHIR PractitionerRole");
    });

    it("should throw error for invalid Role Code", async () => {
      const invalidPayload = { ...validPayload, roleCode: "INVALID_ROLE" };
      await expect(
        UserOrganizationService.create(invalidPayload),
      ).rejects.toThrow('Invalid roleCode "INVALID_ROLE"');
    });

    it("should handle Date objects in pruning", async () => {
      const payloadWithDate = {
        ...validPayload,
        period: { start: new Date() },
      };
      (UserOrganizationModel.create as jest.Mock).mockResolvedValue(
        mockDoc({ ...payloadWithDate, _id: mockMappingId }),
      );

      const result = await UserOrganizationService.create(payloadWithDate);
      expect(result).toBeDefined();
    });
  });

  describe("upsert", () => {
    it("should create new mapping and reserve slot if active", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );

      const res = await UserOrganizationService.upsert(validPayload);

      expect(OrgUsageCounters.findOneAndUpdate).toHaveBeenCalledWith(
        { orgId: mockOrgId },
        { $inc: { usersActiveCount: 1 } },
        { new: true },
      );
      expect(res.created).toBe(true);
    });

    it("should rollback slot reservation if creation fails", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );
      (UserOrganizationModel.create as jest.Mock).mockRejectedValue(
        new Error("DB Error"),
      );

      await expect(
        UserOrganizationService.upsert(validPayload),
      ).rejects.toThrow("DB Error");

      expect(OrgUsageCounters.updateOne).toHaveBeenCalledWith(
        { orgId: mockOrgId },
        { $inc: { usersActiveCount: -1 } },
      );
    });

    it("should update existing mapping: Active -> Inactive (Release Slot)", async () => {
      const existing = { ...validPayload, active: true, _id: mockMappingId };
      const updatePayload = { ...validPayload, active: false };

      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc(existing)),
      );
      (UserOrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...updatePayload, _id: mockMappingId }),
      );

      await UserOrganizationService.upsert(updatePayload);

      expect(OrgUsageCounters.updateOne).toHaveBeenCalledWith(
        { orgId: mockOrgId },
        { $inc: { usersActiveCount: -1 } },
      );
    });

    it("should update existing mapping: Inactive -> Active (Reserve Slot)", async () => {
      const existing = { ...validPayload, active: false, _id: mockMappingId };
      const updatePayload = { ...validPayload, active: true };

      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc(existing)),
      );
      (UserOrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...updatePayload, _id: mockMappingId }),
      );

      await UserOrganizationService.upsert(updatePayload);

      expect(OrgUsageCounters.findOneAndUpdate).toHaveBeenCalled();
    });

    it("should sync seats if business plan and slot count changed", async () => {
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        mockChain({ plan: "business" }),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );

      await UserOrganizationService.upsert(validPayload);

      expect(StripeService.syncSubscriptionSeats).toHaveBeenCalled();
    });

    it("should throw error if findOneAndUpdate returns null during upsert", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc({ ...validPayload, _id: mockMappingId })),
      );
      (UserOrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        UserOrganizationService.upsert(validPayload),
      ).rejects.toThrow("Unable to persist user-organization mapping.");
    });
  });

  describe("create", () => {
    it("should fail creation and rollback if error occurs", async () => {
      (UserOrganizationModel.create as jest.Mock).mockRejectedValue(
        new Error("Fail"),
      );

      await expect(
        UserOrganizationService.create(validPayload),
      ).rejects.toThrow("Fail");

      expect(OrgUsageCounters.updateOne).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should find by ObjectId", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc({ ...validPayload, _id: mockMappingId })),
      );

      const res = await UserOrganizationService.getById(
        mockMappingId.toHexString(),
      );
      expect(res).not.toBeNull();
    });

    it("should find by reference lookup (Practitioner/ID)", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );

      (UserOrganizationModel.find as jest.Mock).mockReturnValue(
        mockChain([mockDoc({ ...validPayload, _id: mockMappingId })]),
      );

      const res = await UserOrganizationService.getById(
        mockUserId.toHexString(),
      );
      expect(res).toBeDefined();
    });

    it("should handle multiple results for reference lookup", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );
      (UserOrganizationModel.find as jest.Mock).mockReturnValue(
        mockChain([
          mockDoc({ ...validPayload, _id: new Types.ObjectId() }),
          mockDoc({ ...validPayload, _id: new Types.ObjectId() }),
        ]),
      );

      const res = await UserOrganizationService.getById(
        mockUserId.toHexString(),
      );
      expect(Array.isArray(res)).toBe(true);
      expect(res).toHaveLength(2);
    });

    it("should return null if not found anywhere", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );
      (UserOrganizationModel.find as jest.Mock).mockReturnValue(mockChain([]));

      const res = await UserOrganizationService.getById(
        mockUserId.toHexString(),
      );
      expect(res).toBeNull();
    });
  });

  describe("listAll & deleteById", () => {
    it("listAll should return all mappings", async () => {
      (UserOrganizationModel.find as jest.Mock).mockResolvedValue([
        mockDoc({ ...validPayload, _id: mockMappingId }),
      ]);
      const res = await UserOrganizationService.listAll();
      expect(res).toHaveLength(1);
    });

    it("deleteById should release slot if active", async () => {
      (UserOrganizationModel.findOneAndDelete as jest.Mock).mockResolvedValue({
        active: true,
        organizationReference: validPayload.organizationReference,
      });

      await UserOrganizationService.deleteById(mockMappingId.toHexString());
      expect(OrgUsageCounters.updateOne).toHaveBeenCalled();
    });

    it("deleteById should not release slot if inactive", async () => {
      (UserOrganizationModel.findOneAndDelete as jest.Mock).mockResolvedValue({
        active: false,
        organizationReference: validPayload.organizationReference,
      });

      await UserOrganizationService.deleteById(mockMappingId.toHexString());
      expect(OrgUsageCounters.updateOne).not.toHaveBeenCalled();
    });
  });

  describe("update", () => {
    it("should return null if mapping not found", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );
      const res = await UserOrganizationService.update(
        mockMappingId.toHexString(),
        validPayload,
      );
      expect(res).toBeNull();
    });

    it("should send email if permissions changed", async () => {
      const existing = {
        ...validPayload,
        roleCode: "RECEPTIONIST",
        _id: mockMappingId,
        organizationReference: `Organization/${mockOrgId.toHexString()}`,
        practitionerReference: `Practitioner/${mockUserId.toHexString()}`,
      };
      const updated = {
        ...validPayload,
        roleCode: "VETERINARIAN",
        _id: mockMappingId,
        organizationReference: `Organization/${mockOrgId.toHexString()}`,
        practitionerReference: `Practitioner/${mockUserId.toHexString()}`,
      };

      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc(existing)),
      );
      (UserOrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc(updated),
      );

      (UserModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ email: "test@test.com", firstName: "Test" }),
      );
      (OrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ name: "Test Org" }),
      );

      await UserOrganizationService.update(
        mockMappingId.toHexString(),
        validPayload,
      );

      await new Promise((resolve) => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "permissionsUpdated" }),
      );
    });

    it("should handle error in email sending (logger error)", async () => {
      const existing = { ...validPayload, roleCode: "RECEPTIONIST" };
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc(existing)),
      );
      (UserOrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, roleCode: "VETERINARIAN" }),
      );

      (UserModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error("Email Fail")),
      });

      await UserOrganizationService.update(
        mockMappingId.toHexString(),
        validPayload,
      );

      await new Promise((resolve) => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe("Aggregated Lists (UserId / OrgId)", () => {
    it("listByUserId: returns details with billing if permitted", async () => {
      const mappingWithPerms = {
        ...validPayload,
        effectivePermissions: ["billing:view:any"],
      };

      (UserOrganizationModel.find as jest.Mock).mockResolvedValue([
        mockDoc(mappingWithPerms),
      ]);
      (OrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ _id: mockOrgId }),
      );

      const res = await UserOrganizationService.listByUserId(
        mockUserId.toHexString(),
      );
      expect(res[0].orgBilling).toBeDefined();
    });

    it("listByUserId: hides billing if not permitted", async () => {
      const mappingNoPerms = {
        ...validPayload,
        effectivePermissions: [],
        // Explicitly revoke billing to ensure permissions logic works
        revokedPermissions: [
          "billing:view:any",
          "billing:edit:any",
          "billing:edit:limited",
        ],
      };
      (UserOrganizationModel.find as jest.Mock).mockResolvedValue([
        mockDoc(mappingNoPerms),
      ]);
      (OrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain({ _id: mockOrgId }),
      );

      const res = await UserOrganizationService.listByUserId(
        mockUserId.toHexString(),
      );
      expect(res[0].orgBilling).toBeNull();
    });

    it("listByOrganisationId: aggregates user details", async () => {
      (UserOrganizationModel.find as jest.Mock).mockResolvedValue([
        mockDoc({
          ...validPayload,
          practitionerReference: mockUserId.toHexString(),
        }),
      ]);
      (UserModel.findOne as jest.Mock).mockResolvedValue({
        firstName: "John",
        lastName: "Doe",
      });
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue({
        personalDetails: { profilePictureUrl: "http" },
      });
      (AvailabilityService.getCurrentStatus as jest.Mock).mockResolvedValue(
        "AVAILABLE",
      );
      (OccupancyModel.countDocuments as jest.Mock).mockResolvedValue(5);

      const res = await UserOrganizationService.listByOrganisationId(
        mockOrgId.toHexString(),
      );

      expect(res[0].name).toBe("John Doe");
      expect(res[0].currentStatus).toBe("AVAILABLE");
      expect(res[0].count).toBe(5);
    });
  });

  describe("Slot Management & Billing", () => {
    it("should handle Free Plan limit reached", async () => {
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        mockChain({ plan: "free" }),
      );
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue(null);

      await expect(
        UserOrganizationService.create(validPayload),
      ).rejects.toThrow("Free plan member limit reached");
    });

    it("should send email when free limit is just reached", async () => {
      (OrgBilling.findOne as jest.Mock).mockReturnValue(
        mockChain({ plan: "free" }),
      );

      const usageDoc = {
        _id: "u1",
        usersActiveCount: 5,
        freeUsersLimit: 5,
        appointmentsUsed: 0,
        freeAppointmentsLimit: 10,
        toolsUsed: 0,
        freeToolsLimit: 10,
        freeLimitReachedAt: null,
      };
      (OrgUsageCounters.findOneAndUpdate as jest.Mock).mockResolvedValue(
        usageDoc,
      );
      (OrgUsageCounters.updateOne as jest.Mock).mockResolvedValue({
        modifiedCount: 1,
      });

      await UserOrganizationService.create(validPayload);

      expect(
        OrgUsageNotifications.sendFreePlanLimitReachedEmail,
      ).toHaveBeenCalled();
    });
  });

  describe("Helpers coverage (Implicit)", () => {
    it("should delete all by org id", async () => {
      const exec = jest.fn();
      (UserOrganizationModel.deleteMany as jest.Mock).mockReturnValue({ exec });
      await UserOrganizationService.deleteAllByOrganizationId("org-1");
      expect(exec).toHaveBeenCalled();
    });

    it("should throw error in createUserOrganizationMapping if no doc returned", async () => {
      (UserOrganizationModel.create as jest.Mock).mockResolvedValue(null);
      await expect(
        UserOrganizationService.createUserOrganizationMapping(validPayload),
      ).rejects.toThrow("Unable to create user-organization mapping");
    });

    it("should handle reference lookups with simple IDs", async () => {
      (UserOrganizationModel.findOne as jest.Mock).mockReturnValue(
        mockChain(null),
      );
      const findMock = jest.fn().mockReturnValue(mockChain([]));
      UserOrganizationModel.find = findMock as any;

      await UserOrganizationService.getById("12345");

      const callArgs = findMock.mock.calls[0][0];
      expect(callArgs.$or.length).toBeGreaterThan(0);
    });

    it("should fail ensureSafeIdentifier with invalid chars", async () => {
      const badPayload = { ...validPayload, id: "bad$id" };
      await expect(UserOrganizationService.upsert(badPayload)).rejects.toThrow(
        "Invalid character in Identifier",
      );
    });
  });
});
