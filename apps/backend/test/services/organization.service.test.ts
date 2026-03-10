import { isValidObjectId, Types } from "mongoose";
import {
  OrganizationService,
  OrganizationServiceError,
  OrganizationFHIRPayload,
} from "../../src/services/organization.service";
import OrganizationModel from "../../src/models/organization";
import SpecialityModel from "../../src/models/speciality";
import ServiceModel from "../../src/models/service";
import UserProfileModel from "../../src/models/user-profile";
import { UserOrganizationService } from "../../src/services/user-organization.service";
import * as uploadMiddleware from "../../src/middlewares/upload";
import * as TypesPkg from "@yosemite-crew/types";
import logger from "../../src/utils/logger";

// --- MOCKS ---
jest.mock("mongoose", () => {
  const actualMongoose = jest.requireActual("mongoose");
  return {
    ...actualMongoose,
    isValidObjectId: jest.fn(actualMongoose.isValidObjectId),
  };
});

jest.mock("../../src/models/organization", () => ({
  findOneAndUpdate: jest.fn(),
  create: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findOneAndDelete: jest.fn(),
}));

jest.mock("../../src/models/speciality", () => ({
  find: jest.fn(),
}));

jest.mock("../../src/models/service", () => ({
  find: jest.fn(),
}));

jest.mock("../../src/models/user-profile", () => ({
  findOne: jest.fn(),
  create: jest.fn(),
}));

jest.mock("../../src/services/user-organization.service", () => ({
  UserOrganizationService: {
    createUserOrganizationMapping: jest.fn(),
    deleteAllByOrganizationId: jest.fn(),
  },
}));
jest.mock("../../src/models/organization.billing", () => ({
  OrgBilling: { create: jest.fn() },
}));
jest.mock("../../src/models/organisation.usage.counter", () => ({
  OrgUsageCounters: { create: jest.fn() },
}));

jest.mock("../../src/services/speciality.service", () => ({
  SpecialityService: {
    deleteAllByOrganizationId: jest.fn(),
  },
}));

jest.mock("../../src/services/organisation-room.service", () => ({
  OrganisationRoomService: {
    deleteAllByOrganizationId: jest.fn(),
  },
}));

jest.mock("../../src/middlewares/upload", () => ({
  buildS3Key: jest.fn(),
  moveFile: jest.fn(),
}));

jest.mock("@yosemite-crew/types", () => ({
  fromOrganizationRequestDTO: jest.fn(),
  toOrganizationResponseDTO: jest.fn((data, opts) => ({ ...data, ...opts })),
}));

jest.mock("../../src/utils/logger", () => ({
  warn: jest.fn(),
}));

jest.mock("src/utils/dual-write", () => ({
  shouldDualWrite: false,
  isDualWriteStrict: false,
  handleDualWriteError: jest.fn(),
}));

// --- TEST UTILS ---
const validObjectId = new Types.ObjectId().toString();

const mockDocument = (overrides = {}) => ({
  _id: new Types.ObjectId(validObjectId),
  toObject: jest.fn().mockReturnValue({
    name: "Test Hospital",
    type: "HOSPITAL",
    phoneNo: "1234567890",
    taxId: "123456789",
    ...overrides,
  }),
  ...overrides,
});

const generateBasePayload = (): OrganizationFHIRPayload => ({
  resourceType: "Organization",
  id: "test-id",
  name: "Test Hospital",
  contact: [{ telecom: [{ system: "phone", value: "1234567890" }] }],
  type: [
    {
      coding: [
        {
          code: "prov",
          system: "http://terminology.hl7.org/CodeSystem/organization-type",
        },
      ],
    },
  ],
});

const generateDTO = (overrides = {}) => ({
  id: "test-id",
  name: "Test Hospital",
  phoneNo: "1234567890",
  type: "HOSPITAL",
  taxId: "123456789", // Add default Tax ID to satisfy base requirements
  ...overrides,
});

