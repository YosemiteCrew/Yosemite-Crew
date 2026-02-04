import { Types } from "mongoose";
import {
  SpecialityService,
  SpecialityServiceError,
} from "../../src/services/speciality.service";
import SpecialityModel from "../../src/models/speciality";
import OrganisationRoomModel from "../../src/models/organisation-room";
import UserModel from "../../src/models/user";
import OrganizationModel from "../../src/models/organization";
import { ServiceService } from "../../src/services/service.service";
import * as EmailUtils from "../../src/utils/email";
import logger from "../../src/utils/logger";

// --- Mocks ---
jest.mock("../../src/models/speciality");
jest.mock("../../src/models/organisation-room");
jest.mock("../../src/models/user");
jest.mock("../../src/models/organization");
jest.mock("../../src/services/service.service");
jest.mock("../../src/utils/email");
jest.mock("../../src/utils/logger");

// Mock Types helper
jest.mock("@yosemite-crew/types", () => ({
  fromSpecialityRequestDTO: jest.fn((dto) => ({
    ...dto,
    services: dto.services,
  })),
  toSpecialityResponseDTO: jest.fn((domain) => domain),
}));

// --- Helper: Mongoose Chain Mock ---
const mockChain = (result: any = null) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    lean: jest.fn().mockResolvedValue(result),
    sort: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return chain as any;
};

// --- Helper: Mock Document ---
const mockDoc = (data: any) => ({
  ...data,
  toObject: jest.fn(() => data),
});

