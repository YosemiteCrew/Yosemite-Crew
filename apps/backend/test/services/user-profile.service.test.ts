import { Types } from "mongoose";
import {
  UserProfileService,
  UserProfileServiceError,
} from "../../src/services/user-profile.service";
import UserProfileModel from "../../src/models/user-profile";
import {
  BaseAvailabilityService,
  BaseAvailabilityServiceError,
} from "../../src/services/base-availability.service";
import UserOrganizationModel from "src/models/user-organization";
import { getURLForKey } from "src/middlewares/upload";

// --- Global Mocks Setup ---
jest.mock("src/middlewares/upload", () => ({
  __esModule: true,
  getURLForKey: jest.fn((key) => `https://s3.example.com/${key}`),
}));

jest.mock("../../src/models/user-profile", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));

jest.mock("src/models/user-organization", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/services/base-availability.service", () => {
  class MockBaseAvailabilityServiceError extends Error {
    constructor(
      message: string,
      public statusCode: number,
    ) {
      super(message);
      this.name = "BaseAvailabilityServiceError";
    }
  }
  return {
    __esModule: true,
    BaseAvailabilityServiceError: MockBaseAvailabilityServiceError,
    BaseAvailabilityService: {
      getByUserId: jest.fn(),
    },
  };
});

describe("UserProfileService", () => {
  const mockSave = jest.fn();

  const createMockDoc = (overrides: any = {}) => {
    const data = {
      _id: new Types.ObjectId(),
      userId: "user1",
      organizationId: "org1",
      status: "DRAFT",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
    return {
      ...data,
      toObject: () => data,
      save: mockSave.mockResolvedValue(true),
    };
  };

  const completeAvailability = [
    { slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }] },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("UserProfileServiceError", () => {
    it("should set properties correctly", () => {
      const err = new UserProfileServiceError("Test", 400);
      expect(err.message).toBe("Test");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("UserProfileServiceError");
    });
  });

  describe("Validation & Sanitization (Implicitly tested via create)", () => {
    describe("requireUserId & requireOrganizationId", () => {
      it("should throw if value is not a string", async () => {
        await expect(
          UserProfileService.create({
            userId: 123,
            organizationId: "o1",
          } as any),
        ).rejects.toThrow(
          new UserProfileServiceError("User id is required.", 400),
        );
      });

      it("should throw if value is empty", async () => {
        await expect(
          UserProfileService.create({ userId: "   ", organizationId: "o1" }),
        ).rejects.toThrow(
          new UserProfileServiceError("User id cannot be empty.", 400),
        );
      });

      it("should throw if value contains $ (forbidQueryOperators)", async () => {
        await expect(
          UserProfileService.create({
            userId: "user$name",
            organizationId: "o1",
          }),
        ).rejects.toThrow(
          new UserProfileServiceError("Invalid character in User id.", 400),
        );
      });

      it("should throw if regex fails (format check)", async () => {
        await expect(
          UserProfileService.create({
            userId: "invalid name!",
            organizationId: "o1",
          }),
        ).rejects.toThrow(
          new UserProfileServiceError("Invalid user id format.", 400),
        );
      });
    });

    describe("assertPlainObject", () => {
      it("should throw if personalDetails is an array or string", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: [],
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Personal details must be an object.",
            400,
          ),
        );

        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: "str",
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Personal details must be an object.",
            400,
          ),
        );
      });
    });

    describe("optionalEnum", () => {
      it("should throw if enum value is not a string", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: { gender: 123 },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError("Gender must be a string.", 400),
        );
      });

      it("should throw if enum value is invalid", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: { gender: "ALIEN" },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Gender must be one of: MALE, FEMALE, OTHER.",
            400,
          ),
        );
      });

      it("should ignore empty enum strings gracefully", async () => {
        (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
        (UserProfileModel.create as jest.Mock).mockResolvedValue(
          createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
        );
        (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
          [],
        );

        const res = await UserProfileService.create({
          userId: "u1",
          organizationId: "o1",
          personalDetails: { gender: "   ", profilePictureUrl: "key" },
        });
        expect(res.personalDetails?.gender).toBeUndefined();
      });
    });

    describe("optionalDate", () => {
      it("should throw if date is an invalid string", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: { dateOfBirth: "not-a-date" },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Date of birth must be a valid date.",
            400,
          ),
        );
      });

      it("should throw if date is an invalid Date object", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: { dateOfBirth: new Date("invalid") },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Date of birth must be a valid date.",
            400,
          ),
        );
      });

      it("should throw if value is completely incompatible type (e.g. object)", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            personalDetails: { dateOfBirth: {} },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Date of birth must be a date string.",
            400,
          ),
        );
      });

      it("should accept a valid Date object", async () => {
        (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
        (UserProfileModel.create as jest.Mock).mockResolvedValue(
          createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
        );
        (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
          [],
        );

        const d = new Date();
        await UserProfileService.create({
          userId: "u1",
          organizationId: "o1",
          personalDetails: { dateOfBirth: d, profilePictureUrl: "key" },
        });
        expect(UserProfileModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            personalDetails: expect.objectContaining({ dateOfBirth: d }),
          }),
        );
      });
    });

    describe("optionalNumber", () => {
      it("should throw if number is NaN", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: { yearsOfExperience: Number.NaN },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Years of experience must be a valid number.",
            400,
          ),
        );
      });

      it("should throw if string number is invalid", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: { yearsOfExperience: "abc" },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Years of experience must be a valid number.",
            400,
          ),
        );
      });

      it("should throw if completely invalid type (e.g., boolean)", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: { yearsOfExperience: true },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Years of experience must be a number.",
            400,
          ),
        );
      });

      it("should parse valid string number", async () => {
        (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
        (UserProfileModel.create as jest.Mock).mockResolvedValue(
          createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
        );
        (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
          [],
        );

        await UserProfileService.create({
          userId: "u1",
          organizationId: "o1",
          personalDetails: { profilePictureUrl: "key" },
          professionalDetails: { yearsOfExperience: " 5 " },
        });

        expect(UserProfileModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            professionalDetails: expect.objectContaining({
              yearsOfExperience: 5,
            }),
          }),
        );
      });
    });

    describe("sanitizeDocuments", () => {
      it("should throw if documents is not an array", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: { documents: "str" },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Professional documents must be an array.",
            400,
          ),
        );
      });

      it("should throw if document missing type", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: { documents: [{}] },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Professional document[0].type is required.",
            400,
          ),
        );
      });

      it("should throw if document missing uploadedAt", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: {
              documents: [{ type: "CV", fileUrl: "key" }],
            },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Professional document[0].uploadedAt is required.",
            400,
          ),
        );
      });

      it("should map verified boolean properly and reject invalid types", async () => {
        await expect(
          UserProfileService.create({
            userId: "u1",
            organizationId: "o1",
            professionalDetails: {
              documents: [
                {
                  type: "CV",
                  fileUrl: "key",
                  uploadedAt: new Date(),
                  verified: "yes",
                },
              ],
            },
          }),
        ).rejects.toThrow(
          new UserProfileServiceError(
            "Professional document[0].verified must be a boolean.",
            400,
          ),
        );
      });

      it("should successfully map documents and apply getURLForKey", async () => {
        (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
        (UserProfileModel.create as jest.Mock).mockResolvedValue(
          createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
        );
        (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
          [],
        );

        await UserProfileService.create({
          userId: "u1",
          organizationId: "o1",
          personalDetails: { profilePictureUrl: "key" },
          professionalDetails: {
            documents: [
              {
                type: "CV",
                fileUrl: "test-key",
                uploadedAt: new Date(),
                verified: true,
              },
            ],
          },
        });

        expect(getURLForKey).toHaveBeenCalledWith("test-key");
        expect(UserProfileModel.create).toHaveBeenCalled();
      });
    });
  });

  describe("Pruning (pruneUndefined, pruneArray, pruneRecord)", () => {
    it("should strip undefined values from nested objects and arrays", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(
        createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue([]);

      await UserProfileService.create({
        userId: "u1",
        organizationId: "o1",
        personalDetails: { profilePictureUrl: "key" },
        professionalDetails: {
          specialization: "Spec",
          biography: undefined, // Pruned from object
        },
      });

      expect(UserProfileModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          professionalDetails: { specialization: "Spec" }, // strictly no biography key
        }),
      );
    });
  });

  describe("create", () => {
    it("should throw 409 if profile already exists", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue({
        id: "exists",
      });
      await expect(
        UserProfileService.create({ userId: "u1", organizationId: "o1" }),
      ).rejects.toThrow(
        new UserProfileServiceError(
          "Profile already exists for this user in this organization.",
          409,
        ),
      );
    });

    it("should properly map BaseAvailabilityServiceError", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(
        createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValue(
        new BaseAvailabilityServiceError("Avail error", 503),
      );

      await expect(
        UserProfileService.create({
          userId: "u1",
          organizationId: "o1",
          personalDetails: { profilePictureUrl: "key" },
        }),
      ).rejects.toThrow(new UserProfileServiceError("Avail error", 503));
    });

    it("should throw generic errors if availability fetching fails randomly", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      (UserProfileModel.create as jest.Mock).mockResolvedValue(
        createMockDoc({ personalDetails: { profilePictureUrl: "key" } }),
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValue(
        new Error("System crash"),
      );

      await expect(
        UserProfileService.create({
          userId: "u1",
          organizationId: "o1",
          personalDetails: { profilePictureUrl: "key" },
        }),
      ).rejects.toThrow(new Error("System crash"));
    });
  });

  describe("update", () => {
    it("should throw 400 if no fields are provided", async () => {
      await expect(UserProfileService.update("u1", "o1", {})).rejects.toThrow(
        new UserProfileServiceError("No updatable fields provided.", 400),
      );
    });

    it("should return null if profile not found", async () => {
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      const res = await UserProfileService.update("u1", "o1", {
        personalDetails: { gender: "MALE" },
      });
      expect(res).toBeNull();
    });

    it("should fallback to findOne if payload prunes completely to empty objects", async () => {
      // payload has personalDetails, so it bypasses the throw, but pruning removes all keys inside.
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(
        createMockDoc(),
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue([]);

      await UserProfileService.update("u1", "o1", { personalDetails: null });

      // Because `Object.keys(attributes).length` becomes 0 (after empty pruning), it uses findOne instead of findOneAndUpdate
      expect(UserProfileModel.findOne).toHaveBeenCalledWith(
        { userId: "u1", organizationId: "o1" },
        null,
        { sanitizeFilter: true },
      );
    });

    it("should successfully update and return mapped domain profile", async () => {
      const mockDoc = createMockDoc({
        _id: { toString: () => "obj_id_string" },
      });
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc,
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue([]);

      const res = await UserProfileService.update("u1", "o1", {
        personalDetails: { gender: "FEMALE" },
      });

      expect(UserProfileModel.findOneAndUpdate).toHaveBeenCalled();
      expect(res?._id).toBe("obj_id_string"); // Maps _id toString
    });

    it("should map BaseAvailabilityServiceError properly on update", async () => {
      (UserProfileModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        createMockDoc(),
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValue(
        new BaseAvailabilityServiceError("Avail error", 400),
      );

      await expect(
        UserProfileService.update("u1", "o1", {
          personalDetails: { gender: "MALE" },
        }),
      ).rejects.toThrow(new UserProfileServiceError("Avail error", 400));
    });
  });

  describe("getByUserId", () => {
    it("should return null if not found", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(null);
      const res = await UserProfileService.getByUserId("u1", "o1");
      expect(res).toBeNull();
    });

    it("should return data successfully", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(
        createMockDoc(),
      );
      (UserOrganizationModel.findOne as jest.Mock).mockResolvedValue({
        role: "ADMIN",
      });
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
        completeAvailability,
      );

      const res = await UserProfileService.getByUserId("u1", "o1");

      expect(res?.mapping).toEqual({ role: "ADMIN" });
      expect(res?.baseAvailability).toEqual(completeAvailability);
      expect(res?.profile.status).toBe("DRAFT"); // Fallback because mockDoc doesn't have all details
    });

    it("should throw mapped availability error", async () => {
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(
        createMockDoc(),
      );
      (BaseAvailabilityService.getByUserId as jest.Mock).mockRejectedValue(
        new BaseAvailabilityServiceError("err", 404),
      );

      await expect(UserProfileService.getByUserId("u1", "o1")).rejects.toThrow(
        new UserProfileServiceError("err", 404),
      );
    });
  });

  describe("Status Resolution (determineProfileStatus & applyProfileStatus)", () => {
    const fullPersonal = {
      gender: "MALE",
      employmentType: "FULL_TIME",
      phoneNumber: "123",
      address: {
        addressLine: "a",
        city: "c",
        state: "s",
        postalCode: "p",
        country: "co",
      },
    };
    const fullProfessional = {
      medicalLicenseNumber: "1",
      specialization: "A",
      qualification: "Q",
    };

    it("should be COMPLETED if all fields exist and availability is valid, and save if changed", async () => {
      const mockDoc = createMockDoc({
        status: "DRAFT", // Started as Draft
        personalDetails: fullPersonal,
        professionalDetails: fullProfessional,
      });
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDoc);
      (UserOrganizationModel.findOne as jest.Mock).mockResolvedValue({});
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
        completeAvailability,
      );

      const res = await UserProfileService.getByUserId("u1", "o1");

      expect(res?.profile.status).toBe("COMPLETED");
      expect(mockDoc.status).toBe("COMPLETED"); // Changed
      expect(mockSave).toHaveBeenCalled(); // Triggered save
    });

    it("should remain DRAFT if availability has no valid slots", async () => {
      const mockDoc = createMockDoc({
        personalDetails: fullPersonal,
        professionalDetails: fullProfessional,
      });
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDoc);
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue([
        { slots: [{ startTime: "", endTime: "", isAvailable: false }] },
      ]);

      const res = await UserProfileService.getByUserId("u1", "o1");
      expect(res?.profile.status).toBe("DRAFT");
    });

    it("should remain DRAFT if personal details are incomplete (missing address or field)", async () => {
      const mockDoc = createMockDoc({
        personalDetails: { ...fullPersonal, address: undefined },
        professionalDetails: fullProfessional,
      });
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDoc);
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
        completeAvailability,
      );

      const res = await UserProfileService.getByUserId("u1", "o1");
      expect(res?.profile.status).toBe("DRAFT");
    });

    it("should remain DRAFT if professional details are incomplete (missing license)", async () => {
      const mockDoc = createMockDoc({
        personalDetails: fullPersonal,
        professionalDetails: { ...fullProfessional, medicalLicenseNumber: "" },
      });
      (UserProfileModel.findOne as jest.Mock).mockResolvedValue(mockDoc);
      (BaseAvailabilityService.getByUserId as jest.Mock).mockResolvedValue(
        completeAvailability,
      );

      const res = await UserProfileService.getByUserId("u1", "o1");
      expect(res?.profile.status).toBe("DRAFT");
    });
  });
});
