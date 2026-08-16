import { BaseAvailabilityService } from "../../src/services/base-availability.service";
import { prisma } from "src/config/prisma";

// --- Mocks ---
jest.mock("src/config/prisma", () => ({
  prisma: {
    baseAvailability: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}));

describe("BaseAvailabilityService", () => {
  const mockUserId = "user_123";
  const validSlot = { startTime: "09:00", endTime: "17:00", isAvailable: true };
  const validAvailability = [
    { dayOfWeek: "MONDAY", slots: [validSlot], organisationId: "org-1" },
    { dayOfWeek: "TUESDAY", slots: [validSlot], organisationId: "org-1" },
  ];

  // Helper to create a mock Prisma row
  const createRow = (data: any) => ({
    id: "row_id_123",
    userId: mockUserId,
    organisationId: "org-1",
    dayOfWeek: "MONDAY",
    slots: [validSlot],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...data,
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Postgres persistence", () => {
    it("create: should write via prisma", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "MONDAY" }),
      ]);

      const res = await BaseAvailabilityService.create({
        userId: mockUserId,
        availability: [validAvailability[0] as any],
      });

      expect(prisma.baseAvailability.createMany).toHaveBeenCalled();
      expect(res[0].dayOfWeek).toBe("MONDAY");
    });

    it("update: should replace via prisma", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "TUESDAY" }),
      ]);

      const res = await BaseAvailabilityService.update(mockUserId, {
        availability: [validAvailability[1] as any],
      });

      expect(prisma.baseAvailability.deleteMany).toHaveBeenCalled();
      expect(prisma.baseAvailability.createMany).toHaveBeenCalled();
      expect(res[0].dayOfWeek).toBe("TUESDAY");
    });

    it("getByUserId: should read via prisma", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "MONDAY" }),
      ]);

      const res = await BaseAvailabilityService.getByUserId(mockUserId);
      expect(res).toHaveLength(1);
      expect(res[0].dayOfWeek).toBe("MONDAY");
    });
  });

  describe("Validation Helpers (via Public Methods)", () => {
    // Testing requireUserId via getByUserId
    it("should throw if userId is not a string", async () => {
      await expect(BaseAvailabilityService.getByUserId(123)).rejects.toThrow(
        "User id is required.",
      );
    });

    it("should throw if userId contains query operators ($)", async () => {
      await expect(
        BaseAvailabilityService.getByUserId("user$id"),
      ).rejects.toThrow("Invalid character in User id.");
    });

    it("should throw if userId has invalid format", async () => {
      await expect(
        BaseAvailabilityService.getByUserId("user id"),
      ).rejects.toThrow("Invalid user id format."); // spaces not allowed
    });

    // Testing payload validation via create()
    it("create: should throw if payload.availability is not an array", async () => {
      await expect(
        BaseAvailabilityService.create({
          userId: mockUserId,
          availability: {},
        }),
      ).rejects.toThrow("Availability must be an array.");
    });

    it("create: should throw if payload.availability is empty", async () => {
      await expect(
        BaseAvailabilityService.create({
          userId: mockUserId,
          availability: [],
        }),
      ).rejects.toThrow("Availability cannot be empty.");
    });

    // Testing deep slot validation via create()
    it("create: should throw if a slot item is not an object", async () => {
      const payload = {
        userId: mockUserId,
        availability: [{ dayOfWeek: "MONDAY", slots: ["string"] }],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Slot[0] must be an object.",
      );
    });

    it("create: should throw if slot time is invalid format", async () => {
      const payload = {
        userId: mockUserId,
        availability: [
          {
            dayOfWeek: "MONDAY",
            slots: [{ startTime: "25:00", endTime: "10:00" }],
          },
        ],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Slot[0] times must be in HH:MM format.",
      );
    });

    it("create: should throw if startTime is after endTime", async () => {
      const payload = {
        userId: mockUserId,
        availability: [
          {
            dayOfWeek: "MONDAY",
            slots: [{ startTime: "10:00", endTime: "09:00" }],
          },
        ],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Slot[0].startTime must be before endTime.",
      );
    });

    it("create: should throw if isAvailable is not boolean", async () => {
      const payload = {
        userId: mockUserId,
        availability: [
          {
            dayOfWeek: "MONDAY",
            slots: [
              { startTime: "09:00", endTime: "10:00", isAvailable: "yes" },
            ],
          },
        ],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Slot[0].isAvailable must be a boolean.",
      );
    });

    it("create: should default isAvailable to true if missing", async () => {
      const payload = {
        userId: mockUserId,
        availability: [
          {
            dayOfWeek: "MONDAY",
            slots: [{ startTime: "09:00", endTime: "10:00" }],
            organisationId: "org-1",
          },
        ],
      };
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ slots: [{ startTime: "09:00", endTime: "10:00" }] }),
      ]);

      await BaseAvailabilityService.create(payload);

      const createArgs = (prisma.baseAvailability.createMany as jest.Mock).mock
        .calls[0][0];
      expect(createArgs.data[0].slots[0].isAvailable).toBe(true);
    });

    // Testing availability entry validation
    it("create: should throw if dayOfWeek is missing", async () => {
      const payload = { userId: mockUserId, availability: [{ slots: [] }] };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Availability[0].dayOfWeek is required.",
      );
    });

    it("create: should throw if dayOfWeek is invalid enum", async () => {
      const payload = {
        userId: mockUserId,
        availability: [{ dayOfWeek: "FUNDAY", slots: [] }],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Availability[0].dayOfWeek must be one of",
      );
    });

    it("create: should throw if slots is not an array", async () => {
      const payload = {
        userId: mockUserId,
        availability: [{ dayOfWeek: "MONDAY", slots: "invalid" }],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Availability[0].slots must be an array.",
      );
    });

    it("create: should throw if slots array is empty", async () => {
      const payload = {
        userId: mockUserId,
        availability: [{ dayOfWeek: "MONDAY", slots: [] }],
      };
      await expect(BaseAvailabilityService.create(payload)).rejects.toThrow(
        "Availability[0] must contain at least one slot.",
      );
    });
  });

  describe("create", () => {
    it("should create new availability if user does not exist", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "MONDAY" }),
        createRow({ dayOfWeek: "TUESDAY" }),
      ]);

      const result = await BaseAvailabilityService.create({
        userId: mockUserId,
        availability: validAvailability,
      });

      expect(prisma.baseAvailability.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        select: { id: true },
      });
      expect(prisma.baseAvailability.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].dayOfWeek).toBe("MONDAY");
    });

    it("should throw 409 if availability already exists", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce({
        id: "existing",
      });

      await expect(
        BaseAvailabilityService.create({
          userId: mockUserId,
          availability: validAvailability,
        }),
      ).rejects.toThrow("Base availability already exists for this user.");
    });
  });

  describe("update", () => {
    it("should delete old and insert new availability", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "MONDAY" }),
        createRow({ dayOfWeek: "TUESDAY" }),
      ]);

      const result = await BaseAvailabilityService.update(mockUserId, {
        availability: validAvailability,
      });

      expect(prisma.baseAvailability.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
      expect(prisma.baseAvailability.createMany).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it("should throw validation error if userId is invalid during update", async () => {
      await expect(
        BaseAvailabilityService.update("", { availability: [] }),
      ).rejects.toThrow("User id cannot be empty.");
    });
  });

  describe("getByUserId", () => {
    it("should return availability rows for the user", async () => {
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "WEDNESDAY" }),
        createRow({ dayOfWeek: "MONDAY" }),
      ]);

      const result = await BaseAvailabilityService.getByUserId(mockUserId);

      expect(prisma.baseAvailability.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { dayOfWeek: "asc" },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe("Domain mapping (buildDomainAvailabilityFromPrisma & pruneUndefined)", () => {
    it("should map the prisma row into a domain object", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "MONDAY" }),
      ]);

      const result = await BaseAvailabilityService.create({
        userId: mockUserId,
        availability: [validAvailability[0]],
      });

      expect(result[0]).toBeDefined();
      expect(result[0].dayOfWeek).toBe("MONDAY");
    });

    it("should preserve Date objects during pruning", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "MONDAY", createdAt: new Date() }),
      ]);

      const result = await BaseAvailabilityService.create({
        userId: mockUserId,
        availability: [validAvailability[0]],
      });
      expect(result[0].createdAt).toBeInstanceOf(Date);
    });
  });

  describe("Sorting Logic (sortByDayOrder)", () => {
    // This is used in create and update
    it("should sort days correctly (Monday -> Sunday)", async () => {
      (prisma.baseAvailability.findFirst as jest.Mock).mockResolvedValueOnce(
        null,
      );
      (prisma.baseAvailability.findMany as jest.Mock).mockResolvedValueOnce([
        createRow({ dayOfWeek: "SUNDAY" }),
        createRow({ dayOfWeek: "TUESDAY" }),
        createRow({ dayOfWeek: "MONDAY" }),
      ]);

      const result = await BaseAvailabilityService.create({
        userId: mockUserId,
        availability: validAvailability,
      });

      expect(result[0].dayOfWeek).toBe("MONDAY");
      expect(result[1].dayOfWeek).toBe("TUESDAY");
      expect(result[2].dayOfWeek).toBe("SUNDAY");
    });
  });
});
