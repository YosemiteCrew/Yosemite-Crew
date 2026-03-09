import { Types } from "mongoose";
import {
  ServiceService,
  ServiceServiceError,
} from "../../src/services/service.service";
import ServiceModel from "../../src/models/service";
import OrganizationModel from "../../src/models/organization";
import SpecialityModel from "../../src/models/speciality";
import { AvailabilityService } from "../../src/services/availability.service";
import helpers from "../../src/utils/helper";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);

// --- Global Mocks Setup ---
jest.mock("@yosemite-crew/types", () => ({
  ...jest.requireActual("@yosemite-crew/types"),
  toServiceResponseDTO: jest.fn((obj) => obj),
  fromServiceRequestDTO: jest.fn((obj) => obj),
}));

jest.mock("../../src/models/service", () => ({
  __esModule: true,
  default: {
    create: jest.fn(),
    findById: jest.fn(),
    find: jest.fn(),
    deleteMany: jest.fn(),
  },
}));

jest.mock("../../src/models/organization", () => ({
  __esModule: true,
  default: {
    find: jest.fn(),
  },
}));

jest.mock("../../src/models/speciality", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../../src/services/availability.service", () => ({
  __esModule: true,
  AvailabilityService: {
    getBookableSlotsForDate: jest.fn(),
  },
}));

jest.mock("../../src/utils/helper", () => ({
  __esModule: true,
  default: {
    getGeoLocation: jest.fn(),
  },
}));

// Query Chain Factory to handle Mongoose methods
const createQueryChain = (resolvedValue: any) => {
  const p = Promise.resolve(resolvedValue);
  (p as any).lean = jest.fn().mockReturnValue(p);
  (p as any).exec = jest.fn().mockResolvedValue(resolvedValue);
  (p as any).limit = jest.fn().mockReturnValue(p);
  return p;
};

