import {
  HOURS_IN_DAY,
  startOfDay,
  getWeekDays,
  eventsForDayHour,
  getNextWeek,
  getPrevWeek,
  getStartOfWeek,
  getShortWeekday,
  getDateNumberPadded,
  getFormattedDate,
} from "@/app/components/Calendar/weekHelpers";
import { Appointment } from "@yosemite-crew/types";

// Mock isSameDay helper to ensure unit isolation
jest.mock("@/app/components/Calendar/helpers", () => ({
  isSameDay: (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate(),
}));

describe("Calendar Week Helpers", () => {
  // --- 1. Constants ---
  it("exports correct constants", () => {
    expect(HOURS_IN_DAY).toBe(24);
  });

  // --- 2. Date Manipulation Logic ---

  describe("startOfDay", () => {
    it("returns a new date set to midnight (00:00:00.000)", () => {
      const input = new Date(2023, 0, 15, 14, 30, 45, 500); // Jan 15, 14:30
      const result = startOfDay(input);

      expect(result).not.toBe(input); // Should return new instance
      expect(result.getFullYear()).toBe(2023);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe("getWeekDays", () => {
    it("returns an array of 7 consecutive dates starting from the given date", () => {
      const start = new Date(2023, 0, 1); // Sunday Jan 1, 2023
      const days = getWeekDays(start);

      expect(days).toHaveLength(7);
      expect(days[0].getDate()).toBe(1);
      expect(days[1].getDate()).toBe(2);
      expect(days[6].getDate()).toBe(7);

      // Verify items are new Date objects based on startOfDay
      expect(days[3].getHours()).toBe(0);
    });

    it("handles month rollover correctly", () => {
      const start = new Date(2023, 0, 30); // Jan 30
      const days = getWeekDays(start);

      // Sequence: Jan 30, Jan 31, Feb 1, Feb 2...
      expect(days[0].getDate()).toBe(30);
      expect(days[2].getDate()).toBe(1);
      expect(days[2].getMonth()).toBe(1); // February (0-indexed)
    });
  });

  describe("getNextWeek / getPrevWeek", () => {
    it("getNextWeek adds 7 days", () => {
      const start = new Date(2023, 0, 1); // Jan 1
      const next = getNextWeek(start);
      expect(next.getDate()).toBe(8); // Jan 8
      expect(next.getMonth()).toBe(0);
    });

    it("getNextWeek handles year rollover", () => {
      const start = new Date(2023, 11, 28); // Dec 28, 2023
      const next = getNextWeek(start);
      expect(next.getFullYear()).toBe(2024);
      expect(next.getMonth()).toBe(0); // Jan
      expect(next.getDate()).toBe(4);
    });

    it("getPrevWeek subtracts 7 days", () => {
      const start = new Date(2023, 0, 8); // Jan 8
      const prev = getPrevWeek(start);
      expect(prev.getDate()).toBe(1); // Jan 1
    });
  });

  describe("getStartOfWeek", () => {
    // Context: Jan 1 2023 was a Sunday. Jan 4 2023 was a Wednesday.

    it("calculates start of week (Monday start default) from a Wednesday", () => {
      const date = new Date(2023, 0, 4); // Wed Jan 4
      const start = getStartOfWeek(date, 1); // Monday start

      // Should go back to Monday Jan 2
      expect(start.getDate()).toBe(2);
      expect(start.getDay()).toBe(1); // Monday
    });

    it("calculates start of week (Sunday start) from a Wednesday", () => {
      const date = new Date(2023, 0, 4); // Wed Jan 4
      const start = getStartOfWeek(date, 0); // Sunday start

      // Should go back to Sunday Jan 1
      expect(start.getDate()).toBe(1);
      expect(start.getDay()).toBe(0); // Sunday
    });

    it("returns same day if it is already the start of the week", () => {
      const monday = new Date(2023, 0, 2); // Mon Jan 2
      const start = getStartOfWeek(monday, 1); // Start on Monday
      expect(start.getDate()).toBe(2);
    });

    it("defaults to Monday start if argument omitted", () => {
      const wednesday = new Date(2023, 0, 4);
      const start = getStartOfWeek(wednesday);
      // Implied weekStartsOn = 1 (Monday) -> Expect Jan 2
      expect(start.getDate()).toBe(2);
    });
  });

  // --- 3. Event Filtering Logic ---

  describe("eventsForDayHour", () => {
    const today = new Date(2023, 0, 1, 10, 0); // Jan 1, 10:00

    const events = [
      { startTime: new Date(2023, 0, 1, 10, 30) }, // Match Day & Hour (10)
      { startTime: new Date(2023, 0, 1, 10, 5) },  // Match Day & Hour (10)
      { startTime: new Date(2023, 0, 1, 11, 0) },  // Match Day, Wrong Hour (11)
      { startTime: new Date(2023, 0, 2, 10, 0) },  // Wrong Day, Match Hour (10)
    ] as Appointment[];

    it("filters events matching the specific day and hour", () => {
      const result = eventsForDayHour(events, today, 10);
      expect(result).toHaveLength(2);
      expect(result[0].startTime.getMinutes()).toBe(30);
      expect(result[1].startTime.getMinutes()).toBe(5);
    });

    it("returns empty array if no events match", () => {
      const result = eventsForDayHour(events, today, 5); // 5 AM
      expect(result).toHaveLength(0);
    });
  });

  // --- 4. Formatting Logic ---

  describe("Formatting", () => {
    // Note: Tests rely on en-US locale being standard in JSDOM environment
    const date = new Date(2023, 0, 5); // Thursday, Jan 5, 2023

    it("getShortWeekday returns 3-letter day name", () => {
      expect(getShortWeekday(date)).toBe("Thu");
    });

    it("getDateNumberPadded returns 2-digit day string", () => {
      expect(getDateNumberPadded(date)).toBe("05"); // Pads single digit

      const doubleDigitDate = new Date(2023, 0, 15);
      expect(getDateNumberPadded(doubleDigitDate)).toBe("15"); // Keeps double digit
    });

    it("getFormattedDate returns 'MMM D, YYYY'", () => {
      // Expected output: "Jan 5, 2023"
      expect(getFormattedDate(date)).toMatch(/Jan 5, 2023/);
    });
  });
});