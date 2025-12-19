import {
  formatUtcTimeToLocalLabel,
  generateTimeOptions,
  timeOptions,
  timeIndex,
  getTimeLabelFromValue,
  convertAvailability,
  convertFromGetApi,
  hasAtLeastOneAvailability,
  DEFAULT_INTERVAL,
  AvailabilityState,
  ApiDayAvailability,
} from "@/app/components/Availability/utils";

describe("Availability Utils", () => {
  describe("formatUtcTimeToLocalLabel", () => {
    it("returns the value as is if it is empty", () => {
      expect(formatUtcTimeToLocalLabel("")).toBe("");
    });

    it("returns the value as is if the date is invalid", () => {
      // "25:00" or random strings usually result in Invalid Date for the specific constructor format used
      expect(formatUtcTimeToLocalLabel("invalid-time")).toBe("invalid-time");
    });

    it("formats a valid UTC time string to local label", () => {
      // Note: This output depends on the machine's timezone running the test.
      // We check that it returns a non-empty string different from the input
      // and contains AM/PM (assuming en-US locale as per code).
      const result = formatUtcTimeToLocalLabel("14:30");
      expect(result).not.toBe("14:30");
      expect(result).toMatch(/(AM|PM)/);
    });
  });

  describe("generateTimeOptions", () => {
    it("generates time options for 24 hours with 15-minute intervals plus 23:59", () => {
      const options = generateTimeOptions();
      // (24 hours * 4 slots) + 1 extra slot for 23:59 = 97 slots
      expect(options).toHaveLength(97);

      // Check first entry
      expect(options[0].value).toBe("00:00");

      // Check an arbitrary entry
      const midDay = options.find(o => o.value === "12:00");
      expect(midDay).toBeDefined();

      // Check last entry
      expect(options[options.length - 1].value).toBe("23:59");
    });
  });

  describe("Constants exports", () => {
    it("exports timeOptions and timeIndex correctly", () => {
      expect(timeOptions.length).toBe(97);
      expect(timeIndex.size).toBe(97);
      expect(timeIndex.get("00:00")).toBe(0);
    });
  });

  describe("getTimeLabelFromValue", () => {
    it("returns the label from timeOptions if value exists", () => {
      // 00:00 usually formats to "12:00 AM" or "00:00" depending on locale,
      // but we ensure it matches the generated option's label.
      const expectedLabel = timeOptions.find((o) => o.value === "00:00")?.label;
      expect(getTimeLabelFromValue("00:00")).toBe(expectedLabel);
    });

    it("formats the value manually if it does not exist in timeOptions", () => {
      // "12:01" is not in the 15-min generated blocks
      const val = "12:01";
      const result = getTimeLabelFromValue(val);
      // Should fallback to the formatter function
      expect(result).toMatch(/(AM|PM)/);
    });
  });

  describe("convertAvailability (UI to API)", () => {
    it("converts availability state to API format, filtering disabled days", () => {
      const input: AvailabilityState = {
        Monday: {
          enabled: true,
          intervals: [{ start: "09:00", end: "10:00" }],
        },
        Tuesday: {
          enabled: false,
          intervals: [{ start: "09:00", end: "17:00" }],
        },
        Wednesday: {
          enabled: true,
          // Interval missing start/end should be filtered
          intervals: [
            { start: "10:00", end: "11:00" },
            { start: "", end: "12:00" },
          ],
        },
      };

      const result = convertAvailability(input);

      expect(result.availabilities).toHaveLength(2); // Mon and Wed

      // Monday Check
      const monday = result.availabilities.find((a) => a.dayOfWeek === "MONDAY");
      expect(monday).toBeDefined();
      expect(monday?.slots).toEqual([{ startTime: "09:00", endTime: "10:00" }]);

      // Wednesday Check
      const wednesday = result.availabilities.find((a) => a.dayOfWeek === "WEDNESDAY");
      expect(wednesday?.slots).toHaveLength(1); // Invalid slot removed
      expect(wednesday?.slots[0]).toEqual({ startTime: "10:00", endTime: "11:00" });
    });

    it("filters out days that result in zero valid slots", () => {
        const input: AvailabilityState = {
            Monday: {
                enabled: true,
                intervals: [{ start: "", end: "" }] // Invalid interval
            }
        };
        const result = convertAvailability(input);
        expect(result.availabilities).toHaveLength(0);
    });
  });

  describe("convertFromGetApi (API to UI)", () => {
    it("returns default Mon-Fri enabled if API data has NO available slots at all", () => {
      // Case 1: Empty Array
      let result = convertFromGetApi([]);
      expect(result["Monday"].enabled).toBe(true);
      expect(result["Sunday"].enabled).toBe(false);
      expect(result["Monday"].intervals).toEqual([DEFAULT_INTERVAL]);

      // Case 2: Array exists but isAvailable is false everywhere
      const unavailableData: ApiDayAvailability[] = [
        {
          _id: "1",
          organisationId: "org1",
          dayOfWeek: "Monday",
          slots: [{ startTime: "09:00", endTime: "17:00", isAvailable: false }],
        },
      ];
      result = convertFromGetApi(unavailableData);
      expect(result["Monday"].enabled).toBe(true); // Falls back to default logic
      expect(result["Saturday"].enabled).toBe(false);
    });

    it("converts valid API data to AvailabilityState", () => {
      const apiData: ApiDayAvailability[] = [
        {
          _id: "1",
          organisationId: "org1",
          dayOfWeek: "Monday",
          slots: [
            { startTime: "08:00", endTime: "12:00", isAvailable: true },
            { startTime: "13:00", endTime: "17:00", isAvailable: true },
          ],
        },
        {
          _id: "2",
          organisationId: "org1",
          dayOfWeek: "Tuesday",
          slots: [], // Empty slots -> should be disabled
        },
        // Wednesday missing from API -> should be disabled
      ];

      const result = convertFromGetApi(apiData);

      // Check Monday (Mapped correctly)
      expect(result["Monday"].enabled).toBe(true);
      expect(result["Monday"].intervals).toHaveLength(2);
      expect(result["Monday"].intervals[0]).toEqual({ start: "08:00", end: "12:00" });

      // Check Tuesday (Exists in API but empty slots)
      expect(result["Tuesday"].enabled).toBe(false);
      expect(result["Tuesday"].intervals).toEqual([DEFAULT_INTERVAL]);

      // Check Wednesday (Missing from API)
      expect(result["Wednesday"].enabled).toBe(false);
      expect(result["Wednesday"].intervals).toEqual([DEFAULT_INTERVAL]);
    });

    it("handles filtered slots resulting in empty array for a specific day", () => {
        // This ensures the logic `const slots = apiMap.get(key)` handles the case
        // where slots existed but were filtered out because isAvailable=false
        // BUT `hasAnyAvailableSlot` was true globally because of another day.
        const apiData: ApiDayAvailability[] = [
            {
                _id: "1",
                organisationId: "org1",
                dayOfWeek: "Monday",
                slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: true }]
            },
            {
                _id: "2",
                organisationId: "org1",
                dayOfWeek: "Tuesday",
                slots: [{ startTime: "09:00", endTime: "10:00", isAvailable: false }]
            }
        ];

        const result = convertFromGetApi(apiData);

        expect(result["Monday"].enabled).toBe(true);
        // Tuesday had slots, but they were filtered out.
        // Logic should treat it as empty -> enabled: false
        expect(result["Tuesday"].enabled).toBe(false);
    });
  });

  describe("hasAtLeastOneAvailability", () => {
    it("returns false if availabilities is empty or not an array", () => {
      expect(hasAtLeastOneAvailability({ availabilities: [] })).toBe(false);
      // @ts-expect-error - Testing runtime safety if bad data passed (optional but good for coverage)
      expect(hasAtLeastOneAvailability({ availabilities: null })).toBe(false);
    });

    it("returns true if availabilities has length", () => {
      expect(
        hasAtLeastOneAvailability({
          availabilities: [
            { dayOfWeek: "MONDAY", slots: [{ startTime: "9:00", endTime: "10:00" }] },
          ],
        })
      ).toBe(true);
    });
  });
});