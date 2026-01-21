import { jest, describe, it, expect, beforeEach } from "@jest/globals";
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

// ----------------------------------------------------------------------
// 1. MOCKS
// ----------------------------------------------------------------------
jest.mock("../../src/models/service");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/speciality");
jest.mock("../../src/services/availability.service");
jest.mock("../../src/utils/helper");

// Mock DTO mappers to be identity functions for easier testing
jest.mock("@yosemite-crew/types", () => ({
  __esModule: true,
  toServiceResponseDTO: jest.fn((obj) => obj),
  fromServiceRequestDTO: jest.fn((obj) => obj),
}));

// Helper to mock mongoose chaining
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockMongooseChain = (resolvedValue: any) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  chain.limit = (jest.fn() as any).mockReturnValue(chain);
  // FIX: lean should return the chain, NOT resolve immediately
  chain.lean = (jest.fn() as any).mockReturnValue(chain);
  chain.exec = (jest.fn() as any).mockResolvedValue(resolvedValue);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chain.then = (resolve: any) => Promise.resolve(resolvedValue).then(resolve);
  return chain;
};

// Helper for Mock Docs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockDoc = (data: any) => {
  const _id = data._id || new Types.ObjectId();
  // Ensure IDs are ObjectIds for strict checks
  const organisationId =
    data.organisationId instanceof Types.ObjectId
      ? data.organisationId
      : data.organisationId
        ? new Types.ObjectId(data.organisationId)
        : undefined;

  const plain = { ...data, _id, organisationId };
  return {
    ...plain,
    save: (jest.fn() as any).mockResolvedValue(plain),
    deleteOne: (jest.fn() as any).mockResolvedValue(plain),
    toObject: (jest.fn() as any).mockReturnValue(plain),
  };
};