// Helper for building robust Mongoose documents
const createMockDoc = (overrides = {}) => {
  const baseId = new Types.ObjectId();
  const data = {
    _id: baseId,
    organisationId: baseId,
    name: "Base Service",
    description: "Base Description",
    durationMinutes: 30,
    cost: 100,
    maxDiscount: 10,
    specialityId: baseId,
    serviceType: "STANDARD",
    observationToolId: baseId,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
  return {
    ...data,
    toObject: () => data,
    save: jest.fn().mockResolvedValue(true),
    deleteOne: jest.fn().mockResolvedValue(true),
  };
};

describe("ServiceService", () => {
  const validIdStr = new Types.ObjectId().toHexString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ServiceServiceError & ensureObjectId", () => {
    it("should set properties correctly on custom error", () => {
      const err = new ServiceServiceError("Test message", 400);
      expect(err.message).toBe("Test message");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("ServiceServiceError");
    });

    it("should throw error for invalid ObjectIds", async () => {
      await expect(ServiceService.getById("invalid-id")).rejects.toThrow(
        new ServiceServiceError("Invalid serviceId", 400),
      );
    });

    it("should allow valid ObjectIds (both string and instance)", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null); // Bypass logic
      await ServiceService.getById(validIdStr); // String
      await ServiceService.getById(new Types.ObjectId() as any); // Instance
      expect(ServiceModel.findById).toHaveBeenCalledTimes(2);
    });
  });

  describe("create", () => {
    it("should map request DTO to mongo model correctly with optional fields missing", async () => {
      const mockDoc = createMockDoc({
        description: null,
        maxDiscount: null,
        specialityId: null,
        observationToolId: null,
      });
      (ServiceModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const request = {
        organisationId: validIdStr,
        name: "New Service",
        durationMinutes: 60,
        cost: 200,
        serviceType: "STANDARD",
        isActive: true,
      };

      const res = await ServiceService.create(request as any);
      expect(ServiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: expect.any(Types.ObjectId),
          name: "New Service",
          description: null,
        }),
      );
      expect((res as any).id).toBeDefined();
    });

    it("should map request DTO with full optional fields populated", async () => {
      const mockDoc = createMockDoc();
      (ServiceModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const request = {
        organisationId: validIdStr,
        name: "Full Service",
        description: "Full",
        durationMinutes: 60,
        cost: 200,
        maxDiscount: 20,
        specialityId: validIdStr,
        serviceType: "OBSERVATION_TOOL",
        observationToolId: validIdStr,
        isActive: true,
      };

      await ServiceService.create(request as any);
      expect(ServiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          specialityId: expect.any(Types.ObjectId),
          observationToolId: expect.any(Types.ObjectId),
        }),
      );
    });
  });

  describe("getById", () => {
    it("should return null if document not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      const res = await ServiceService.getById(validIdStr);
      expect(res).toBeNull();
    });

    it("should return mapped document if found", async () => {
      const mockDoc = createMockDoc();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      const res = await ServiceService.getById(validIdStr);
      expect(res).toBeDefined();
    });
  });

  describe("listByOrganisation & listBySpeciality", () => {
    it("listByOrganisation: should query by id and return array", async () => {
      (ServiceModel.find as jest.Mock).mockResolvedValue([createMockDoc()]);
      const res = await ServiceService.listByOrganisation(validIdStr);
      expect(res).toHaveLength(1);
    });

    it("listBySpeciality: should query by id and return array", async () => {
      (ServiceModel.find as jest.Mock).mockResolvedValue([createMockDoc()]);
      const res = await ServiceService.listBySpeciality(validIdStr);
      expect(res).toHaveLength(1);
    });
  });

  describe("update", () => {
    it("should throw 404 if not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        ServiceService.update(validIdStr, {} as any),
      ).rejects.toThrow(new ServiceServiceError("Service not found", 404));
    });

    it("should apply all partial updates safely including clearing tools/speciality", async () => {
      const mockDoc = createMockDoc();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(mockDoc);

      const updates = {
        name: "Updated",
        description: "Updated Desc",
        durationMinutes: 90,
        cost: 300,
        maxDiscount: 5,
        serviceType: "STANDARD",
        observationToolId: null, // Clears it
        specialityId: validIdStr,
        isActive: false,
      };

      await ServiceService.update(validIdStr, updates as any);

      expect(mockDoc.name).toBe("Updated");
      expect(mockDoc.description).toBe("Updated Desc");
      expect(mockDoc.observationToolId).toBeNull();
      expect(mockDoc.isActive).toBe(false);
      expect(mockDoc.save).toHaveBeenCalled();
    });
  });

  describe("delete & deleteAllBySpecialityId", () => {
    it("delete: should return null if not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      const res = await ServiceService.delete(validIdStr);
      expect(res).toBeNull();
    });

    it("delete: should call deleteOne and return true", async () => {
      const mockDoc = createMockDoc();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(mockDoc);
      const res = await ServiceService.delete(validIdStr);
      expect(mockDoc.deleteOne).toHaveBeenCalled();
      expect(res).toBe(true);
    });

    it("deleteAllBySpecialityId: should call deleteMany", async () => {
      const execMock = jest.fn().mockResolvedValue(true);
      (ServiceModel.deleteMany as jest.Mock).mockReturnValue({
        exec: execMock,
      });

      await ServiceService.deleteAllBySpecialityId(validIdStr);
      expect(ServiceModel.deleteMany).toHaveBeenCalledWith({
        specialityId: validIdStr,
      });
      expect(execMock).toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("should build filter with org and query correctly", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(
        createQueryChain([createMockDoc()]),
      );

      await ServiceService.search("vet", validIdStr);

      expect(ServiceModel.find).toHaveBeenCalledWith({
        isActive: true,
        organisationId: expect.any(Types.ObjectId),
        $text: { $search: "vet" },
      });
    });

    it("should build filter without query correctly", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(
        createQueryChain([createMockDoc()]),
      );
      await ServiceService.search("", validIdStr);
      expect(ServiceModel.find).toHaveBeenCalledWith({
        isActive: true,
        organisationId: expect.any(Types.ObjectId),
      });
    });
  });

  describe("listOrganisationsProvidingService", () => {
    it("should return empty if no matching services", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createQueryChain([]));
      const res =
        await ServiceService.listOrganisationsProvidingService("unknown");
      expect(res).toEqual([]);
    });

    it("should map unique organisation ids and fetch info", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(
        createQueryChain([
          { organisationId: validIdStr },
          { organisationId: validIdStr }, // Duplicate to test Set extraction
        ]),
      );

      (OrganizationModel.find as jest.Mock).mockReturnValue(
        createQueryChain([
          {
            _id: validIdStr,
            name: "Org",
            imageURL: "url",
            phoneNo: "123",
            type: "CLINIC",
            address: "addr",
          },
        ]),
      );

      const res = await ServiceService.listOrganisationsProvidingService("vet");
      expect(res).toHaveLength(1);
      expect(res[0].name).toBe("Org");
    });
  });

  describe("getBookableSlotsService", () => {
    beforeEach(() => {
      // Lock time strictly to 2026-01-01 12:00:00 UTC
      jest.useFakeTimers({ advanceTimers: false });
      jest.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should throw if service not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        ServiceService.getBookableSlotsService(
          validIdStr,
          validIdStr,
          new Date(),
        ),
      ).rejects.toThrow("Service not found");
    });

    it("should throw if speciality not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(createMockDoc());
      (SpecialityModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(
        ServiceService.getBookableSlotsService(
          validIdStr,
          validIdStr,
          new Date(),
        ),
      ).rejects.toThrow("Speciality not found");
    });

    it("should return empty array if no vetIds in speciality", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(createMockDoc());
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({
        memberUserIds: [],
      });

      const res = await ServiceService.getBookableSlotsService(
        validIdStr,
        validIdStr,
        new Date(),
      );
      expect(res.windows).toEqual([]);
    });

    it("should fetch, deduplicate, filter past slots (when today), and sort", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(
        createMockDoc({ durationMinutes: 60 }),
      );
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({
        memberUserIds: ["vet1", "vet2"],
      });

      // Vet 1 provides a past slot (10:00) and a future slot (14:00)
      (
        AvailabilityService.getBookableSlotsForDate as jest.Mock
      ).mockResolvedValueOnce({
        windows: [
          { startTime: "10:00", endTime: "11:00", isAvailable: true }, // Past
          { startTime: "14:00", endTime: "15:00", isAvailable: true }, // Future
        ],
      });

      // Vet 2 provides the SAME future slot (14:00) and an evening slot (18:00)
      (
        AvailabilityService.getBookableSlotsForDate as jest.Mock
      ).mockResolvedValueOnce({
        windows: [
          { startTime: "14:00", endTime: "15:00", isAvailable: true }, // Duplicate
          { startTime: "18:00", endTime: "19:00", isAvailable: true }, // Future, late
        ],
      });

      // We ask for slots for "today" (2026-01-01T00:00:00Z)
      const refDate = new Date("2026-01-01T00:00:00Z");

      const res = await ServiceService.getBookableSlotsService(
        validIdStr,
        validIdStr,
        refDate,
      );

      // The 10:00 slot is filtered out because it is "today" and the clock is at 12:00.
      // The 14:00 slot is merged/deduplicated (holds both vet1 & vet2).
      // The 18:00 slot is present.
      expect(res.windows).toHaveLength(2);
      expect(res.windows[0].startTime).toBe("14:00");
      expect(res.windows[0].vetIds).toEqual(["vet1", "vet2"]); // Deduplication check
      expect(res.windows[1].startTime).toBe("18:00");
      expect(res.windows[1].vetIds).toEqual(["vet2"]);
    });

    it("should NOT filter past times if reference date is in the future", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(createMockDoc());
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({
        memberUserIds: ["vet1"],
      });

      (
        AvailabilityService.getBookableSlotsForDate as jest.Mock
      ).mockResolvedValueOnce({
        windows: [
          { startTime: "09:00", endTime: "10:00", isAvailable: true }, // Technically "past" today, but tomorrow it is valid
        ],
      });

      // Ask for slots for "tomorrow"
      const refDate = new Date("2026-01-02T00:00:00Z");

      const res = await ServiceService.getBookableSlotsService(
        validIdStr,
        validIdStr,
        refDate,
      );

      // The 09:00 slot should remain because it's for tomorrow.
      expect(res.windows).toHaveLength(1);
      expect(res.windows[0].startTime).toBe("09:00");
    });
  });

  describe("listOrganisationsProvidingServiceNearby", () => {
    it("should return empty if no matching services", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createQueryChain([]));
      const res = await ServiceService.listOrganisationsProvidingServiceNearby(
        "unknown",
        1,
        1,
      );
      expect(res).toEqual([]);
    });

    it("should geocode query if lat/lng are 0 or falsy", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValueOnce(
        createQueryChain([{ organisationId: validIdStr }]),
      ); // Matches Service
      (helpers.getGeoLocation as jest.Mock).mockResolvedValue({
        lat: 40,
        lng: -74,
      });
      (OrganizationModel.find as jest.Mock).mockReturnValue(
        createQueryChain([]),
      ); // Returns empty orgs for simplicity
      (SpecialityModel.find as jest.Mock).mockReturnValue(createQueryChain([]));
      (ServiceModel.find as jest.Mock).mockReturnValueOnce(
        createQueryChain([]),
      ); // 2nd call for services inside orgs

      await ServiceService.listOrganisationsProvidingServiceNearby(
        "vet",
        0,
        0,
        "New York",
      );

      expect(helpers.getGeoLocation).toHaveBeenCalledWith("New York");
    });

    it("should group specialities and services appropriately by organisation", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValueOnce(
        createQueryChain([{ organisationId: validIdStr }]),
      ); // Matching initial Service

      // Orgs
      (OrganizationModel.find as jest.Mock).mockReturnValue(
        createQueryChain([{ _id: validIdStr, name: "Org1" }]),
      );

      // Specialities for org
      (SpecialityModel.find as jest.Mock).mockReturnValue(
        createQueryChain([
          { _id: "spec1", organisationId: validIdStr, name: "General" },
        ]),
      );

      // Services for org
      (ServiceModel.find as jest.Mock).mockReturnValueOnce(
        createQueryChain([
          {
            _id: "serv1",
            name: "Checkup",
            specialityId: "spec1",
            organisationId: validIdStr,
          },
        ]),
      );

      const res = await ServiceService.listOrganisationsProvidingServiceNearby(
        "Checkup",
        40,
        -74,
      );

      expect(res).toHaveLength(1);
      expect(res[0].name).toBe("Org1");
      expect(res[0].specialities).toHaveLength(1);
      expect(res[0].specialities[0].name).toBe("General");
      expect(res[0].specialities[0].services).toHaveLength(1);
      expect(res[0].specialities[0].services[0].name).toBe("Checkup");
    });
  });
});
