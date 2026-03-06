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

// --- 1. Mocks ---
jest.mock("../../src/models/service");
jest.mock("../../src/models/organization");
jest.mock("../../src/models/speciality");
jest.mock("../../src/services/availability.service");
jest.mock("../../src/utils/helper", () => ({
  __esModule: true,
  default: {
    getGeoLocation: jest.fn(),
  },
}));

jest.mock("escape-string-regexp", () => jest.fn((str) => str));

// Mock DTO mappers to be identity functions for easier testing
jest.mock("@yosemite-crew/types", () => ({
  fromServiceRequestDTO: jest.fn((dto) => dto),
  toServiceResponseDTO: jest.fn((dto) => ({ ...dto, mapped: true })),
}));

// --- 2. Query Helpers ---
const createMockQuery = (val: any) => {
  const promise = Promise.resolve(val);
  Object.assign(promise, {
    lean: jest.fn().mockReturnValue(promise),
    exec: jest.fn().mockReturnValue(promise),
    limit: jest.fn().mockReturnValue(promise),
  });
  return promise;
};

// Strongly typing the mock to ensure TypeScript doesn't throw on assertions
const makeMockDoc = (overrides: any = {}, toObjectOverrides: any = {}) => {
  const _id = new Types.ObjectId();
  const obj = {
    _id,
    organisationId: new Types.ObjectId(),
    name: "Test Service",
    description: "A description",
    durationMinutes: 30,
    cost: 100,
    maxDiscount: 10,
    specialityId: new Types.ObjectId(),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...toObjectOverrides,
  };

  return {
    ...obj,
    toObject: jest.fn().mockReturnValue(obj),
    save: jest.fn().mockResolvedValue(true),
    deleteOne: jest.fn().mockResolvedValue(true),
    ...overrides,
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

  describe("ServiceServiceError & ensureObjectId", () => {
    it("instantiates error correctly", () => {
      const err = new ServiceServiceError("Msg", 400);
      expect(err.message).toBe("Msg");
      expect(err.statusCode).toBe(400);
    });

    it("throws 400 for invalid ObjectId format", async () => {
      await expect(ServiceService.getById("invalid-id")).rejects.toThrow(
        /Invalid serviceId/
      );
    });

    it("accepts existing Types.ObjectId directly", async () => {
      const oid = new Types.ObjectId();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(makeMockDoc());
      await ServiceService.getById(oid as any);
      expect(ServiceModel.findById).toHaveBeenCalledWith(oid);
    });
  });

  describe("create", () => {
    it("creates a service with all optional fields", async () => {
      const mockDoc = makeMockDoc();
      (ServiceModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const dto: any = {
        organisationId: new Types.ObjectId().toString(),
        name: "Test",
        description: "Desc",
        durationMinutes: 30,
        cost: 100,
        maxDiscount: 10,
        specialityId: new Types.ObjectId().toString(),
        isActive: true,
      };

      const res = await ServiceService.create(dto);

      expect(ServiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: "Desc",
          maxDiscount: 10,
          specialityId: expect.any(Types.ObjectId),
        })
      );
      expect(res).toHaveProperty("mapped", true);
    });

    it("creates a service falling back on missing optional fields", async () => {
      const mockDoc = makeMockDoc(
        {},
        { description: undefined, maxDiscount: undefined, specialityId: undefined }
      );
      (ServiceModel.create as jest.Mock).mockResolvedValue(mockDoc);

      const dto: any = {
        organisationId: new Types.ObjectId().toString(),
        name: "Minimal",
        durationMinutes: 15,
        cost: 50,
        isActive: true,
      };

      // By casting to 'any' we bypass strict DTO definitions on the assert
      const res = await ServiceService.create(dto) as any;

      expect(ServiceModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
          maxDiscount: null,
          specialityId: null,
        })
      );

      expect(res.description).toBeNull();
      expect(res.maxDiscount).toBeNull();
      expect(res.specialityId).toBeNull();
    });
  });

  describe("getById", () => {
    it("returns null if not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      expect(await ServiceService.getById(new Types.ObjectId().toString())).toBeNull();
    });

    it("returns mapped domain object if found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(makeMockDoc());
      const res = await ServiceService.getById(new Types.ObjectId().toString());
      expect(res).toHaveProperty("mapped", true);
    });
  });

  describe("listByOrganisation", () => {
    it("returns mapped list", async () => {
      (ServiceModel.find as jest.Mock).mockResolvedValue([makeMockDoc()]);
      const res = await ServiceService.listByOrganisation(new Types.ObjectId().toString());
      expect(res).toHaveLength(1);
    });

  describe("update", () => {
    const validId = new Types.ObjectId().toString();

    it("throws 404 if service not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(ServiceService.update(validId, {} as any)).rejects.toThrow(
        /not found/
      );
    });

    it("updates all fields when provided", async () => {
      const doc = makeMockDoc();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(doc);

      const updates: any = {
        name: "New Name",
        description: "New Desc",
        durationMinutes: 45,
        cost: 200,
        maxDiscount: 20,
        specialityId: new Types.ObjectId().toString(),
        isActive: false,
      };

      await ServiceService.update(validId, updates);

      expect(doc.name).toBe("New Name");
      expect(doc.description).toBe("New Desc");
      expect(doc.durationMinutes).toBe(45);
      expect(doc.cost).toBe(200);
      expect(doc.maxDiscount).toBe(20);
      expect(doc.isActive).toBe(false);
      expect(doc.save).toHaveBeenCalled();
    });

    it("safely skips update blocks when fields are undefined/null", async () => {
      const doc = makeMockDoc();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(doc);

      const emptyUpdates: any = {};
      await ServiceService.update(validId, emptyUpdates);

      expect(doc.name).toBe("Test Service");
      expect(doc.save).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    it("returns null if not found", async () => {
      (ServiceModel.findById as jest.Mock).mockResolvedValue(null);
      expect(await ServiceService.delete(new Types.ObjectId().toString())).toBeNull();
    });

    it("deletes document if found", async () => {
      const doc = makeMockDoc();
      (ServiceModel.findById as jest.Mock).mockResolvedValue(doc);
      expect(await ServiceService.delete(new Types.ObjectId().toString())).toBe(true);
      expect(doc.deleteOne).toHaveBeenCalled();
    });
  });

  describe("search", () => {
    it("filters by org and uses $text when both query and org provided", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createMockQuery([makeMockDoc()]));
      const orgId = new Types.ObjectId().toString();
      await ServiceService.search("vaccine", orgId);

      expect(ServiceModel.find).toHaveBeenCalledWith({
        isActive: true,
        organisationId: expect.any(Types.ObjectId),
        $text: { $search: "vaccine" }
      });
    });

    it("skips org and text filters if both omitted", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createMockQuery([]));
      await ServiceService.search("");
      expect(ServiceModel.find).toHaveBeenCalledWith({ isActive: true });
    });

    it("filters by org only when query is empty", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createMockQuery([]));
      await ServiceService.search("", new Types.ObjectId().toString());
      expect(ServiceModel.find).toHaveBeenCalledWith(expect.objectContaining({
        isActive: true,
        organisationId: expect.any(Types.ObjectId)
      }));
    });

    it("filters by text only when org is missing", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createMockQuery([]));
      await ServiceService.search("vaccine");
      expect(ServiceModel.find).toHaveBeenCalledWith({
        isActive: true,
        $text: { $search: "vaccine" }
      });
    });
  });

  describe("listBySpeciality", () => {
    it("returns mapped list", async () => {
      (ServiceModel.find as jest.Mock).mockResolvedValue([makeMockDoc()]);
      const res = await ServiceService.listBySpeciality(new Types.ObjectId().toString());
      expect(res).toHaveLength(1);
    });
  });

  describe("listOrganisationsProvidingService", () => {
    it("returns empty array if no services match", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createMockQuery([]));
      expect(await ServiceService.listOrganisationsProvidingService("X")).toEqual([]);
    });

    it("fetches unique organisations for matched services", async () => {
      const orgId = new Types.ObjectId().toString();
      (ServiceModel.find as jest.Mock).mockReturnValue(
        createMockQuery([{ organisationId: orgId }, { organisationId: orgId }])
      );
      (OrganizationModel.find as jest.Mock).mockReturnValue(
        createMockQuery([{ _id: orgId, name: "Org1", imageURL: "img", phoneNo: "123", type: "HOSPITAL", address: "123 St" }])
      );

      const res = await ServiceService.listOrganisationsProvidingService("Vet");

      expect(res).toHaveLength(1);
      expect(res[0].id).toBe(orgId);
      expect(res[0].name).toBe("Org1");
    });
  });

  describe("getBookableSlotsService", () => {
    const validServiceId = new Types.ObjectId().toString();
    const validOrgId = new Types.ObjectId().toString();

    it("throws if service not found", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue(null);
      await expect(ServiceService.getBookableSlotsService(validServiceId, validOrgId, new Date())).rejects.toThrow("Service not found");
    });

    it("throws if speciality not found", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ specialityId: new Types.ObjectId(), durationMinutes: 30 });
      (SpecialityModel.findById as jest.Mock).mockResolvedValue(null);
      await expect(ServiceService.getBookableSlotsService(validServiceId, validOrgId, new Date())).rejects.toThrow("Speciality not found");
    });

    it("returns empty windows if speciality has no memberUserIds", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ specialityId: new Types.ObjectId(), durationMinutes: 30 });
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({ memberUserIds: [] });

      const res = await ServiceService.getBookableSlotsService(validServiceId, validOrgId, new Date());
      expect(res.windows).toEqual([]);
    });

    it("fetches slots, filters past slots (using fixed timers), deduplicates, and sorts", async () => {
      // FREEZE TIME so daylight saving and execution time doesn't break the test
      jest.useFakeTimers().setSystemTime(new Date("2026-03-06T12:00:00Z"));

      // Dynamically generate times around the mocked system clock
      const pastTime = dayjs().utc().subtract(2, 'hour').format('HH:mm');
      const futureTime1 = dayjs().utc().add(2, 'hour').format('HH:mm');
      const futureTime2 = dayjs().utc().add(3, 'hour').format('HH:mm');

      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ specialityId: new Types.ObjectId(), durationMinutes: 30 });
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({ memberUserIds: ["vet1", "vet2"] });

      (AvailabilityService.getBookableSlotsForDate as jest.Mock)
        .mockResolvedValueOnce({ windows: [{ startTime: pastTime, endTime: "xx" }, { startTime: futureTime1, endTime: "yy" }] })
        .mockResolvedValueOnce({ windows: [{ startTime: futureTime1, endTime: "yy" }, { startTime: futureTime2, endTime: "zz" }] });
      jest.useRealTimers(); // Cleanup
    });

    it("keeps all slots if referenceDate is not today", async () => {
      const futureDate = dayjs().utc().add(1, 'day').toDate();
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ specialityId: new Types.ObjectId(), durationMinutes: 30 });
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({ memberUserIds: ["vet1"] });

      (AvailabilityService.getBookableSlotsForDate as jest.Mock).mockResolvedValue({
        windows: [{ startTime: "01:00", endTime: "02:00" }, { startTime: "08:00", endTime: "09:00" }]
      });

      const res = await ServiceService.getBookableSlotsService(validServiceId, validOrgId, futureDate);
      expect(res.windows).toHaveLength(2);
    });

    it("safely handles undefined windows returned by AvailabilityService", async () => {
      (ServiceModel.findOne as jest.Mock).mockResolvedValue({ specialityId: new Types.ObjectId(), durationMinutes: 30 });
      (SpecialityModel.findById as jest.Mock).mockResolvedValue({ memberUserIds: ["vet1"] });
      (AvailabilityService.getBookableSlotsForDate as jest.Mock).mockResolvedValue(null);

      const res = await ServiceService.getBookableSlotsService(validServiceId, validOrgId, new Date());
      expect(res.windows).toEqual([]);
    });
  });

  describe("listOrganisationsProvidingServiceNearby", () => {
    it("returns empty array if no services match", async () => {
      (ServiceModel.find as jest.Mock).mockReturnValue(createMockQuery([]));
      expect(await ServiceService.listOrganisationsProvidingServiceNearby("X", 10, 10)).toEqual([]);
    });

    it("skips geocoding if lat and lng are provided", async () => {
      const orgId = new Types.ObjectId();
      const specId = new Types.ObjectId();

      (ServiceModel.find as jest.Mock)
        .mockReturnValueOnce(createMockQuery([{ organisationId: orgId }]))
        .mockReturnValueOnce(createMockQuery([{ organisationId: orgId, specialityId: specId, name: "S1" }]));

      (OrganizationModel.find as jest.Mock).mockReturnValue(createMockQuery([{ _id: orgId, name: "Org1" }]));
      (SpecialityModel.find as jest.Mock).mockReturnValue(createMockQuery([{ _id: specId, organisationId: orgId, name: "Spec1" }]));

      await ServiceService.listOrganisationsProvidingServiceNearby("Vet", 40, -73);

      expect(helpers.getGeoLocation).not.toHaveBeenCalled(); // Geocoding skipped!
      expect(OrganizationModel.find).toHaveBeenCalledWith(
        expect.objectContaining({
          "address.location": {
            $near: { $geometry: { type: "Point", coordinates: [-73, 40] }, $maxDistance: 5000 }
          }
        })
      );
    });

    it("geocodes if lat/lng are not provided (0)", async () => {
      const orgId = new Types.ObjectId();
      const specId = new Types.ObjectId();

      (ServiceModel.find as jest.Mock)
        .mockReturnValueOnce(createMockQuery([{ organisationId: orgId }]))
        .mockReturnValueOnce(createMockQuery([{ organisationId: orgId, specialityId: specId, name: "S1" }]));

      (helpers.getGeoLocation as jest.Mock).mockResolvedValue({ lat: 40, lng: -73 });

      (OrganizationModel.find as jest.Mock).mockReturnValue(createMockQuery([{ _id: orgId, name: "Org1" }]));
      (SpecialityModel.find as jest.Mock).mockReturnValue(createMockQuery([{ _id: specId, organisationId: orgId, name: "Spec1" }]));

      const res = await ServiceService.listOrganisationsProvidingServiceNearby("Vet", 0, 0, "New York");

      expect(helpers.getGeoLocation).toHaveBeenCalledWith("New York");
      expect(res).toHaveLength(1);
      expect(res[0].specialities).toHaveLength(1);
      expect(res[0].specialities[0].services).toHaveLength(1);
    });
  });
});