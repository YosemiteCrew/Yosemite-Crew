import {
  createCalendarPrefillCache,
  getCalendarPrefillMatchesCached,
} from "../../../src/services/shared/service-availability";
import { AvailabilityService } from "../../../src/services/availability.service";
import { prisma } from "src/config/prisma";

jest.mock("../../../src/services/availability.service", () => ({
  __esModule: true,
  AvailabilityService: {
    getBookableSlotsForDate: jest.fn(),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    userProfile: {
      findFirst: jest.fn(),
    },
  },
}));

const requireSafeString = (value: string, field: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`Invalid ${field}`);
  }
  return trimmed;
};

const makeInput = (
  overrides: Partial<{
    organisationId: string;
    date: Date;
    minuteOfDay: number;
    leadId?: string;
    serviceIds: string[];
  }> = {},
) => ({
  organisationId: "org-1",
  date: new Date("2026-04-01T00:00:00.000Z"),
  minuteOfDay: 5,
  serviceIds: ["svc-1"],
  ...overrides,
});

describe("getCalendarPrefillMatchesCached", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns an empty list without resolving contexts when no service ids remain", async () => {
    const cache = createCalendarPrefillCache();
    const resolveSchedulingContext = jest.fn();

    const matches = await getCalendarPrefillMatchesCached({
      input: makeInput({ serviceIds: [] }),
      cache,
      requireSafeString,
      resolveSchedulingContext,
    });

    expect(matches).toEqual([]);
    expect(resolveSchedulingContext).not.toHaveBeenCalled();
    expect(cache.size).toBe(0);
  });

  it("propagates the caller's validation error for unsafe service ids", async () => {
    const cache = createCalendarPrefillCache();

    await expect(
      getCalendarPrefillMatchesCached({
        input: makeInput({ serviceIds: ["  "] }),
        cache,
        requireSafeString,
        resolveSchedulingContext: jest.fn(),
      }),
    ).rejects.toThrow("Invalid serviceId");
  });

  it("dedupes service ids, resolves the org timezone and maps context ids onto serviceId", async () => {
    (prisma.userProfile.findFirst as jest.Mock).mockResolvedValueOnce({
      personalDetails: { timezone: "UTC" },
    });
    (AvailabilityService.getBookableSlotsForDate as jest.Mock)
      .mockResolvedValueOnce({ windows: [] })
      .mockResolvedValueOnce({
        windows: [{ startTime: "00:05", endTime: "00:20", isAvailable: true }],
      })
      .mockResolvedValueOnce({ windows: [] });

    const cache = createCalendarPrefillCache();
    const resolveSchedulingContext = jest.fn().mockResolvedValue({
      serviceId: "resolved-1",
      organisationId: "org-1",
      durationMinutes: 15,
      vetIds: ["vet-1"],
    });

    const matches = await getCalendarPrefillMatchesCached({
      input: makeInput({ serviceIds: ["svc-1", " svc-1 ", "svc-1"] }),
      cache,
      requireSafeString,
      resolveSchedulingContext,
    });

    expect(matches).toEqual([
      {
        serviceId: "resolved-1",
        slot: {
          startTime: "00:05",
          endTime: "00:20",
          vetIds: ["vet-1"],
        },
        meta: {
          localStartMinute: 5,
          localEndMinute: 20,
        },
      },
    ]);
    expect(resolveSchedulingContext).toHaveBeenCalledTimes(1);
    expect(resolveSchedulingContext).toHaveBeenCalledWith("svc-1", "org-1");
    expect(prisma.userProfile.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1" },
      select: { personalDetails: true },
    });
    expect(AvailabilityService.getBookableSlotsForDate).toHaveBeenCalledTimes(
      3,
    );
  });

  it("serves repeated identical requests from the cache", async () => {
    (prisma.userProfile.findFirst as jest.Mock).mockResolvedValue({
      personalDetails: { timezone: "UTC" },
    });
    (
      AvailabilityService.getBookableSlotsForDate as jest.Mock
    ).mockResolvedValue({ windows: [] });

    const cache = createCalendarPrefillCache();
    const resolveSchedulingContext = jest.fn().mockResolvedValue({
      serviceId: "resolved-1",
      organisationId: "org-1",
      durationMinutes: 15,
      vetIds: ["vet-1"],
    });

    const params = {
      input: makeInput(),
      cache,
      requireSafeString,
      resolveSchedulingContext,
    };

    const first = await getCalendarPrefillMatchesCached(params);
    const second = await getCalendarPrefillMatchesCached(params);

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(resolveSchedulingContext).toHaveBeenCalledTimes(1);
    expect(cache.size).toBe(1);
  });

  it("uses the lead profile timezone and filters slots that do not include the lead", async () => {
    (prisma.userProfile.findFirst as jest.Mock)
      // lead lookup has no timezone -> falls back to the organisation lookup
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ personalDetails: { timezone: "UTC" } });
    (AvailabilityService.getBookableSlotsForDate as jest.Mock)
      .mockResolvedValueOnce({ windows: [] })
      .mockResolvedValueOnce({ windows: [] })
      .mockResolvedValueOnce({
        windows: [{ startTime: "00:05", endTime: "00:20", isAvailable: true }],
      })
      .mockResolvedValueOnce({ windows: [] })
      .mockResolvedValueOnce({ windows: [] })
      .mockResolvedValueOnce({ windows: [] });

    const cache = createCalendarPrefillCache();
    const resolveSchedulingContext = jest.fn().mockResolvedValue({
      serviceId: "resolved-1",
      organisationId: "org-1",
      durationMinutes: 15,
      vetIds: ["vet-1", "vet-2"],
    });

    const matches = await getCalendarPrefillMatchesCached({
      input: makeInput({ leadId: "vet-2" }),
      cache,
      requireSafeString,
      resolveSchedulingContext,
    });

    // The only available slot belongs to vet-1, so the vet-2 lead filter
    // removes it.
    expect(matches).toEqual([]);
    expect(prisma.userProfile.findFirst).toHaveBeenNthCalledWith(1, {
      where: { organizationId: "org-1", userId: "vet-2" },
      select: { personalDetails: true },
    });
  });
});
