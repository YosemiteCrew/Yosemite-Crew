import { UserProfileService, UserProfileServiceError } from "../../src/services/user-profile.service";
import UserProfileModel from "../../src/models/user-profile";
import { BaseAvailabilityService, BaseAvailabilityServiceError } from "../../src/services/base-availability.service";

// --- MOCKS ---
jest.mock("../../src/models/user-profile", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));

jest.mock("../../src/services/base-availability.service", () => ({
  BaseAvailabilityService: {
    create: jest.fn(),
    update: jest.fn(),
    getByUserId: jest.fn(),
  },
  BaseAvailabilityServiceError: class extends Error {
    constructor(message: string, public statusCode: number) {
      super(message);
      this.name = "BaseAvailabilityServiceError";
    }
  },
}));

// --- TEST UTILS ---
const validAvailability = [{ slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: true }] }];
const invalidAvailability = [{ slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: false }] }];

const mockDocument = (overrides = {}, rawOverride = {}) => ({
  _id: "doc-id",
  userId: "user-123",
  organizationId: "org-123",
  status: "DRAFT",
  createdAt: new Date(),
  updatedAt: new Date(),
  save: jest.fn(),
  toObject: jest.fn().mockReturnValue({
    _id: "doc-id",
    userId: "user-123",
    organizationId: "org-123",
    ...rawOverride,
  }),
  ...overrides,
});

const generateCreatePayload = (overrides = {}) => ({
  userId: "user-123",
  organizationId: "org-123",
  baseAvailability: validAvailability,
  ...overrides,
});

