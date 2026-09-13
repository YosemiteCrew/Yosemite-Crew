import { describe, expect, it } from "@jest/globals";
import {
  buildBookableWindowsForVets,
  buildCalendarPrefillMatches,
  extractTimezoneFromPersonalDetails,
  mapOrganisationWithAddress,
  normalizeSlotForSelectedDay,
  resolveOrganisationTimezone,
  utcClockTimeToTimezoneClock,
} from "../../src/utils/scheduling";

describe("scheduling utils", () => {
  it("extracts trimmed timezone values from personal details", () => {
    expect(
      extractTimezoneFromPersonalDetails({ timezone: "  Asia/Kolkata  " }),
    ).toBe("Asia/Kolkata");
  });

  it("returns null for missing or invalid timezone values", () => {
    expect(extractTimezoneFromPersonalDetails(undefined)).toBeNull();
    expect(extractTimezoneFromPersonalDetails({ timezone: 42 })).toBeNull();
    expect(extractTimezoneFromPersonalDetails({ timezone: "   " })).toBeNull();
  });

  it("converts UTC clock time into an offset timezone clock", () => {
    expect(
      utcClockTimeToTimezoneClock(
        "01:30",
        "UTC+02:00",
        new Date("2026-01-15T00:00:00.000Z"),
      ),
    ).toEqual({ minutes: 210, dayOffset: 0 });
  });

  it("uses the appointment date when applying timezone daylight saving", () => {
    expect(
      utcClockTimeToTimezoneClock(
        "13:00",
        "America/New_York",
        new Date("2026-07-15T00:00:00.000Z"),
      ),
    ).toEqual({ minutes: 540, dayOffset: 1 });
  });

  it("normalizes a slot into the selected day window", () => {
    expect(
      normalizeSlotForSelectedDay({
        timezone: "UTC+02:00",
        referenceDate: new Date("2026-01-15T00:00:00.000Z"),
        utcDateShift: 0,
        slot: {
          startTime: "00:30",
          endTime: "01:30",
        },
      }),
    ).toEqual({
      localStartMinute: 150,
      localEndMinute: 210,
    });
  });

  it("returns null when the slot falls outside the selected day", () => {
    expect(
      normalizeSlotForSelectedDay({
        timezone: "UTC",
        referenceDate: new Date("2026-01-15T00:00:00.000Z"),
        utcDateShift: -1,
        slot: {
          startTime: "00:30",
          endTime: "01:30",
        },
      }),
    ).toBeNull();
  });

  it("maps organisation address fields with defaults", () => {
    expect(
      mapOrganisationWithAddress({
        id: "org-1",
        name: "Clinic",
        imageUrl: "https://example.com/image.png",
        phoneNo: null,
        type: "HOSPITAL",
        address: {
          city: "Pune",
          country: "IN",
          addressLine: null,
          state: null,
          postalCode: null,
          latitude: null,
          longitude: null,
        },
      }),
    ).toMatchObject({
      id: "org-1",
      name: "Clinic",
      imageURL: "https://example.com/image.png",
      phoneNo: undefined,
      appointmentCheckInBufferMinutes: 5,
      appointmentCheckInRadiusMeters: 200,
      address: {
        city: "Pune",
        country: "IN",
      },
    });
  });

  it("resolves timezone using lead details first then organisation details", async () => {
    const timezone = await resolveOrganisationTimezone({
      organisationId: "org-1",
      leadId: "lead-1",
      getLeadPersonalDetails: async () => ({ timezone: "Asia/Kolkata" }),
      getOrganisationPersonalDetails: async () => ({ timezone: "UTC" }),
    });

    expect(timezone).toBe("Asia/Kolkata");

    const fallbackTimezone = await resolveOrganisationTimezone({
      organisationId: "org-1",
      getLeadPersonalDetails: async () => null,
      getOrganisationPersonalDetails: async () => ({
        timezone: "  UTC+02:00 ",
      }),
    });

    expect(fallbackTimezone).toBe("UTC+02:00");
  });

  it("builds bookable windows and merges vet ids by slot", async () => {
    // Use a fixed future date so the same-day "past slot" filter in
    // buildBookableWindowsForVets never activates, keeping this test
    // deterministic regardless of the clock when it runs.
    const referenceDate = new Date("2999-06-21T00:00:00.000Z");
    const result = await buildBookableWindowsForVets({
      organisationId: "org-1",
      vetIds: ["vet-1", "vet-2"],
      durationMinutes: 30,
      referenceDate,
      getBookableSlotsForDate: async (_organisationId, vetId) => ({
        date: "2026-06-20",
        dayOfWeek: "SATURDAY",
        windows:
          vetId === "vet-1"
            ? [
                {
                  startTime: "09:00",
                  endTime: "09:30",
                },
              ]
            : [
                {
                  startTime: "09:00",
                  endTime: "09:30",
                },
              ],
      }),
    });

    expect(result.windows).toHaveLength(1);
    expect(result.windows[0]?.vetIds).toEqual(["vet-1", "vet-2"]);
  });

  it("builds calendar prefill matches for a shared slot", async () => {
    const matches = await buildCalendarPrefillMatches({
      inputDate: new Date("2026-06-20T00:00:00.000Z"),
      timezone: "UTC",
      minuteOfDay: 540,
      leadId: "vet-1",
      contexts: [
        {
          matchId: "service-1",
          organisationId: "org-1",
          durationMinutes: 30,
          vetIds: ["vet-1"],
        },
      ],
      utcDateShifts: [-1, 0, 1] as const,
      getBookableWindows: async () => ({
        date: "2026-06-20",
        dayOfWeek: "SATURDAY",
        windows: [
          {
            startTime: "09:00",
            endTime: "09:30",
            vetIds: ["vet-1"],
          },
        ],
      }),
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      matchId: "service-1",
      slot: {
        startTime: "09:00",
        endTime: "09:30",
        vetIds: ["vet-1"],
      },
      meta: {
        localStartMinute: 540,
        localEndMinute: 570,
      },
    });
  });

  it("matches calendar prefills using the target date's daylight saving offset", async () => {
    const matches = await buildCalendarPrefillMatches({
      inputDate: new Date("2026-07-15T00:00:00.000Z"),
      timezone: "Europe/Paris",
      minuteOfDay: 900,
      contexts: [
        {
          matchId: "service-1",
          organisationId: "org-1",
          durationMinutes: 30,
          vetIds: ["vet-1"],
        },
      ],
      utcDateShifts: [0] as const,
      getBookableWindows: async () => ({
        date: "2026-07-15",
        dayOfWeek: "WEDNESDAY",
        windows: [{ startTime: "13:00", endTime: "13:30", vetIds: ["vet-1"] }],
      }),
    });

    expect(matches[0]?.meta).toEqual({
      localStartMinute: 900,
      localEndMinute: 930,
    });
  });

  it("matches a negative-offset DST slot only via the correct candidate-day shift", async () => {
    // Regression test for #3140 using the issue's own example timezone.
    // America/New_York is a negative offset, so the day that actually
    // lands a UTC-midnight-anchored slot in range is one day before the
    // requested date (utcDateShift -1) - buildCalendarPrefillMatches must
    // search that shift and use its DST rule (EDT) to find the match. An
    // epoch-anchored (always EST) conversion would compute 08:00 local
    // instead of 09:00 and miss this match entirely.
    const matches = await buildCalendarPrefillMatches({
      inputDate: new Date("2026-07-15T00:00:00.000Z"),
      timezone: "America/New_York",
      minuteOfDay: 9 * 60,
      leadId: "vet-1",
      contexts: [
        {
          matchId: "service-1",
          organisationId: "org-1",
          durationMinutes: 30,
          vetIds: ["vet-1"],
        },
      ],
      utcDateShifts: [-1, 0, 1] as const,
      getBookableWindows: async () => ({
        date: "2026-07-15",
        dayOfWeek: "WEDNESDAY",
        windows: [{ startTime: "13:00", endTime: "13:30", vetIds: ["vet-1"] }],
      }),
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({
      matchId: "service-1",
      meta: {
        localStartMinute: 9 * 60,
        localEndMinute: 9 * 60 + 30,
      },
    });
  });

  it("filters lead mismatches and out-of-tolerance slots from prefill matches", async () => {
    const matches = await buildCalendarPrefillMatches({
      inputDate: new Date("2026-06-20T00:00:00.000Z"),
      timezone: "UTC",
      minuteOfDay: 540,
      leadId: "vet-1",
      contexts: [
        {
          matchId: "service-1",
          organisationId: "org-1",
          durationMinutes: 30,
          vetIds: ["vet-1", "vet-2"],
        },
      ],
      utcDateShifts: [0] as const,
      getBookableWindows: async () => ({
        date: "2026-06-20",
        dayOfWeek: "SATURDAY",
        windows: [
          // Belongs to another vet: removed by the lead filter.
          { startTime: "09:00", endTime: "09:30", vetIds: ["vet-2"] },
          // More than 5 minutes from minuteOfDay: removed by the tolerance
          // filter.
          { startTime: "12:00", endTime: "12:30", vetIds: ["vet-1"] },
          { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
        ],
      }),
    });

    expect(matches).toHaveLength(1);
    expect(matches[0]?.slot).toEqual({
      startTime: "09:00",
      endTime: "09:30",
      vetIds: ["vet-1"],
    });
  });

  it("sorts prefill matches by start minute, end minute, then match id", async () => {
    const matches = await buildCalendarPrefillMatches({
      inputDate: new Date("2026-06-20T00:00:00.000Z"),
      timezone: "UTC",
      minuteOfDay: 540,
      contexts: [
        {
          matchId: "service-b",
          organisationId: "org-1",
          durationMinutes: 30,
          vetIds: ["vet-1"],
        },
        {
          matchId: "service-a",
          organisationId: "org-1",
          durationMinutes: 30,
          vetIds: ["vet-1"],
        },
      ],
      utcDateShifts: [0] as const,
      getBookableWindows: async () => ({
        date: "2026-06-20",
        dayOfWeek: "SATURDAY",
        windows: [
          { startTime: "09:04", endTime: "09:30", vetIds: ["vet-1"] },
          { startTime: "09:00", endTime: "09:45", vetIds: ["vet-1"] },
          { startTime: "09:00", endTime: "09:30", vetIds: ["vet-1"] },
        ],
      }),
    });

    expect(
      matches.map((match) => [
        match.matchId,
        match.meta.localStartMinute,
        match.meta.localEndMinute,
      ]),
    ).toEqual([
      ["service-a", 540, 570],
      ["service-b", 540, 570],
      ["service-a", 540, 585],
      ["service-b", 540, 585],
      ["service-a", 544, 570],
      ["service-b", 544, 570],
    ]);
  });
});
