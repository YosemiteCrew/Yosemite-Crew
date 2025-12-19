import {
  formatDateLocal,
  formatDateUTC,
  getAgeInYears,
  buildUtcDateFromDateAndTime,
  getDurationMinutes,
} from "../../utils/date";

describe("Date Utils", () => {
  // Clean up timers after tests to avoid affecting other test files
  afterEach(() => {
    jest.useRealTimers();
  });

  // --- Section 1: Date Formatting (Local & UTC) ---
  describe("formatDateLocal", () => {
    it("formats a local date correctly with double-digit month/day", () => {
      // Create a specific local date: Dec 25, 2023
      const date = new Date(2023, 11, 25);
      expect(formatDateLocal(date)).toBe("2023-12-25");
    });

    it("pads single-digit month and day with zero", () => {
      // Create a specific local date: Jan 5, 2023
      const date = new Date(2023, 0, 5);
      expect(formatDateLocal(date)).toBe("2023-01-05");
    });
  });

  describe("formatDateUTC", () => {
    it("formats a UTC date correctly", () => {
      // Create a date explicitly in UTC: 2023-10-15T00:00:00Z
      const date = new Date(Date.UTC(2023, 9, 15));
      expect(formatDateUTC(date)).toBe("2023-10-15");
    });

    it("pads single-digit month and day in UTC", () => {
      // Create a date explicitly in UTC: 2023-02-03T00:00:00Z
      const date = new Date(Date.UTC(2023, 1, 3));
      expect(formatDateUTC(date)).toBe("2023-02-03");
    });
  });

  // --- Section 2: Age Calculation ---
  describe("getAgeInYears", () => {
    beforeEach(() => {
      // Mock "Today" as May 15, 2025 for consistent testing
      jest.useFakeTimers();
      jest.setSystemTime(new Date(2025, 4, 15)); // Month is 0-indexed (4 = May)
    });

    it("returns correct age when birthday has not passed yet this year", () => {
      // DOB: June 20, 1990 (Birthday is next month)
      const dob = new Date(1990, 5, 20);
      // 2025 - 1990 = 35, but birthday hasn't happened, so 34
      expect(getAgeInYears(dob)).toBe(34);
    });

    it("returns correct age when birthday has already passed this year", () => {
      // DOB: April 10, 1990 (Birthday was last month)
      const dob = new Date(1990, 3, 10);
      expect(getAgeInYears(dob)).toBe(35);
    });

    it("returns correct age when today is the birthday", () => {
      // DOB: May 15, 1990 (Birthday is today)
      const dob = new Date(1990, 4, 15);
      expect(getAgeInYears(dob)).toBe(35);
    });

    it("accepts string input for date of birth", () => {
      // DOB: "1990-06-20"
      expect(getAgeInYears("1990-06-20")).toBe(34);
    });
  });

  // --- Section 3: Date Construction ---
  describe("buildUtcDateFromDateAndTime", () => {
    it("combines a local date object and a time string into a UTC Date", () => {
      // Input Date: Local Oct 10, 2023
      const localDate = new Date(2023, 9, 10);
      const timeString = "14:30";

      // The function reads local year/month/date from input and sets them as UTC components
      const result = buildUtcDateFromDateAndTime(localDate, timeString);

      // Expected Result: 2023-10-10 T 14:30:00 UTC
      expect(result.toISOString()).toBe("2023-10-10T14:30:00.000Z");
    });

    it("handles single digit hours correctly", () => {
      const localDate = new Date(2023, 0, 1);
      const timeString = "09:05";

      const result = buildUtcDateFromDateAndTime(localDate, timeString);

      // Expected Result: 2023-01-01 T 09:05:00 UTC
      expect(result.toISOString()).toBe("2023-01-01T09:05:00.000Z");
    });
  });

  // --- Section 4: Duration Calculation ---
  describe("getDurationMinutes", () => {
    it("calculates duration within the same hour", () => {
      const start = "10:00";
      const end = "10:45";
      expect(getDurationMinutes(start, end)).toBe(45);
    });

    it("calculates duration crossing hour boundaries", () => {
      const start = "09:50";
      const end = "11:10";
      // 10 mins to 10:00 + 60 mins to 11:00 + 10 mins to 11:10 = 80
      expect(getDurationMinutes(start, end)).toBe(80);
    });

    it("returns 0 if start and end time are the same", () => {
      expect(getDurationMinutes("12:00", "12:00")).toBe(0);
    });

    it("returns negative value if end time is before start time", () => {
      // This verifies the math logic holds even if logically invalid for a single appointment
      expect(getDurationMinutes("10:00", "09:00")).toBe(-60);
    });
  });
});