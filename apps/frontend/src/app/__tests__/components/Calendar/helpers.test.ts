import {
  isSameDay,
  isSameMonth,
  getMonthYear,
  getDayWithDate,
  minutesSinceStartOfDay,
  snapToStep,
  snapDown,
  snapUp,
  getDayWindow,
  computeVerticalPositionPx,
  layoutDayEvents,
  getTotalWindowHeightPx,
  getNowTopPxForWindow,
  isAllDayForDate,
  eventsForDay,
  PIXELS_PER_STEP,
  MINUTES_PER_STEP,
} from "@/app/components/Calendar/helpers";
import { Appointment } from "@yosemite-crew/types";
import { TasksProps } from "@/app/types/tasks";

describe("Calendar Helpers", () => {
  // --- Date Comparison Helpers ---
  describe("isSameDay", () => {
    it("returns true for the same date", () => {
      const d1 = new Date(2023, 0, 1, 10, 0);
      const d2 = new Date(2023, 0, 1, 15, 30);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it("returns false for different dates", () => {
      const d1 = new Date(2023, 0, 1);
      const d2 = new Date(2023, 0, 2);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it("returns false if either date is missing", () => {
      expect(isSameDay(new Date(), null)).toBe(false);
      expect(isSameDay(undefined, new Date())).toBe(false);
      expect(isSameDay(null, null)).toBe(false);
    });
  });

  describe("isSameMonth", () => {
    it("returns true for the same month and year", () => {
      const d1 = new Date(2023, 0, 15);
      const d2 = new Date(2023, 0, 20);
      expect(isSameMonth(d1, d2)).toBe(true);
    });

    it("returns false for different months", () => {
      const d1 = new Date(2023, 0, 1);
      const d2 = new Date(2023, 1, 1);
      expect(isSameMonth(d1, d2)).toBe(false);
    });

    it("returns false for different years", () => {
      const d1 = new Date(2023, 0, 1);
      const d2 = new Date(2024, 0, 1);
      expect(isSameMonth(d1, d2)).toBe(false);
    });

    it("returns false if inputs are missing", () => {
      expect(isSameMonth(null, new Date())).toBe(false);
    });
  });

  // --- Formatting Helpers ---
  describe("Formatting", () => {
    // Note: These tests depend on the 'en-US' locale being available in the test environment.
    it("getMonthYear formats correctly", () => {
      const date = new Date(2023, 0, 1); // Jan 1, 2023
      expect(getMonthYear(date)).toBe("January 2023");
    });

    it("getDayWithDate formats correctly", () => {
      const date = new Date(2023, 0, 1); // Sunday, Jan 1
      expect(getDayWithDate(date)).toMatch(/Sunday 01/);
    });
  });

  // --- Math/Time Calculation Helpers ---
  describe("Math & Time", () => {
    it("minutesSinceStartOfDay calculates correctly", () => {
      const d = new Date(2023, 0, 1, 1, 30); // 01:30
      // 1 * 60 + 30 = 90
      expect(minutesSinceStartOfDay(d)).toBe(90);
    });

    it("snapToStep rounds to nearest step", () => {
      expect(snapToStep(12, 5)).toBe(10);
      expect(snapToStep(13, 5)).toBe(15);
    });

    it("snapDown floors to nearest step", () => {
      expect(snapDown(14, 5)).toBe(10);
    });

    it("snapUp ceils to nearest step", () => {
      expect(snapUp(11, 5)).toBe(15);
    });
  });

  // --- Window Calculation ---
  describe("getDayWindow", () => {
    it("returns full day if no events", () => {
      const res = getDayWindow([]);
      expect(res).toEqual({ windowStart: 0, windowEnd: 24 * 60 });
    });

    it("calculates padded window for normal events", () => {
      const events = [
        {
          startTime: new Date(2023, 0, 1, 10, 0), // 600 min
          endTime: new Date(2023, 0, 1, 11, 0),   // 660 min
        },
      ] as Appointment[];

      const res = getDayWindow(events);
      // Start: 600 - 30 padding = 570
      // End: 660 + 30 padding = 690
      expect(res).toEqual({ windowStart: 570, windowEnd: 690 });
    });

    it("handles midnight ending (clamping to DAY_END)", () => {
      const events = [
        {
          startTime: new Date(2023, 0, 1, 23, 0),
          // 00:00 of next day effectively returns hours=0, mins=0
          endTime: new Date(2023, 0, 1, 0, 0),
        },
      ] as Appointment[];

      // Mock minutesSinceStartOfDay for the end time to return 0
      // (Normally Date(..., 0, 0) might need careful construction to imply next day,
      // but the helper uses .getHours()/.getMinutes() which will be 0 for midnight)
      // The helper logic `const e = eRaw === 0 ? DAY_END : eRaw` handles this.

      const res = getDayWindow(events);
      // Start: 23*60 = 1380. Pad -30 = 1350.
      // End: 0 -> clamped to 1440. Pad +30 = 1470 -> clamped to 1440.
      expect(res.windowEnd).toBe(1440);
    });

    it("ensures non-zero window if calculation collapses (safety check)", () => {
      // Create a scenario where start > end to force collapse
      // Start 10:00 (600), End 09:00 (540).
      // minStart = 600, maxEnd = 540.
      // windowStart = 570, windowEnd = 570.
      // 570 <= 570 triggers the safety block.
      const events = [
        {
          startTime: new Date(2023, 0, 1, 10, 0),
          endTime: new Date(2023, 0, 1, 9, 0),
        },
      ] as Appointment[];

      const res = getDayWindow(events);
      // It expands the window: start - 60, start + 120
      expect(res.windowEnd).toBeGreaterThan(res.windowStart);
    });
  });

  // --- Vertical Position ---
  describe("computeVerticalPositionPx", () => {
    const windowStart = 600; // 10:00 AM
    const windowEnd = 720;   // 12:00 PM

    it("calculates position for event inside window", () => {
      const event = {
        startTime: new Date(2023, 0, 1, 10, 30), // 630
        endTime: new Date(2023, 0, 1, 11, 30),   // 690
      } as Appointment;

      const res = computeVerticalPositionPx(event, windowStart, windowEnd);
      // Start steps: (630 - 600) / 5 = 6 steps. 6 * 25px = 150px
      // Duration: 60 mins / 5 = 12 steps. 12 * 25px = 300px
      expect(res.topPx).toBe(150);
      expect(res.heightPx).toBe(300);
    });

    it("clamps event extending beyond window boundaries", () => {
      const event = {
        startTime: new Date(2023, 0, 1, 9, 0),  // 540 (before window)
        endTime: new Date(2023, 0, 1, 13, 0),   // 780 (after window)
      } as Appointment;

      const res = computeVerticalPositionPx(event, windowStart, windowEnd);
      // Should clamp start to 600 (top 0) and end to 720 (height full window)
      expect(res.topPx).toBe(0);

      const expectedHeight = ((windowEnd - windowStart) / MINUTES_PER_STEP) * PIXELS_PER_STEP;
      expect(res.heightPx).toBe(expectedHeight);
    });

    it("enforces minimum height for collapsed events", () => {
      const event = {
        startTime: new Date(2023, 0, 1, 10, 0),
        endTime: new Date(2023, 0, 1, 10, 0), // Same time
      } as Appointment;

      const res = computeVerticalPositionPx(event, windowStart, windowEnd);
      // Should force at least 1 step height
      expect(res.heightPx).toBe(PIXELS_PER_STEP);
    });
  });

  // --- Layout Engine ---
  describe("layoutDayEvents", () => {
    it("returns empty array for no events", () => {
      expect(layoutDayEvents([], 0, 1440)).toEqual([]);
    });

    it("layouts non-overlapping events", () => {
      const events = [
        { startTime: new Date(2023, 0, 1, 10, 0), endTime: new Date(2023, 0, 1, 11, 0) },
        { startTime: new Date(2023, 0, 1, 11, 0), endTime: new Date(2023, 0, 1, 12, 0) },
      ] as Appointment[];

      const res = layoutDayEvents(events, 0, 1440);
      expect(res).toHaveLength(2);
      // Should be in same column (index 0) because they don't overlap time-wise
      // (Second starts exactly when first ends)
      expect(res[0].columnIndex).toBe(0);
      expect(res[1].columnIndex).toBe(0);
      expect(res[0].columnsCount).toBe(1);
    });

    it("layouts overlapping events in clusters", () => {
      const events = [
        { startTime: new Date(2023, 0, 1, 10, 0), endTime: new Date(2023, 0, 1, 11, 0) }, // A
        { startTime: new Date(2023, 0, 1, 10, 30), endTime: new Date(2023, 0, 1, 11, 30) }, // B (overlaps A)
        { startTime: new Date(2023, 0, 1, 12, 0), endTime: new Date(2023, 0, 1, 13, 0) }, // C (separate)
      ] as Appointment[];

      const res = layoutDayEvents(events, 0, 1440);

      // A and B overlap
      expect(res[0].columnIndex).toBe(0);
      expect(res[1].columnIndex).toBe(1); // Pushed to next col
      expect(res[0].columnsCount).toBe(2); // Shared space
      expect(res[1].columnsCount).toBe(2);

      // C is separate cluster
      expect(res[2].columnIndex).toBe(0); // Reset to 0
      expect(res[2].columnsCount).toBe(1);
    });
  });

  // --- Miscellaneous Helpers ---

  describe("getTotalWindowHeightPx", () => {
    it("calculates height based on steps", () => {
      // 120 mins = 24 steps. 24 * 25px = 600px.
      expect(getTotalWindowHeightPx(0, 120)).toBe(600);
    });
  });

  describe("getNowTopPxForWindow", () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("returns null if not same day", () => {
      jest.setSystemTime(new Date(2023, 0, 2, 12, 0));
      const targetDate = new Date(2023, 0, 1);
      expect(getNowTopPxForWindow(targetDate, 0, 1440)).toBeNull();
    });

    it("returns position if same day and inside window", () => {
      // 10:05 AM
      jest.setSystemTime(new Date(2023, 0, 1, 10, 5));
      const targetDate = new Date(2023, 0, 1);

      // Window 10:00 (600) to 11:00 (660)
      // 10:05 is 605 mins.
      // (605 - 600) / 5 = 1 step. 1 * 25px = 25px.
      expect(getNowTopPxForWindow(targetDate, 600, 660)).toBe(PIXELS_PER_STEP);
    });

    it("clamps position to windowEnd if time is outside window", () => {
      // 12:00 PM (720 min)
      jest.setSystemTime(new Date(2023, 0, 1, 12, 0));
      const targetDate = new Date(2023, 0, 1);

      // Window 9:00 (540) to 10:00 (600)
      // Current time 720 is > 600. Should return windowEnd logic.
      // Clamped to 600. (600 - 540) / 5 = 12 steps. 12 * 25 = 300.
      expect(getNowTopPxForWindow(targetDate, 540, 600)).toBe(300);
    });
  });

  describe("isAllDayForDate", () => {
    it("returns true for event covering the full day", () => {
      const day = new Date(2023, 0, 1);
      const ev = {
        startTime: new Date(2023, 0, 1, 0, 0, 0),
        endTime: new Date(2023, 0, 1, 23, 59, 59, 999),
      } as Appointment;
      expect(isAllDayForDate(ev, day)).toBe(true);
    });

    it("returns false for partial day event", () => {
      const day = new Date(2023, 0, 1);
      const ev = {
        startTime: new Date(2023, 0, 1, 10, 0),
        endTime: new Date(2023, 0, 1, 12, 0),
      } as Appointment;
      expect(isAllDayForDate(ev, day)).toBe(false);
    });
  });

  describe("eventsForDay", () => {
    it("filters tasks matching the day", () => {
      const day = new Date(2023, 0, 1);
      const tasks = [
        { due: new Date(2023, 0, 1, 10, 0) }, // Match
        { due: new Date(2023, 0, 2, 10, 0) }, // Diff day
      ] as TasksProps[];

      const res = eventsForDay(tasks, day);
      expect(res).toHaveLength(1);
      expect(res[0].due.getDate()).toBe(1);
    });
  });
});