describe("OrganizationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Reset mock queues to prevent mock leakage across tests (prevents false positives/negatives)
    [
      OrganizationModel.findOne,
      OrganizationModel.findOneAndUpdate,
      OrganizationModel.find,
      OrganizationModel.create,
      OrganizationModel.findOneAndDelete,
      SpecialityModel.find,
      ServiceModel.find,
      UserProfileModel.findOne,
      UserProfileModel.create,
    ].forEach((mockFn) => (mockFn as jest.Mock).mockReset());

    (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockImplementation(() =>
      generateDTO(),
    );
  });

  describe("OrganizationServiceError", () => {
    it("should set message and status code correctly", () => {
      const error = new OrganizationServiceError("Custom error", 404);
      expect(error.message).toBe("Custom error");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("OrganizationServiceError");
    });
  });

  describe("Validation Utilities (Triggered via upsert)", () => {
    it("should throw if requireSafeString receives invalid data", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ name: null }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Organization name is required.");

      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ name: 123 }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Organization name must be a string.");

      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ name: "   " }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Organization name cannot be empty.");

      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ name: "Bad$Name" }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Invalid character in Organization name.");
    });

    it("should throw if optionalSafeString receives invalid types or characters", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ website: 123 }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Website must be a string.");

      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ website: "bad$website" }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Invalid character in Website.");
    });

    it("should handle optionalSafeString empty strings as undefined", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ website: "   " }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      const res = await OrganizationService.upsert(generateBasePayload());
      expect(res.response).toBeDefined(); // Shouldn't throw
    });

    it("should throw if optionalNumber receives invalid data", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ address: { latitude: "not-a-num" } }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Address latitude must be a valid number.");
    });

    it("should parse optionalNumber string numbers", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ address: { latitude: "45.5" } }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      const res = await OrganizationService.upsert(generateBasePayload());
      expect(res.response).toBeDefined();
    });

    it("should allow valid optionalNumber as a pure number", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ address: { latitude: 45.5, longitude: 90 } }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      const res = await OrganizationService.upsert(generateBasePayload());
      expect(res.response).toBeDefined();
    });

    it("should throw if ensureSafeIdentifier format is invalid", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ id: "invalid spaces!@" }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Invalid identifier format.");
    });

    it("should throw if requireOrganizationType receives invalid data", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ type: 123 }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Organization type must be a string.");

      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ type: "  " }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Organization type cannot be empty.");

      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ type: "BAKERY" }),
      );
      await expect(
        OrganizationService.upsert(generateBasePayload()),
      ).rejects.toThrow("Invalid organization type.");
    });
  });

  describe("Extractors (Extensions and Identifiers)", () => {
    it("should extract TaxId from extension", async () => {
      const payload = {
        ...generateBasePayload(),
        extension: [
          {
            url: "http://example.org/fhir/StructureDefinition/taxId",
            valueString: "EXT-TAX-123",
          },
        ],
      };
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ taxId: undefined }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      await OrganizationService.upsert(payload);
      expect(OrganizationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ taxId: "EXT-TAX-123" }),
        }),
        expect.anything(),
      );
    });

    it("should extract TaxId from specific identifier system", async () => {
      const payload = {
        ...generateBasePayload(),
        identifier: [
          {
            system: "http://example.org/fhir/NamingSystem/organisation-tax-id",
            value: "SYS-TAX-123",
          },
        ],
      };
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ taxId: undefined }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      await OrganizationService.upsert(payload);
      expect(OrganizationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ taxId: "SYS-TAX-123" }),
        }),
        expect.anything(),
      );
    });

    it("should extract TaxId from generic identifier value", async () => {
      const payload = {
        ...generateBasePayload(),
        identifier: [{ value: "GEN-TAX-123" }],
      };
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ taxId: undefined }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      await OrganizationService.upsert(payload);
      expect(OrganizationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          $set: expect.objectContaining({ taxId: "GEN-TAX-123" }),
        }),
        expect.anything(),
      );
    });

    it("should properly pruneUndefined across nested arrays, objects, and ignore Date", async () => {
      const date = new Date();
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({
          address: { addressLine: "123 St", country: undefined },
          dummyArray: [1, undefined, { nested: undefined }],
          someDate: date,
        } as any),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      const res = await OrganizationService.upsert(generateBasePayload());
      expect(res.response).toBeDefined();
    });
  });

  describe("upsert", () => {
    it("should update existing document without userId", async () => {
      const doc = mockDocument();
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        doc,
      );

      const res = await OrganizationService.upsert(generateBasePayload());
      expect(res.created).toBe(false);
      expect((res.response as any)._id).toBe(doc._id);
    });

    it("should create new document and handle userId linkage", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const newDoc = mockDocument();
      (OrganizationModel.create as jest.Mock).mockResolvedValueOnce(newDoc);
      (UserProfileModel.findOne as jest.Mock).mockResolvedValueOnce(null);

      const res = await OrganizationService.upsert(
        generateBasePayload(),
        "user-123",
      );

      expect(res.created).toBe(true);
      expect(
        UserOrganizationService.createUserOrganizationMapping,
      ).toHaveBeenCalledWith({
        practitionerReference: "user-123",
        organizationReference: newDoc._id.toString(),
        roleCode: "OWNER",
        active: true,
      });
      expect(UserProfileModel.create).toHaveBeenCalled();
    });

    it("should not create a user profile if one already exists for the organization", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (OrganizationModel.create as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      (UserProfileModel.findOne as jest.Mock).mockResolvedValueOnce({
        _id: "profile-id",
      });

      await OrganizationService.upsert(generateBasePayload(), "user-123");
      expect(UserProfileModel.create).not.toHaveBeenCalled();
    });

    it("should process image uploads to S3 if URL is not https", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ imageURL: "local/path.jpg" }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const newDoc = mockDocument();
      (OrganizationModel.create as jest.Mock).mockResolvedValueOnce(newDoc);

      (uploadMiddleware.buildS3Key as jest.Mock).mockReturnValueOnce(
        "mocked/s3/key",
      );
      (uploadMiddleware.moveFile as jest.Mock).mockResolvedValueOnce(
        "https://s3.url/image.jpg",
      );

      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        newDoc,
      );

      await OrganizationService.upsert(generateBasePayload());

      expect(uploadMiddleware.moveFile).toHaveBeenCalledWith(
        "local/path.jpg",
        "mocked/s3/key",
      );
      expect(OrganizationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        { $set: { imageURL: "https://s3.url/image.jpg" } },
        expect.anything(),
      );
    });

    it("should construct valid TypeCoding if provided", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({
          typeCoding: { system: "sys", code: "cod", display: "disp" },
        }),
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );

      const res = await OrganizationService.upsert(generateBasePayload());
      expect((res.response as any).typeCoding).toEqual({
        system: "sys",
        code: "cod",
        display: "disp",
      });
    });

    it("should ignore invalid TypeCoding (missing code or system)", async () => {
      (TypesPkg.fromOrganizationRequestDTO as jest.Mock).mockReturnValueOnce(
        generateDTO({ typeCoding: { system: "sys" } }), // missing code
      );
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );

      await OrganizationService.upsert(generateBasePayload());
      expect(OrganizationModel.findOneAndUpdate).toHaveBeenCalledWith(
        expect.anything(),
        expect.not.objectContaining({ "typeCoding.system": "sys" }),
        expect.anything(),
      );
    });
  });

  describe("getById", () => {
    it("should return null if not found", async () => {
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      const res = await OrganizationService.getById(validObjectId);
      expect(res).toBeNull();
    });

    it("should throw if id is missing/invalid", async () => {
      await expect(OrganizationService.getById("   ")).rejects.toThrow(
        "Organization identifier is required.",
      );
    });

    it("should resolve by ObjectId if valid", async () => {
      const doc = mockDocument();
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);

      await OrganizationService.getById(validObjectId);
      expect(OrganizationModel.findOne).toHaveBeenCalledWith(
        { _id: validObjectId },
        null,
        expect.anything(),
      );
    });

    it("should resolve by fhirId if not a valid ObjectId", async () => {
      const doc = mockDocument();
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);
      (isValidObjectId as jest.Mock).mockReturnValueOnce(false);

      await OrganizationService.getById("custom-fhir-id");
      expect(OrganizationModel.findOne).toHaveBeenCalledWith(
        { fhirId: "custom-fhir-id" },
        null,
        expect.anything(),
      );
    });
  });

  describe("listAll", () => {
    it("should map and return all organizations", async () => {
      (OrganizationModel.find as jest.Mock).mockResolvedValueOnce([
        mockDocument(),
        mockDocument(),
      ]);
      const res = await OrganizationService.listAll();
      expect(res.length).toBe(2);
    });
  });

  describe("deleteById", () => {
    it("should return false if document not found", async () => {
      (OrganizationModel.findOneAndDelete as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const res = await OrganizationService.deleteById(validObjectId);
      expect(res).toBe(false);
    });
  });

  describe("update", () => {
    it("should return null if document not found", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const res = await OrganizationService.update(
        validObjectId,
        generateBasePayload(),
      );
      expect(res).toBeNull();
    });

    it("should return updated fhir response if found", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument(),
      );
      const res = await OrganizationService.update(
        validObjectId,
        generateBasePayload(),
      );
      expect(res).toBeDefined();
    });
  });

  describe("upadtePofileVerificationStatus", () => {
    it("should return null if document not found", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const res = await OrganizationService.upadtePofileVerificationStatus(
        validObjectId,
        true,
      );
      expect(res).toBeNull();
    });

    it("should return fhir response if successful", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument({ isVerified: true }),
      );
      const res = await OrganizationService.upadtePofileVerificationStatus(
        validObjectId,
        true,
      );
      expect((res as any)?.isVerified).toBe(true);
    });
  });

  describe("updateProfilePhotoUrl", () => {
    it("should return null if document not found", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        null,
      );
      const res = await OrganizationService.updateProfilePhotoUrl(
        validObjectId,
        "url",
      );
      expect(res).toBeNull();
    });

    it("should return document if successful", async () => {
      (OrganizationModel.findOneAndUpdate as jest.Mock).mockResolvedValueOnce(
        mockDocument({ imageURL: "url" }),
      );
      const res = await OrganizationService.updateProfilePhotoUrl(
        validObjectId,
        "url",
      );
      expect((res as any)?.imageURL).toBe("url");
    });
  });

  describe("resolveOrganisation", () => {
    it("should throw if input is completely empty", async () => {
      await expect(OrganizationService.resolveOrganisation({})).rejects.toThrow(
        "Invalid search input.",
      );
    });

    it("should resolve by placeId", async () => {
      const doc = mockDocument();
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);
      const res = await OrganizationService.resolveOrganisation({
        placeId: "place-123",
      });
      expect(res.isPmsOrganisation).toBe(true);
      expect(res.organisation).toBeDefined();
      expect(OrganizationModel.findOne).toHaveBeenCalledWith({
        googlePlaceId: "place-123",
      });
    });

    it("should resolve by lat/lng", async () => {
      const doc = mockDocument();
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);

      const res = await OrganizationService.resolveOrganisation({
        lat: 10,
        lng: 20,
      });
      expect(res.isPmsOrganisation).toBe(true);
      expect(OrganizationModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          "address.location": {
            $near: {
              $geometry: { type: "Point", coordinates: [20, 10] },
              $maxDistance: 120,
            },
          },
        }),
      );
    });

    it("should resolve by name", async () => {
      const doc = mockDocument();
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);

      const res = await OrganizationService.resolveOrganisation({
        name: "Hospital",
      });
      expect(res.isPmsOrganisation).toBe(true);
    });

    it("should return false if no match found", async () => {
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(null);
      const res = await OrganizationService.resolveOrganisation({
        name: "Unknown",
      });
      expect(res.isPmsOrganisation).toBe(false);
    });
  });

  describe("listNearbyForAppointmentsPaginated", () => {
    it("should throw if lat or lng is missing", async () => {
      await expect(
        OrganizationService.listNearbyForAppointmentsPaginated(0, 0),
      ).rejects.toThrow("lat/lng are required");
    });

    it("should return paginated data with specialities and services", async () => {
      const mockChain = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            name: "Org1",
            address: { location: { coordinates: [20, 10] } },
          },
        ]),
      };
      (OrganizationModel.find as jest.Mock).mockReturnValue(mockChain);

      const specId = new Types.ObjectId();
      (SpecialityModel.find as jest.Mock).mockResolvedValue([
        { _id: specId, toObject: () => ({ name: "Cardio" }) },
      ]);
      (ServiceModel.find as jest.Mock).mockResolvedValue([
        { name: "ECG", specialityId: specId },
      ]);

      const res = await OrganizationService.listNearbyForAppointmentsPaginated(
        10,
        20,
      );

      expect(res.data.length).toBe(1);
      expect(res.data[0].distanceInMeters).toBe(0);
      expect(res.data[0].specialitiesWithServices[0].services.length).toBe(1);
      expect(res.meta.total).toBe(1);
    });

    it("should fallback to all organizations if no nearby are found", async () => {
      const emptyMockChain = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      };
      const allMockChain = {
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            _id: new Types.ObjectId(),
            name: "FallbackOrg",
          },
        ]),
      };

      (OrganizationModel.find as jest.Mock)
        .mockReturnValueOnce(emptyMockChain)
        .mockReturnValueOnce(allMockChain);

      (SpecialityModel.find as jest.Mock).mockResolvedValue([]);
      (ServiceModel.find as jest.Mock).mockResolvedValue([]);

      const res = await OrganizationService.listNearbyForAppointmentsPaginated(
        10,
        20,
      );

      expect(logger.warn).toHaveBeenCalledWith(
        "No nearby organisations found, returning all organisations",
      );
      expect(res.data.length).toBe(1);
      expect(res.data[0].distanceInMeters).toBeNull();
    });
  });

  describe("coerceOrganizationType logic fallback", () => {
    it("should fallback to HOSPITAL for unsupported types in mapped response", async () => {
      const doc = mockDocument({ type: "UNKNOWN" });
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);

      const res = await OrganizationService.getById(validObjectId);
      expect(res).toBeDefined();
    });

    it("should fallback to HOSPITAL for non-string types in mapped response", async () => {
      const doc = mockDocument({ type: 12345 }); // Number type triggers typeof !== 'string' branch
      (OrganizationModel.findOne as jest.Mock).mockResolvedValueOnce(doc);

      const res = await OrganizationService.getById(validObjectId);
      expect((res as any)?.type).toBe("HOSPITAL");
    });
  });
});
