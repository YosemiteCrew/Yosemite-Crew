import { Types } from "mongoose";
import {
  OrganisationRoomService,
  OrganisationRoomServiceError,
} from "../../src/services/organisation-room.service";
import OrganisationRoomModel from "../../src/models/organisation-room";

// --- Mocks ---
jest.mock("../../src/models/organisation-room");

// Mock Types helpers
jest.mock("@yosemite-crew/types", () => ({
  fromOrganisationRoomRequestDTO: jest.fn((dto) => dto),
  toOrganisationRoomResponseDTO: jest.fn((domain) => domain),
}));

// --- Helper: Mongoose Chain Mock ---
const mockChain = (result: any = null) => {
  return {
    lean: jest.fn().mockResolvedValue(result),
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  } as any;
};

// --- Helper: Mock Document ---
const mockDoc = (data: any) => ({
  ...data,
  toObject: jest.fn(() => data),
});

describe("OrganisationRoomService", () => {
  let mockOrgId: Types.ObjectId;
  let mockRoomId: Types.ObjectId;
  let validPayload: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockOrgId = new Types.ObjectId();
    mockRoomId = new Types.ObjectId();

    validPayload = {
      resourceType: "Location",
      id: mockRoomId.toHexString(),
      organisationId: mockOrgId.toHexString(),
      name: "Consultation Room 1",
      type: "CONSULTATION",
      assignedStaffs: ["staff-1", "staff-2"],
      assignedSpecialiteis: ["spec-1"],
    };

    // Default Mongoose Mocks with proper _id structure
    (OrganisationRoomModel.findOne as jest.Mock).mockReturnValue(mockChain(null));
    (OrganisationRoomModel.find as jest.Mock).mockReturnValue(mockChain([]));
    (OrganisationRoomModel.create as jest.Mock).mockResolvedValue(
      mockDoc({ ...validPayload, _id: mockRoomId })
    );
    (OrganisationRoomModel.findOneAndUpdate as jest.Mock).mockReturnValue(
      mockChain(mockDoc({ ...validPayload, _id: mockRoomId }))
    );
    (OrganisationRoomModel.findOneAndDelete as jest.Mock).mockReturnValue(
      mockChain(mockDoc({ ...validPayload, _id: mockRoomId }))
    );
  });

  describe("Validation & Internals", () => {
    it("should throw error if payload resourceType is invalid", async () => {
      const invalid = { ...validPayload, resourceType: "Patient" };
      await expect(OrganisationRoomService.create(invalid)).rejects.toThrow(
        "Invalid payload. Expected FHIR Location resource."
      );
    });

    it("should throw error if Organisation ID is invalid", async () => {
      const invalid = { ...validPayload, organisationId: "invalid$id" };
      await expect(OrganisationRoomService.create(invalid)).rejects.toThrow(
        "Invalid character in Organisation identifier"
      );
    });

    it("should throw error if Room Name is missing or empty", async () => {
      await expect(
        OrganisationRoomService.create({ ...validPayload, name: null })
      ).rejects.toThrow("Room name is required");

      await expect(
        OrganisationRoomService.create({ ...validPayload, name: "   " })
      ).rejects.toThrow("Room name cannot be empty");
    });

    it("should throw error if Room Type is invalid", async () => {
      const invalid = { ...validPayload, type: "CAFETERIA" }; // Not in allowed Set
      await expect(OrganisationRoomService.create(invalid)).rejects.toThrow(
        "Room type must be one of: CONSULTATION, WAITING_AREA, SURGERY, ICU"
      );
    });

    it("should validate and prune arrays (assignedStaffs)", async () => {
        // Target: sanitizeIdList logic
        const payloadWithBadStaff = {
            ...validPayload,
            // Provide ID to force update path if logic prefers update, or remove ID to force create
            // The service checks `identifier` (from payload.id)
            id: undefined,
            assignedStaffs: ["staff-1", null, undefined, "", "staff-2"]
        };

        const createSpy = (OrganisationRoomModel.create as jest.Mock);

        await OrganisationRoomService.create(payloadWithBadStaff);

        const persistedData = createSpy.mock.calls[0][0];
        expect(persistedData.assignedStaffs).toHaveLength(2);
        expect(persistedData.assignedStaffs).toEqual(["staff-1", "staff-2"]);
    });

    it("should handle pruning of nested objects", async () => {
       // Mock DTO helper to return structure with undefineds
       jest.requireMock("@yosemite-crew/types").fromOrganisationRoomRequestDTO.mockReturnValueOnce({
           ...validPayload,
           id: undefined, // Force create path
           meta: {
               version: undefined,
               tag: "test"
           }
       });

       const createSpy = (OrganisationRoomModel.create as jest.Mock);

       await OrganisationRoomService.create({ ...validPayload, id: undefined });

       // Verify create was called (pruning didn't crash)
       expect(createSpy).toHaveBeenCalled();

       // Restore mock behavior
       jest.requireMock("@yosemite-crew/types").fromOrganisationRoomRequestDTO.mockImplementation((dto: any) => dto);
    });
  });

  describe("create", () => {
    it("should create new room if ID not provided (or not found)", async () => {
      const payloadNoId = { ...validPayload, id: undefined };

      const res = await OrganisationRoomService.create(payloadNoId);

      expect(OrganisationRoomModel.create).toHaveBeenCalled();
      expect(res.created).toBe(true);
      expect(res.response).toBeDefined();
    });

    it("should upsert (update) room if ID is provided", async () => {
      // Mock findOneAndUpdate returning a valid doc with _id
      (OrganisationRoomModel.findOneAndUpdate as jest.Mock).mockReturnValue(
         mockChain(mockDoc({ ...validPayload, _id: mockRoomId, name: "Updated Name" }))
      );

      const res = await OrganisationRoomService.create(validPayload);

      expect(OrganisationRoomModel.findOneAndUpdate).toHaveBeenCalledWith(
        { fhirId: mockRoomId.toHexString() },
        expect.anything(),
        expect.anything()
      );
      expect(res.created).toBe(false);
      expect(res.response.name).toBe("Updated Name");
    });

    it("should fallback to create if upsert returns null", async () => {
        // First try update -> null
        (OrganisationRoomModel.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(null));
        // Then create -> doc
        (OrganisationRoomModel.create as jest.Mock).mockResolvedValue(mockDoc({ ...validPayload, _id: mockRoomId }));

        const res = await OrganisationRoomService.create(validPayload);

        expect(OrganisationRoomModel.create).toHaveBeenCalled();
        expect(res.created).toBe(true);
    });
  });

  describe("update", () => {
    it("should update existing room", async () => {
      const res = await OrganisationRoomService.update(mockRoomId.toHexString(), validPayload);
      expect(res).toBeDefined();
      expect(OrganisationRoomModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it("should return null if room to update not found", async () => {
      (OrganisationRoomModel.findOneAndUpdate as jest.Mock).mockReturnValue(mockChain(null));
      const res = await OrganisationRoomService.update(mockRoomId.toHexString(), validPayload);
      expect(res).toBeNull();
    });

    it("should throw if update ID format is invalid", async () => {
        await expect(OrganisationRoomService.update("bad$id", validPayload))
            .rejects.toThrow("Invalid character in Room identifier");
    });
  });

  describe("getAllByOrganizationId", () => {
    it("should return list of rooms", async () => {
      (OrganisationRoomModel.find as jest.Mock).mockReturnValue(mockChain([
          mockDoc({ ...validPayload, _id: new Types.ObjectId() }),
          mockDoc({ ...validPayload, _id: new Types.ObjectId() })
      ]));

      const res = await OrganisationRoomService.getAllByOrganizationId(mockOrgId.toHexString());
      expect(res).toHaveLength(2);
    });
  });

  describe("deleteAllByOrganizationId", () => {
    it("should delete all rooms", async () => {
      (OrganisationRoomModel.deleteMany as jest.Mock).mockReturnValue(
          mockChain({ acknowledged: true, deletedCount: 5 })
      );

      await OrganisationRoomService.deleteAllByOrganizationId(mockOrgId.toHexString());
      expect(OrganisationRoomModel.deleteMany).toHaveBeenCalled();
    });

    it("should throw 500 if delete result is not acknowledged", async () => {
      (OrganisationRoomModel.deleteMany as jest.Mock).mockReturnValue(
          mockChain({ acknowledged: false })
      );

      await expect(
        OrganisationRoomService.deleteAllByOrganizationId(mockOrgId.toHexString())
      ).rejects.toThrow("Failed to delete organisation rooms");
    });
  });

  describe("delete", () => {
    it("should delete room by ID", async () => {
      const res = await OrganisationRoomService.delete(mockRoomId.toHexString());
      expect(res).toBeDefined();
      expect(OrganisationRoomModel.findOneAndDelete).toHaveBeenCalled();
    });

    it("should return null if room not found", async () => {
      (OrganisationRoomModel.findOneAndDelete as jest.Mock).mockReturnValue(mockChain(null));
      const res = await OrganisationRoomService.delete(mockRoomId.toHexString());
      expect(res).toBeNull();
    });

    it("should validate ID format before delete", async () => {
        await expect(OrganisationRoomService.delete("invalid id with spaces"))
            .rejects.toThrow("Invalid room identifier format");
    });
  });
});