describe("UserProfileService", () => {
  const userId = "user_123";
  const orgId = "org_456";
  const profileId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("UserProfileServiceError", () => {
    it("should instantiate correctly", () => {
      const err = new UserProfileServiceError("Test error", 404);
      expect(err.message).toBe("Test error");
      expect(err.statusCode).toBe(404);
      expect(err.name).toBe("UserProfileServiceError");
    });
  });

  describe("Validation & Sanitization (Tested via create/update)", () => {
    it("should throw if baseAvailability is missing on create", async () => {
      await expect(UserProfileService.create({ userId: "1", organizationId: "2" } as any))
        .rejects.toThrow(new UserProfileServiceError("Base availability is required.", 400));
    });

    it("should reject payloads with missing updatable fields on update", async () => {
      await expect(UserProfileService.update("user-123", "org-123", {}))
        .rejects.toThrow("No updatable fields provided.");
    });

    it("should throw on invalid User/Org ID formats", async () => {
      await expect(UserProfileService.create(generateCreatePayload({ userId: "invalid id!" })))
        .rejects.toThrow("Invalid user id format.");
      await expect(UserProfileService.create(generateCreatePayload({ organizationId: "invalid org @!" })))
        .rejects.toThrow("Invalid organization id format.");
      await expect(UserProfileService.create(generateCreatePayload({ userId: "valid", organizationId: 123 })))
        .rejects.toThrow("Organization id is required."); // not a string
      await expect(UserProfileService.create(generateCreatePayload({ userId: "   " })))
        .rejects.toThrow("User id cannot be empty.");
    });

    it("should throw on query operators ($)", async () => {
      await expect(UserProfileService.create(generateCreatePayload({ userId: "user$123" })))
        .rejects.toThrow("Invalid character in User id.");
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { phoneNumber: "$12345" } })))
        .rejects.toThrow("Invalid character in Phone number.");
    });

    it("should enforce plain objects", async () => {
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: [] })))
        .rejects.toThrow("Personal details must be an object.");
    });

    it("should handle optional strings", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(validAvailability);

      const payload = generateCreatePayload({ personalDetails: { phoneNumber: "   " } }); // empty trimmed
      await UserProfileService.create(payload); // Shouldn't throw
    });

    it("should validate optionalEnum", async () => {
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { gender: 123 } })))
        .rejects.toThrow("Gender must be a string.");
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { gender: "ALIEN" } })))
        .rejects.toThrow("Gender must be one of: MALE, FEMALE, OTHER.");

      // Empty string becomes undefined
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(validAvailability);
      await UserProfileService.create(generateCreatePayload({ personalDetails: { gender: "   " } }));
    });

    it("should validate optionalDate", async () => {
      // Invalid date object
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { dateOfBirth: new Date("invalid") } })))
        .rejects.toThrow("Date of birth must be a valid date.");

      // Invalid string format
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { dateOfBirth: "not-a-date" } })))
        .rejects.toThrow("Date of birth must be a valid date.");

      // Invalid type
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { dateOfBirth: {} } })))
        .rejects.toThrow("Date of birth must be a date string.");

      // Valid date object
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(validAvailability);
      await UserProfileService.create(generateCreatePayload({ personalDetails: { dateOfBirth: new Date() } }));
    });

    it("should validate optionalNumber", async () => {
      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { address: { latitude: Number.NaN } } })))
        .rejects.toThrow("Address latitude must be a valid number.");

      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { address: { latitude: "abc" } } })))
        .rejects.toThrow("Address latitude must be a valid number.");

      await expect(UserProfileService.create(generateCreatePayload({ personalDetails: { address: { latitude: {} } } })))
        .rejects.toThrow("Address latitude must be a number.");

      // Valid string number, number, and empty string
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(validAvailability);
      await UserProfileService.create(generateCreatePayload({ personalDetails: { address: { latitude: "45.5", longitude: 90, postalCode: "  " } } }));
    });

    it("should validate sanitizeDocuments", async () => {
      await expect(UserProfileService.create(generateCreatePayload({ professionalDetails: { documents: {} } })))
        .rejects.toThrow("Professional documents must be an array.");

      await expect(UserProfileService.create(generateCreatePayload({ professionalDetails: { documents: [{}] } })))
        .rejects.toThrow("Professional document[0].type is required.");

      await expect(UserProfileService.create(generateCreatePayload({ professionalDetails: { documents: [{ type: "LICENSE", fileUrl: "url" }] } })))
        .rejects.toThrow("Professional document[0].uploadedAt is required.");

      await expect(UserProfileService.create(generateCreatePayload({ professionalDetails: { documents: [{ type: "LICENSE", fileUrl: "url", uploadedAt: new Date(), verified: "yes" }] } })))
        .rejects.toThrow("Professional document[0].verified must be a boolean.");
    });

    it("should correctly pruneUndefined (Objects)", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(validAvailability);

      const payload = generateCreatePayload({
        professionalDetails: {
          specialization: "Cardio",
          biography: undefined, // Object key undefined
          documents: [
            { type: "LICENSE", fileUrl: "url", uploadedAt: new Date() }
          ]
        }
      });
      await UserProfileService.create(payload as any);
      expect(UserProfileModel.create).toHaveBeenCalledWith(expect.objectContaining({
        professionalDetails: expect.objectContaining({ documents: expect.any(Array) })
      }));
    });
  });

  describe("Completeness & Status Logic (determineProfileStatus)", () => {
    it("should return DRAFT if missing details or availability", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      const doc = mockDocument(); // Missing details
      (UserProfileModel.create as jest.Mock).mockResolvedValue(doc);
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(invalidAvailability); // triggers draft

      await UserProfileService.create(generateCreatePayload());
      expect(doc.status).toBe("DRAFT");
      expect(doc.save).not.toHaveBeenCalled(); // status was already DRAFT
    });

    it("should return COMPLETED if everything is valid", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);

      const fullDetails = {
        personalDetails: { gender: "MALE", employmentType: "FULL_TIME", phoneNumber: "123", address: { addressLine: "A", city: "C", state: "S", postalCode: "P", country: "C" } },
        professionalDetails: { medicalLicenseNumber: "M", specialization: "S", qualification: "Q" }
      };

      const doc = mockDocument({ status: "DRAFT", ...fullDetails }); // Provide details to the mock!
      (UserProfileModel.create as jest.Mock).mockResolvedValue(doc);
      (BaseAvailabilityService.create as jest.Mock).mockResolvedValue(validAvailability);

      const payload = generateCreatePayload(fullDetails);

      const result = await UserProfileService.create(payload);
      expect(result.status).toBe("COMPLETED");
      expect(doc.save).toHaveBeenCalled(); // should have been saved to transition DRAFT -> COMPLETED
    });
  });

  describe("buildDomainProfile", () => {
    it("should handle varied _id sources (object with toString, missing id, etc)", async () => {
      const doc = mockDocument({}, { _id: { toString: () => "obj-id" } });
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(doc);
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(validAvailability);

      const result = await UserProfileService.getByUserId("user-123", "org-123");
      expect(result?._id).toBe("obj-id");
    });

    it("should prune deep structures inside toObject representation", async () => {
      const rawOverride = {
        personalDetails: { gender: "MALE", address: { city: "City", state: undefined } },
        professionalDetails: { documents: [{ type: "CV", fileUrl: "url", verified: undefined }, undefined] }
      };
      const doc = mockDocument({}, rawOverride);
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(doc);
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(validAvailability);

      const result = await UserProfileService.getByUserId("user-123", "org-123");
      expect(result?.personalDetails?.address).toBeDefined();
      expect(result?.professionalDetails?.documents).toHaveLength(1);
    });
  });

  // ======================================================================
  // 1. CREATE
  // ======================================================================
  describe("create", () => {
    it("should throw if profile already exists", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue({}); // Found
      await expect(UserProfileService.create(generateCreatePayload())).rejects.toThrow("Profile already exists for this user in this organization.");
    });

    it("should delete profile and rethrow BaseAvailabilityServiceError", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockRejectedValue(new BaseAvailabilityServiceError("Avail err", 400));

      await expect(UserProfileService.create(generateCreatePayload()))
        .rejects.toThrow(new UserProfileServiceError("Avail err", 400));
      expect(UserProfileModel.deleteOne).toHaveBeenCalledWith({ _id: "doc-id" });
    });

    it("should delete profile and rethrow generic error", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.create as jest.Mock).mockRejectedValue(new Error("Generic DB Err"));

      await expect(UserProfileService.create(generateCreatePayload()))
        .rejects.toThrow("Generic DB Err");
      expect(UserProfileModel.deleteOne).toHaveBeenCalledWith({ _id: "doc-id" });
    });
  });

  describe("update", () => {
    it("should return null if profile not found", async () => {
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      const res = await UserProfileService.update("user-123", "org-123", { personalDetails: { gender: "MALE" } });
      expect(res).toBeNull();
    });

    it("should use findOne if NO attributes updated (only availability)", async () => {
      const doc = mockDocument();
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(doc);
      (BaseAvailabilityService.update as jest.Mock).mockResolvedValue(validAvailability);

      const res = await UserProfileService.update("user-123", "org-123", { baseAvailability: validAvailability });
      expect(UserProfileModel.findOne).toHaveBeenCalled();
      expect(BaseAvailabilityService.update).toHaveBeenCalled();
      expect(res).toBeDefined();
    });

    it("should fetch availability if NOT provided in payload", async () => {
      const doc = mockDocument();
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(doc);
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(validAvailability);

      await UserProfileService.update("user-123", "org-123", { personalDetails: { gender: "MALE" } });
      expect(BaseAvailabilityService.getByUserId).toHaveBeenCalledWith("user-123");
    });

    it("should rethrow BaseAvailabilityServiceError on update", async () => {
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.update as jest.Mock).mockRejectedValue(new BaseAvailabilityServiceError("Avail err", 400));

      await expect(UserProfileService.update("user-123", "org-123", { personalDetails: { gender: "MALE" }, baseAvailability: {} }))
        .rejects.toThrow(new UserProfileServiceError("Avail err", 400));
    });

    it("should rethrow generic error on update", async () => {
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.update as jest.Mock).mockRejectedValue(new Error("Fail"));

      await expect(UserProfileService.update("user-123", "org-123", { personalDetails: { gender: "MALE" }, baseAvailability: {} }))
        .rejects.toThrow("Fail");
    });
  });

  describe("getByUserId", () => {
    it("should return null if profile not found", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      const res = await UserProfileService.getByUserId("user-123", "org-123");
      expect(res).toBeNull();
    });

    it("should return domain profile if found", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(validAvailability);

      const res = await UserProfileService.getByUserId("user-123", "org-123");
      expect(res).toBeDefined();
    });

    it("should rethrow BaseAvailabilityServiceError on get", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValue(new BaseAvailabilityServiceError("Avail err", 400));

      await expect(UserProfileService.getByUserId("user-123", "org-123"))
        .rejects.toThrow(new UserProfileServiceError("Avail err", 400));
    });

    it("should rethrow generic error on get", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDocument());
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValue(new Error("Fail"));

      await expect(UserProfileService.getByUserId("user-123", "org-123"))
        .rejects.toThrow("Fail");
    });
  });
});