describe("SpecialityService", () => {
  let mockOrgId: Types.ObjectId;
  let mockSpecId: Types.ObjectId;
  let validPayload: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgId = new Types.ObjectId();
    mockSpecId = new Types.ObjectId();

    validPayload = {
      resourceType: "Organization",
      id: mockSpecId.toHexString(),
      organisationId: mockOrgId.toHexString(),
      name: "Cardiology",
      headUserId: "user-123",
      active: true,
    };

    // Default Mongoose Mocks
    (SpecialityModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
    (SpecialityModel.find as jest.Mock).mockReturnValue(mockChain([]));
    (SpecialityModel.create as jest.Mock).mockResolvedValue(
      mockDoc({ ...validPayload, _id: mockSpecId })
    );
    (OrganizationModel.findById as jest.Mock).mockReturnValue(
      mockChain({ name: "Test Org" })
    );
    (UserModel.findOne as jest.Mock).mockReturnValue(
      mockChain({ email: "doc@test.com", firstName: "Dr." })
    );
  });

  describe("Validation & Internals", () => {
    it("should throw error for invalid FHIR resource type", async () => {
      await expect(
        SpecialityService.createOne({ resourceType: "Patient" } as any)
      ).rejects.toThrow("Invalid payload. Expected FHIR Organization resource");
    });

    it("should throw error if Organization ID is invalid", async () => {
      // Use "invalid id" (space) to fail the regex AND not be a valid ObjectId
      const invalid = { ...validPayload, organisationId: "invalid id" };
      await expect(SpecialityService.createOne(invalid)).rejects.toThrow(
        "Invalid organisation identifier format"
      );
    });

    it("should throw error if Name is missing", async () => {
      const invalid = { ...validPayload, name: null };
      await expect(SpecialityService.createOne(invalid)).rejects.toThrow(
        "Speciality name is required"
      );
    });

    it("should handle nested pruning of arrays and objects", async () => {
        const complexPayload = {
            ...validPayload,
            services: [undefined, "Service A", null],
            metadata: { key: undefined, val: "B" }
        };

        const createSpy = (SpecialityModel.create as jest.Mock);

        await SpecialityService.createOne(complexPayload);

        const persisted = createSpy.mock.calls[0][0];
        expect(persisted.services).toEqual(["Service A"]);
    });
  });

  describe("createOne", () => {
    it("should create new speciality and return response", async () => {
      const res = await SpecialityService.createOne(validPayload);

      expect(SpecialityModel.create).toHaveBeenCalled();
      expect(res.created).toBe(true);
      expect((res.response as any)._id).toBeDefined();
    });

    it("should upsert existing speciality (Update by ID)", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(mockChain({ headUserId: "old-head" }));

      (SpecialityModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, headUserId: "new-head", _id: mockSpecId })
      );

      const res = await SpecialityService.createOne(validPayload);

      expect(SpecialityModel.findOneAndUpdate).toHaveBeenCalled();
      expect(res.created).toBe(false);
    });

    it("should trigger email if head user changes during creation", async () => {
      await SpecialityService.createOne(validPayload);

      await new Promise(resolve => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalledWith(
        expect.objectContaining({ templateId: "specialityHeadAssigned" })
      );
    });

    it("should NOT trigger email if head user is same", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(mockChain({ headUserId: "user-123" }));

      (SpecialityModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, headUserId: "user-123", _id: mockSpecId })
      );

      await SpecialityService.createOne(validPayload);

      await new Promise(resolve => setImmediate(resolve));
      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
    });
  });

  describe("createMany", () => {
    it("should create multiple specialities", async () => {
      const payloads = [validPayload, { ...validPayload, id: new Types.ObjectId().toHexString() }];
      const res = await SpecialityService.createMany(payloads);
      expect(res).toHaveLength(2);
    });

    it("should throw error for empty list", async () => {
      await expect(SpecialityService.createMany([])).rejects.toThrow(
        "Payload list cannot be empty"
      );
    });
  });

  describe("update", () => {
    it("should update existing speciality", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(mockChain({ headUserId: "old" }));
      (SpecialityModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, _id: mockSpecId })
      );

      const res = await SpecialityService.update(mockSpecId.toHexString(), validPayload);
      expect(res).toBeDefined();
    });

    it("should return null if not found", async () => {
      (SpecialityModel.findOneAndUpdate as jest.Mock).mockResolvedValue(null);
      const res = await SpecialityService.update(mockSpecId.toHexString(), validPayload);
      expect(res).toBeNull();
    });

    it("should trigger email on head change", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(mockChain({ headUserId: "old" }));
      (SpecialityModel.findOneAndUpdate as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, headUserId: "new", _id: mockSpecId })
      );

      await SpecialityService.update(mockSpecId.toHexString(), validPayload);
      await new Promise(resolve => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalled();
    });
  });

  describe("getById", () => {
    it("should resolve by Mongo ID", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc({ ...validPayload, _id: mockSpecId }))
      );
      const res = await SpecialityService.getById(mockSpecId.toHexString());
      expect(res).not.toBeNull();
    });

    it("should resolve by FHIR ID (string)", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(
        mockChain(mockDoc({ ...validPayload, _id: mockSpecId }))
      );
      const res = await SpecialityService.getById("fhir-123");
      expect(res).not.toBeNull();
    });

    it("should return null if not found", async () => {
      (SpecialityModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
      const res = await SpecialityService.getById(mockSpecId.toHexString());
      expect(res).toBeNull();
    });

    it("should throw if ID format is invalid", async () => {
      await expect(SpecialityService.getById("bad$id")).rejects.toThrow(
        "Invalid character in Speciality identifier"
      );
    });
  });

  describe("getAllByOrganizationId", () => {
    it("should aggregate specialities and services", async () => {
      (SpecialityModel.find as jest.Mock).mockReturnValue(
        mockChain([mockDoc({ ...validPayload, _id: mockSpecId })])
      );
      (ServiceService.listBySpeciality as jest.Mock).mockResolvedValue(["Service A"]);

      const res = await SpecialityService.getAllByOrganizationId(mockOrgId.toHexString());

      expect(res).toHaveLength(1);
      expect(res[0].services).toEqual(["Service A"]);
    });
  });

  describe("Delete Operations", () => {
    it("deleteAllByOrganizationId should call deleteMany", async () => {
      const exec = jest.fn();
      (SpecialityModel.deleteMany as jest.Mock).mockReturnValue({ exec });

      await SpecialityService.deleteAllByOrganizationId(mockOrgId.toHexString());
      expect(exec).toHaveBeenCalled();
    });

    it("deleteSpeciality should perform cascading delete", async () => {
      (SpecialityModel.findOneAndDelete as jest.Mock).mockResolvedValue(
        mockDoc({ _id: mockSpecId })
      );

      await SpecialityService.deleteSpeciality(mockSpecId.toHexString(), mockOrgId.toHexString());

      expect(ServiceService.deleteAllBySpecialityId).toHaveBeenCalledWith(mockSpecId.toString());
      expect(OrganisationRoomModel.updateMany).toHaveBeenCalled();
    });

    it("deleteSpeciality should throw if not found", async () => {
      (SpecialityModel.findOneAndDelete as jest.Mock).mockResolvedValue(null);

      await expect(
        SpecialityService.deleteSpeciality(mockSpecId.toHexString(), mockOrgId.toHexString())
      ).rejects.toThrow("Speciality not found for the organisation");
    });
  });

  describe("Email & Logger Edge Cases", () => {
    it("should log error if email sending fails", async () => {
      (SpecialityModel.create as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, headUserId: "u1", _id: mockSpecId })
      );
      (UserModel.findOne as jest.Mock).mockReturnValue({
        lean: jest.fn().mockRejectedValue(new Error("Email Fail"))
      });

      await SpecialityService.createOne(validPayload);
      await new Promise(resolve => setImmediate(resolve));

      expect(logger.error).toHaveBeenCalled();
    });

    it("should not send email if user has no email address", async () => {
      (SpecialityModel.create as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, headUserId: "u1", _id: mockSpecId })
      );
      (UserModel.findOne as jest.Mock).mockReturnValue(mockChain({ email: null }));

      await SpecialityService.createOne(validPayload);
      await new Promise(resolve => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).not.toHaveBeenCalled();
    });

    it("should handle missing organisation name gracefully in email", async () => {
       (SpecialityModel.create as jest.Mock).mockResolvedValue(
        mockDoc({ ...validPayload, headUserId: "u1", _id: mockSpecId })
      );
      (OrganizationModel.findById as jest.Mock).mockReturnValue(mockChain(null));
      (UserModel.findOne as jest.Mock).mockReturnValue(mockChain({ email: "test@test.com" }));

      await SpecialityService.createOne(validPayload);
      await new Promise(resolve => setImmediate(resolve));

      expect(EmailUtils.sendEmailTemplate).toHaveBeenCalled();
    });
  });
});