describe("ServiceService", () => {
  const serviceId = new Types.ObjectId().toString();
  const orgId = new Types.ObjectId().toString();
  const specialityId = new Types.ObjectId().toString();
  const toolId = new Types.ObjectId().toString();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ======================================================================
  // 1. CRUD OPERATIONS
  // ======================================================================
  describe("CRUD", () => {
    it("create: should create a service", async () => {
      const dto = {
        name: "Vaccination",
        organisationId: orgId,
        cost: 100,
        durationMinutes: 15,
        isActive: true,
        specialityId,
        observationToolId: toolId,
      };

      const createdDoc = mockDoc(dto);
      (ServiceModel.create as any).mockResolvedValue(createdDoc);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ServiceService.create(dto as any);

      expect(ServiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Vaccination",
          specialityId: new Types.ObjectId(specialityId),
          observationToolId: new Types.ObjectId(toolId),
        }),
      );
      expect(result.id).toBeDefined();
    });

    it("create: should handle null optional fields", async () => {
      const dto = {
        name: "Simple",
        organisationId: orgId,
        cost: 50,
        durationMinutes: 10,
        isActive: true,
      };
      const createdDoc = mockDoc(dto);
      (ServiceModel.create as any).mockResolvedValue(createdDoc);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ServiceService.create(dto as any);

      expect(ServiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          specialityId: null,
          observationToolId: null,
        }),
      );
    });

    it("getById: should return service", async () => {
      const doc = mockDoc({ name: "Found", organisationId: orgId });
      (ServiceModel.findById as any).mockResolvedValue(doc);

      const result = await ServiceService.getById(serviceId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result as any).name).toBe("Found");
    });

    it("getById: should return null if not found", async () => {
      (ServiceModel.findById as any).mockResolvedValue(null);
      const result = await ServiceService.getById(serviceId);
      expect(result).toBeNull();
    });

    it("listByOrganisation: should return services", async () => {
      const docs = [mockDoc({ name: "A", organisationId: orgId })];
      (ServiceModel.find as any).mockResolvedValue(docs);

      const result = await ServiceService.listByOrganisation(orgId);
      expect(result).toHaveLength(1);
    });

    it("update: should update fields selectively", async () => {
      const doc = mockDoc({
        name: "Original",
        cost: 100,
        organisationId: orgId,
        isActive: true,
      });
      (ServiceModel.findById as any).mockResolvedValue(doc);

      const updates = {
        name: "Updated",
        cost: 200,
        description: "New Desc",
        specialityId,
        observationToolId: toolId,
        isActive: false,
        serviceType: "Consultation",
        maxDiscount: 10,
        durationMinutes: 60,
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await ServiceService.update(serviceId, updates as any);

      expect(doc.name).toBe("Updated");
      expect(doc.cost).toBe(200);
      expect(doc.description).toBe("New Desc");
      expect(doc.specialityId).toEqual(new Types.ObjectId(specialityId));
      expect(doc.isActive).toBe(false);
      expect(doc.save).toHaveBeenCalled();
    });

    it("update: should handle clearing optional fields", async () => {
      const doc = mockDoc({
        name: "Orig",
        organisationId: orgId,
        observationToolId: toolId,
      });
      (ServiceModel.findById as any).mockResolvedValue(doc);

      // Update with null/falsey values
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await ServiceService.update(serviceId, {
        observationToolId: null,
      } as any);

      expect(doc.observationToolId).toBeNull();
    });

    it("update: should throw if not found", async () => {
      (ServiceModel.findById as any).mockResolvedValue(null);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await expect(ServiceService.update(serviceId, {} as any)).rejects.toThrow(
        "Service not found",
      );
    });

    it("delete: should delete doc", async () => {
      const doc = mockDoc({ organisationId: orgId });
      (ServiceModel.findById as any).mockResolvedValue(doc);

      const res = await ServiceService.delete(serviceId);
      expect(res).toBe(true);
      expect(doc.deleteOne).toHaveBeenCalled();
    });

    it("delete: should return null if missing", async () => {
      (ServiceModel.findById as any).mockResolvedValue(null);
      const res = await ServiceService.delete(serviceId);
      expect(res).toBeNull();
    });

    it("deleteAllBySpecialityId: should call deleteMany", async () => {
      (ServiceModel.deleteMany as any).mockReturnValue({ exec: jest.fn() });
      await ServiceService.deleteAllBySpecialityId(specialityId);
      expect(ServiceModel.deleteMany).toHaveBeenCalledWith({ specialityId });
    });
  });

  // ======================================================================
  // 2. SEARCH & LISTING HELPERS
  // ======================================================================
  describe("Search & Listing", () => {
    it("search: should query with text search and org filter", async () => {
      (ServiceModel.find as any).mockReturnValue(mockMongooseChain([]));

      await ServiceService.search("vaccine", orgId);

      expect(ServiceModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          organisationId: new Types.ObjectId(orgId),
          $text: { $search: "vaccine" },
        }),
      );
    });

    it("listBySpeciality: should query by specialityId", async () => {
      (ServiceModel.find as any).mockResolvedValue([]);
      await ServiceService.listBySpeciality(specialityId);
      expect(ServiceModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          specialityId: new Types.ObjectId(specialityId),
        }),
      );
    });

    it("listOrganisationsProvidingService: should aggregate distinct orgs", async () => {
      const s1 = { organisationId: new Types.ObjectId(orgId) };
      const s2 = { organisationId: new Types.ObjectId(orgId) }; // Duplicate to test Set
      (ServiceModel.find as any).mockReturnValue(mockMongooseChain([s1, s2]));

      (OrganizationModel.find as any).mockReturnValue(
        mockMongooseChain([{ _id: new Types.ObjectId(orgId), name: "Org 1" }]),
      );

      const res =
        await ServiceService.listOrganisationsProvidingService("vaccine");

      expect(res).toHaveLength(1);
      expect(res[0].name).toBe("Org 1");
    });

    it("listOrganisationsProvidingService: returns empty if no services found", async () => {
      (ServiceModel.find as any).mockReturnValue(mockMongooseChain([]));
      const res =
        await ServiceService.listOrganisationsProvidingService("unknown");
      expect(res).toEqual([]);
    });
  });

  // ======================================================================
  // 3. SLOT BOOKING LOGIC (Complex)
  // ======================================================================
  describe("getBookableSlotsService", () => {
    it("should throw if service or speciality not found", async () => {
      (ServiceModel.findById as any).mockResolvedValue(null);
      await expect(
        ServiceService.getBookableSlotsService(serviceId, orgId, new Date()),
      ).rejects.toThrow("Service not found");

      (ServiceModel.findById as any).mockResolvedValue({ specialityId });
      (SpecialityModel.findById as any).mockResolvedValue(null);
      await expect(
        ServiceService.getBookableSlotsService(serviceId, orgId, new Date()),
      ).rejects.toThrow("Speciality not found");
    });

    it("should return empty if no vets in speciality", async () => {
      (ServiceModel.findById as any).mockResolvedValue({ specialityId });
      (SpecialityModel.findById as any).mockResolvedValue({
        memberUserIds: [],
      });

      const res = await ServiceService.getBookableSlotsService(
        serviceId,
        orgId,
        new Date(),
      );
      expect(res.windows).toEqual([]);
    });

    it("should aggregate slots from multiple vets and deduplicate", async () => {
      const vet1 = "vet1";
      const vet2 = "vet2";
      const date = new Date("2025-01-01T12:00:00Z");

      (ServiceModel.findById as any).mockResolvedValue({
        specialityId,
        durationMinutes: 15,
      });
      (SpecialityModel.findById as any).mockResolvedValue({
        memberUserIds: [vet1, vet2],
      });

      // Mock AvailabilityService to return slots
      // vet1 has slot at 10:00
      // vet2 has slot at 10:00 (overlap) and 11:00
      (AvailabilityService.getBookableSlotsForDate as any).mockImplementation(
        (_oid: any, vid: any) => {
          if (vid === vet1)
            return { windows: [{ startTime: "10:00", endTime: "10:15" }] };
          if (vid === vet2)
            return {
              windows: [
                { startTime: "10:00", endTime: "10:15" },
                { startTime: "11:00", endTime: "11:15" },
              ],
            };
          return { windows: [] };
        },
      );

      const res = await ServiceService.getBookableSlotsService(
        serviceId,
        orgId,
        date,
      );

      // Should have 2 unique time slots: 10:00 and 11:00
      expect(res.windows).toHaveLength(2);

      // 10:00 slot should have both vets
      const slot10 = res.windows.find((w) => w.startTime === "10:00");
      expect(slot10?.vetIds).toHaveLength(2);
      expect(slot10?.vetIds).toContain(vet1);
      expect(slot10?.vetIds).toContain(vet2);

      // 11:00 slot should have only vet2
      const slot11 = res.windows.find((w) => w.startTime === "11:00");
      expect(slot11?.vetIds).toHaveLength(1);
      expect(slot11?.vetIds).toContain(vet2);
    });

    it("should filter past slots if querying for today", async () => {
      const today = dayjs().utc().startOf("day").toDate();
      // Mock current time handling by relying on logic: logic compares string timestamps.
      // We provide a slot that is definitely 'past' relative to the test runtime (00:00)
      // and one that is definitely 'future' (23:59).

      const pastSlot = { startTime: "00:00", endTime: "00:15" };
      const futureSlot = { startTime: "23:59", endTime: "23:59" };

      (ServiceModel.findById as any).mockResolvedValue({
        specialityId,
        durationMinutes: 15,
      });
      (SpecialityModel.findById as any).mockResolvedValue({
        memberUserIds: ["v1"],
      });
      (AvailabilityService.getBookableSlotsForDate as any).mockResolvedValue({
        windows: [pastSlot, futureSlot],
      });

      const res = await ServiceService.getBookableSlotsService(
        serviceId,
        orgId,
        today,
      );

      // Should filter out 00:00, keep 23:59
      expect(res.windows.find((w) => w.startTime === "00:00")).toBeUndefined();
      expect(res.windows.find((w) => w.startTime === "23:59")).toBeDefined();
    });
  });

  // ======================================================================
  // 4. COMPLEX AGGREGATION
  // ======================================================================
  describe("listOrganisationsProvidingServiceNearby", () => {
    it("should aggregate orgs, specialities, and services", async () => {
      // 1. Find matched services
      const matchedSvc = [{ organisationId: new Types.ObjectId(orgId) }];
      (ServiceModel.find as any).mockReturnValue(mockMongooseChain(matchedSvc));

      // 2. Mock Geolocation if lat/lng missing
      (helpers.getGeoLocation as any).mockResolvedValue({ lat: 10, lng: 20 });

      // 3. Find Orgs
      const orgDoc = {
        _id: new Types.ObjectId(orgId),
        name: "Vet Clinic",
        address: {},
      };
      (OrganizationModel.find as any).mockReturnValue(
        mockMongooseChain([orgDoc]),
      );

      // 4. Find All Specialities
      const specDoc = {
        _id: new Types.ObjectId(specialityId),
        name: "General",
        organisationId: new Types.ObjectId(orgId),
      };
      // First find inside helper, Second find for all specialities
      (SpecialityModel.find as any).mockReturnValue(
        mockMongooseChain([specDoc]),
      );

      // 5. Find All Services for Orgs (re-mock ServiceModel.find for second call)
      const srvDoc = {
        _id: new Types.ObjectId(serviceId),
        name: "Checkup",
        specialityId: new Types.ObjectId(specialityId),
        organisationId: new Types.ObjectId(orgId),
      };

      // ServiceModel.find is called TWICE.
      // 1st call: search regex -> matchedSvc
      // 2nd call: fetch all services -> srvDoc
      (ServiceModel.find as any)
        .mockReturnValueOnce(mockMongooseChain(matchedSvc)) // search
        .mockReturnValueOnce(mockMongooseChain([srvDoc])); // grouping

      const res = await ServiceService.listOrganisationsProvidingServiceNearby(
        "Checkup",
        0,
        0,
        "City",
      );

      expect(helpers.getGeoLocation).toHaveBeenCalledWith("City");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(orgId);
      expect(res[0].specialities).toHaveLength(1);
      expect(res[0].specialities[0].services).toHaveLength(1);
      expect(res[0].specialities[0].services[0].name).toBe("Checkup");
    });

    it("should return empty if no matching services found", async () => {
      (ServiceModel.find as any).mockReturnValue(mockMongooseChain([]));
      const res = await ServiceService.listOrganisationsProvidingServiceNearby(
        "Unknown",
        10,
        10,
      );
      expect(res).toEqual([]);
    });
  });

  // ======================================================================
  // 5. ERROR UTILS
  // ======================================================================
  describe("Utils", () => {
    it("ensureObjectId: should throw on invalid ID", async () => {
      await expect(ServiceService.getById("invalid-id")).rejects.toThrow(
        "Invalid serviceId",
      );
    });
  });
});
