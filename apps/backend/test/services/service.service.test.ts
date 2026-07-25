import {
  ServiceService,
  ServiceServiceError,
} from "../../src/services/service.service";
import { AvailabilityService } from "../../src/services/availability.service";
import helpers from "../../src/utils/helper";
import { prisma } from "src/config/prisma";

// --- Global Mocks Setup ---
jest.mock("@yosemite-crew/types", () => ({
  ...jest.requireActual("@yosemite-crew/types"),
  toServiceResponseDTO: jest.fn((obj) => obj),
  fromServiceRequestDTO: jest.fn((obj) => obj),
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

jest.mock("src/config/prisma", () => ({
  prisma: {
    service: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    organization: {
      findMany: jest.fn(),
    },
    speciality: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    userProfile: {
      findFirst: jest.fn(),
    },
  },
}));

// Plain Prisma "service" row factory (the persistence layer is Postgres-only).
const makeServiceRecord = (overrides: Record<string, unknown> = {}) => ({
  id: "svc-1",
  organisationId: "org-1",
  name: "Base Service",
  description: null,
  durationMinutes: 30,
  cost: 100,
  maxDiscount: null,
  specialityId: "spec-1",
  serviceType: "STANDARD",
  observationToolId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("ServiceService", () => {
  const validIdStr = "svc-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("ServiceServiceError & id validation", () => {
    it("should set properties correctly on custom error", () => {
      const err = new ServiceServiceError("Test message", 400);
      expect(err.message).toBe("Test message");
      expect(err.statusCode).toBe(400);
      expect(err.name).toBe("ServiceServiceError");
    });

    it("should reject ids containing unsafe characters", async () => {
      await expect(ServiceService.getById("bad$id")).rejects.toThrow(
        new ServiceServiceError("Invalid serviceId", 400),
      );
    });

    it("should reject empty ids", async () => {
      await expect(ServiceService.getById("")).rejects.toThrow(
        new ServiceServiceError("Invalid serviceId", 400),
      );
    });
  });

  describe("create", () => {
    it("should map request DTO to prisma create with optional fields missing", async () => {
      (prisma.service.create as jest.Mock).mockResolvedValue(
        makeServiceRecord(),
      );

      const request = {
        organisationId: validIdStr,
        name: "New Service",
        durationMinutes: 60,
        cost: 200,
        serviceType: "STANDARD",
        isActive: true,
      };

      const res = await ServiceService.create(request as any);
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          organisationId: validIdStr,
          name: "New Service",
          durationMinutes: 60,
          cost: 200,
          serviceType: "STANDARD",
          isActive: true,
        }),
      });
      expect((res as any).id).toBeDefined();
    });

    it("should map request DTO with full optional fields populated", async () => {
      (prisma.service.create as jest.Mock).mockResolvedValue(
        makeServiceRecord(),
      );

      const request = {
        organisationId: validIdStr,
        name: "Full Service",
        description: "Full",
        durationMinutes: 60,
        cost: 200,
        maxDiscount: 20,
        specialityId: "spec-9",
        serviceType: "OBSERVATION_TOOL",
        observationToolId: "obs-9",
        isActive: true,
      };

      await ServiceService.create(request as any);
      expect(prisma.service.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          specialityId: "spec-9",
          observationToolId: "obs-9",
          maxDiscount: 20,
        }),
      });
    });
  });

  describe("getById", () => {
    it("should return null if document not found", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
      const res = await ServiceService.getById(validIdStr);
      expect(res).toBeNull();
    });

    it("should return mapped record if found", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord({ id: "pg-1" }),
      );
      const res = await ServiceService.getById("pg-1");
      expect(res).toMatchObject({ id: "pg-1" });
      expect(prisma.service.findFirst).toHaveBeenCalledWith({
        where: { id: "pg-1" },
      });
    });
  });

  describe("listByOrganisation & listBySpeciality", () => {
    it("listByOrganisation: queries prisma by org id and returns array", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([
        makeServiceRecord({ id: "pg-1" }),
      ]);

      const res = await ServiceService.listByOrganisation("org-1");
      expect(res).toHaveLength(1);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { organisationId: "org-1", isActive: true },
      });
    });

    it("listBySpeciality: queries prisma by speciality id and returns array", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([
        makeServiceRecord({ id: "pg-1", specialityId: "spec-1" }),
      ]);

      const res = await ServiceService.listBySpeciality("spec-1");
      expect(res).toHaveLength(1);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: { specialityId: "spec-1", isActive: true },
      });
    });
  });

  describe("update", () => {
    it("should throw 404 if not found", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        ServiceService.update(validIdStr, {} as any),
      ).rejects.toThrow(new ServiceServiceError("Service not found", 404));
    });

    it("should apply all partial updates safely including clearing tools", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord(),
      );
      (prisma.service.update as jest.Mock).mockResolvedValue(
        makeServiceRecord({ name: "Updated", isActive: false }),
      );

      const updates = {
        name: "Updated",
        description: "Updated Desc",
        durationMinutes: 90,
        cost: 300,
        maxDiscount: 5,
        serviceType: "STANDARD",
        observationToolId: null, // Clears it
        specialityId: "spec-2",
        isActive: false,
      };

      await ServiceService.update(validIdStr, updates as any);

      expect(prisma.service.update).toHaveBeenCalledWith({
        where: { id: validIdStr },
        data: expect.objectContaining({
          name: "Updated",
          description: "Updated Desc",
          durationMinutes: 90,
          cost: 300,
          maxDiscount: 5,
          observationToolId: null,
          specialityId: "spec-2",
          isActive: false,
        }),
      });
    });

    it("throws if id is unsafe", async () => {
      await expect(ServiceService.update("bad$id", {} as any)).rejects.toThrow(
        "Invalid serviceId",
      );
    });
  });

  describe("delete & deleteAllBySpecialityId", () => {
    it("delete: should return null if nothing was deleted", async () => {
      (prisma.service.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
      const res = await ServiceService.delete(validIdStr);
      expect(res).toBeNull();
    });

    it("delete: should call deleteMany and return true", async () => {
      (prisma.service.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
      const res = await ServiceService.delete(validIdStr);
      expect(prisma.service.deleteMany).toHaveBeenCalledWith({
        where: { id: validIdStr },
      });
      expect(res).toBe(true);
    });

    it("deleteAllBySpecialityId: should call deleteMany", async () => {
      (prisma.service.deleteMany as jest.Mock).mockResolvedValue({ count: 2 });

      await ServiceService.deleteAllBySpecialityId(validIdStr);
      expect(prisma.service.deleteMany).toHaveBeenCalledWith({
        where: { specialityId: validIdStr },
      });
    });
  });

  describe("organisation scoping (cross-tenant IDOR guard)", () => {
    const orgA = "org-a";
    const orgB = "org-b";

    it("update: allows updating a service in the caller's own org", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord({ organisationId: orgA }),
      );
      (prisma.service.update as jest.Mock).mockResolvedValue(
        makeServiceRecord({ organisationId: orgA, name: "X" }),
      );

      await ServiceService.update(validIdStr, { name: "X" } as any, orgA);

      expect(prisma.service.update).toHaveBeenCalled();
    });

    it("update: editor in org A gets 404 for a service in org B", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord({ organisationId: orgB }),
      );

      await expect(
        ServiceService.update(validIdStr, { name: "X" } as any, orgA),
      ).rejects.toThrow(new ServiceServiceError("Service not found", 404));
      expect(prisma.service.update).not.toHaveBeenCalled();
    });

    it("delete: removes a service scoped to the caller's own org", async () => {
      (prisma.service.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await ServiceService.delete(validIdStr, orgA);

      expect(res).toBe(true);
      expect(prisma.service.deleteMany).toHaveBeenCalledWith({
        where: { id: validIdStr, organisationId: orgA },
      });
    });

    it("delete: editor in org A gets a no-op (null) for a service in org B", async () => {
      (prisma.service.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });

      const res = await ServiceService.delete(validIdStr, orgA);

      expect(res).toBeNull();
      expect(prisma.service.deleteMany).toHaveBeenCalledWith({
        where: { id: validIdStr, organisationId: orgA },
      });
    });

    it("delete: preserves unscoped behaviour for callers that omit organisationId", async () => {
      (prisma.service.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });

      const res = await ServiceService.delete(validIdStr);

      expect(res).toBe(true);
      expect(prisma.service.deleteMany).toHaveBeenCalledWith({
        where: { id: validIdStr },
      });
    });
  });

  describe("search", () => {
    it("uses prisma with org and query filter", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([
        makeServiceRecord({ id: "pg-1" }),
      ]);

      const res = await ServiceService.search("vet", "org-1");
      expect(res).toHaveLength(1);
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          organisationId: "org-1",
          name: { contains: "vet", mode: "insensitive" },
        },
        take: 50,
      });
    });

    it("uses prisma without a query filter", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([]);

      await ServiceService.search("", "org-1");
      expect(prisma.service.findMany).toHaveBeenCalledWith({
        where: {
          isActive: true,
          organisationId: "org-1",
        },
        take: 50,
      });
    });
  });

  describe("listOrganisationsProvidingService", () => {
    it("should return empty if no matching services", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([]);
      const res =
        await ServiceService.listOrganisationsProvidingService("unknown");
      expect(res).toEqual([]);
    });

    it("should map unique organisation ids and fetch info", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([
        { organisationId: "org-1" },
        { organisationId: "org-1" }, // Duplicate to exercise Set extraction
      ]);
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([
        {
          id: "org-1",
          name: "Org",
          imageUrl: null,
          phoneNo: null,
          type: "CLINIC",
          address: null,
        },
      ]);

      const res = await ServiceService.listOrganisationsProvidingService("vet");
      expect(res).toHaveLength(1);
      expect(res[0].id).toBe("org-1");
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
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        ServiceService.getBookableSlotsService(validIdStr, "org-1", new Date()),
      ).rejects.toThrow("Service not found");
    });

    it("should throw if speciality not found", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord(),
      );
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        ServiceService.getBookableSlotsService(validIdStr, "org-1", new Date()),
      ).rejects.toThrow("Speciality not found");
    });

    it("should return empty array if no vetIds in speciality", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord(),
      );
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
        id: "spec-1",
        memberUserIds: [],
      });

      const res = await ServiceService.getBookableSlotsService(
        validIdStr,
        "org-1",
        new Date(),
      );
      expect(res.windows).toEqual([]);
    });

    it("should fetch, deduplicate, filter past slots (when today), and sort", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord({ durationMinutes: 60 }),
      );
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
        id: "spec-1",
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
        "org-1",
        refDate,
      );

      // The 10:00 slot is filtered out because it is "today" and the clock is at 12:00.
      // The 14:00 slot is merged/deduplicated (holds both vet1 & vet2).
      // The 18:00 slot is present.
      expect(res.windows).toHaveLength(2);
      expect(res.windows[0].startTime).toBe("14:00");
      expect((res.windows[0] as any).vetIds).toEqual(["vet1", "vet2"]); // Deduplication check
      expect(res.windows[1].startTime).toBe("18:00");
      expect((res.windows[1] as any).vetIds).toEqual(["vet2"]);
    });

    it("should NOT filter past times if reference date is in the future", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord(),
      );
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
        id: "spec-1",
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
        "org-1",
        refDate,
      );

      // The 09:00 slot should remain because it's for tomorrow.
      expect(res.windows).toHaveLength(1);
      expect(res.windows[0].startTime).toBe("09:00");
    });
  });

  describe("getCalendarPrefillMatches", () => {
    it("matches selected-day slots using org-local minutes converted from UTC clock strings", async () => {
      (prisma.service.findFirst as jest.Mock).mockResolvedValue(
        makeServiceRecord({
          id: validIdStr,
          organisationId: validIdStr,
          specialityId: "spec-1",
          durationMinutes: 15,
        }),
      );
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue({
        personalDetails: { timezone: "Asia/Kolkata" },
      });
      (prisma.speciality.findFirst as jest.Mock).mockResolvedValue({
        id: "spec-1",
        memberUserIds: ["vet-1", "vet-2"],
      });
      (AvailabilityService.getBookableSlotsForDate as jest.Mock)
        .mockResolvedValueOnce({
          windows: [
            { startTime: "18:35", endTime: "18:50", isAvailable: true },
          ],
        })
        .mockResolvedValueOnce({
          windows: [
            { startTime: "18:35", endTime: "18:50", isAvailable: true },
          ],
        })
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({ windows: [] });

      const matches = await ServiceService.getCalendarPrefillMatches({
        organisationId: validIdStr,
        date: new Date("2026-04-01T00:00:00.000Z"),
        minuteOfDay: 5,
        serviceIds: [validIdStr],
      });

      expect(matches).toEqual([
        {
          serviceId: validIdStr,
          slot: {
            startTime: "18:35",
            endTime: "18:50",
            vetIds: ["vet-1", "vet-2"],
          },
          meta: {
            localStartMinute: 5,
            localEndMinute: 20,
          },
        },
      ]);
      expect(prisma.userProfile.findFirst).toHaveBeenCalledWith({
        where: { organizationId: validIdStr },
        select: { personalDetails: true },
      });
      expect(AvailabilityService.getBookableSlotsForDate).toHaveBeenCalledTimes(
        6,
      );
    });

    it("uses the lead profile timezone when leadId is provided and preserves local cross-midnight meta", async () => {
      const serviceAId = "svc-a";
      const serviceBId = "svc-b";
      const orgId = "org-1";

      (prisma.service.findFirst as jest.Mock)
        .mockResolvedValueOnce(
          makeServiceRecord({
            id: serviceAId,
            organisationId: orgId,
            specialityId: "spec-a",
            durationMinutes: 15,
          }),
        )
        .mockResolvedValueOnce(
          makeServiceRecord({
            id: serviceBId,
            organisationId: orgId,
            specialityId: "spec-b",
            durationMinutes: 15,
          }),
        );

      (prisma.speciality.findFirst as jest.Mock)
        .mockResolvedValueOnce({ id: "spec-a", memberUserIds: ["vet-1"] })
        .mockResolvedValueOnce({ id: "spec-b", memberUserIds: ["vet-2"] });
      (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce({
        personalDetails: { timezone: "Asia/Kolkata" },
      });

      (AvailabilityService.getBookableSlotsForDate as jest.Mock)
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({
          windows: [
            { startTime: "18:15", endTime: "18:30", isAvailable: true },
          ],
        })
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({ windows: [] })
        .mockResolvedValueOnce({ windows: [] });

      const matches = await ServiceService.getCalendarPrefillMatches({
        organisationId: orgId,
        date: new Date("2026-04-01T00:00:00.000Z"),
        minuteOfDay: 1425,
        leadId: "vet-1",
        serviceIds: [serviceAId, serviceBId],
      });

      expect(matches).toEqual([
        {
          serviceId: serviceAId,
          slot: {
            startTime: "18:15",
            endTime: "18:30",
            vetIds: ["vet-1"],
          },
          meta: {
            localStartMinute: 1425,
            localEndMinute: 1440,
          },
        },
      ]);
      expect(prisma.userProfile.findFirst).toHaveBeenNthCalledWith(1, {
        where: { organizationId: orgId, userId: "vet-1" },
        select: { personalDetails: true },
      });
    });
  });

  describe("listOrganisationsProvidingServiceNearby", () => {
    it("should return empty if no matching services", async () => {
      (prisma.service.findMany as jest.Mock).mockResolvedValue([]);
      const res = await ServiceService.listOrganisationsProvidingServiceNearby(
        "unknown",
        1,
        1,
      );
      expect(res).toEqual([]);
    });

    it("should geocode query if lat/lng are 0 or falsy", async () => {
      (prisma.service.findMany as jest.Mock)
        .mockResolvedValueOnce([{ organisationId: "org-1" }]) // matched services
        .mockResolvedValueOnce([]); // services for orgs
      (helpers.getGeoLocation as jest.Mock).mockResolvedValue({
        lat: 40,
        lng: -74,
      });
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.speciality.findMany as jest.Mock).mockResolvedValue([]);

      await ServiceService.listOrganisationsProvidingServiceNearby(
        "vet",
        0,
        0,
        "New York",
      );

      expect(helpers.getGeoLocation).toHaveBeenCalledWith("New York");
    });

    it("should group specialities and services appropriately by organisation", async () => {
      (prisma.service.findMany as jest.Mock)
        .mockResolvedValueOnce([{ organisationId: "org-1" }]) // matched services
        .mockResolvedValueOnce([
          {
            id: "srv-1",
            name: "Checkup",
            cost: 50,
            specialityId: "spec-1",
            organisationId: "org-1",
          },
        ]); // services for orgs
      (prisma.organization.findMany as jest.Mock).mockResolvedValue([
        {
          id: "org-1",
          name: "Org1",
          imageUrl: null,
          phoneNo: null,
          type: "CLINIC",
          address: { latitude: 40, longitude: -74 },
        },
      ]);
      (prisma.speciality.findMany as jest.Mock).mockResolvedValue([
        { id: "spec-1", name: "General", organisationId: "org-1" },
      ]);

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
