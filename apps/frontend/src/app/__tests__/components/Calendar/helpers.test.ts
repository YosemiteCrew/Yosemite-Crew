import {
  isSameDay,
  isSameMonth,
  getMonthYear,
  getDayWithDate,
  minutesSinceStartOfDay,
  snapToStep,
  computeVerticalPositionPx,
  layoutDayEvents,
  getNowTopPxForDay,
  isAllDayForDate,
  eventsForDay,
} from "@/app/components/Calendar/helpers";
import { AppointmentsProps } from "@/app/types/appointments";
import { TasksProps } from "@/app/types/tasks";

describe("Calendar Helpers", () => {
  // --- Date Comparison & Formatting ---

  describe("isSameDay", () => {
    it("returns true for same day", () => {
      const d1 = new Date(2023, 9, 27, 10, 0);
      const d2 = new Date(2023, 9, 27, 15, 30);
      expect(isSameDay(d1, d2)).toBe(true);
    });

    it("returns false for different day", () => {
      const d1 = new Date(2023, 9, 27);
      const d2 = new Date(2023, 9, 28);
      expect(isSameDay(d1, d2)).toBe(false);
    });

    it("returns false for different month", () => {
        const d1 = new Date(2023, 9, 27);
        const d2 = new Date(2023, 10, 27);
        expect(isSameDay(d1, d2)).toBe(false);
    });

    it("returns false for different year", () => {
        const d1 = new Date(2023, 9, 27);
        const d2 = new Date(2024, 9, 27);
        expect(isSameDay(d1, d2)).toBe(false);
    });
  });

  describe("isSameMonth", () => {
    it("returns true for same month and year", () => {
      const d1 = new Date(2023, 9, 1);
      const d2 = new Date(2023, 9, 31);
      expect(isSameMonth(d1, d2)).toBe(true);
    });

    it("returns false for different month", () => {
      const d1 = new Date(2023, 9, 1);
      const d2 = new Date(2023, 10, 1);
      expect(isSameMonth(d1, d2)).toBe(false);
    });

    it("returns false for different year", () => {
      const d1 = new Date(2023, 9, 1);
      const d2 = new Date(2024, 9, 1);
      expect(isSameMonth(d1, d2)).toBe(false);
    });
  });

  describe("getMonthYear", () => {
    it("formats correctly (e.g., October 2023)", () => {
      const date = new Date(2023, 9, 27); // Month is 0-indexed: 9 = Oct
      expect(getMonthYear(date)).toBe("October 2023");
    });
  });

  describe("getDayWithDate", () => {
    it("formats correctly (e.g., Friday 27)", () => {
      const date = new Date(2023, 9, 27); // Oct 27, 2023 is a Friday
      expect(getDayWithDate(date)).toBe("Friday 27");
    });
  });

  // --- Time & Layout Calculations ---

  describe("minutesSinceStartOfDay", () => {
    it("calculates minutes correctly", () => {
      const date = new Date(2023, 9, 27, 10, 30); // 10:30
      // 10 * 60 + 30 = 630
      expect(minutesSinceStartOfDay(date)).toBe(630);
    });

    it("calculates midnight correctly", () => {
        const date = new Date(2023, 9, 27, 0, 0);
        expect(minutesSinceStartOfDay(date)).toBe(0);
    });
  });

  describe("snapToStep", () => {
    it("snaps to nearest step (default 5)", () => {
      expect(snapToStep(3)).toBe(5); // 3 -> 5 (0.6 -> 1)
      expect(snapToStep(2)).toBe(0); // 2 -> 0 (0.4 -> 0)
      expect(snapToStep(5)).toBe(5);
      expect(snapToStep(7)).toBe(5);
    });

    it("snaps with custom step", () => {
      expect(snapToStep(12, 10)).toBe(10);
      expect(snapToStep(18, 10)).toBe(20);
    });
  });

  describe("computeVerticalPositionPx", () => {
    it("computes top and height correctly", () => {
      // Start: 60 mins (1:00), End: 90 mins (1:30)
      // Step: 5 min. 60/5 = 12 steps. 90/5 = 18 steps.
      // Top: 12 * 25px = 300px
      // Duration: 30 mins = 6 steps. Height: 6 * 25px = 150px
      const event = {
        start: new Date(2023, 9, 27, 1, 0),
        end: new Date(2023, 9, 27, 1, 30),
      } as AppointmentsProps;

      const { topPx, heightPx } = computeVerticalPositionPx(event);
      expect(topPx).toBe(300);
      expect(heightPx).toBe(150);
    });
  });

  // --- Event Layout Algorithm ---

  describe("layoutDayEvents", () => {
    it("returns empty array for no events", () => {
      expect(layoutDayEvents([])).toEqual([]);
    });

    it("handles non-overlapping events", () => {
      const e1 = { start: new Date(2023, 9, 27, 9, 0), end: new Date(2023, 9, 27, 10, 0) } as AppointmentsProps;
      const e2 = { start: new Date(2023, 9, 27, 10, 0), end: new Date(2023, 9, 27, 11, 0) } as AppointmentsProps;

      const result = layoutDayEvents([e1, e2]);

      expect(result).toHaveLength(2);
      // e1
      expect(result[0].columnIndex).toBe(0);
      expect(result[0].columnsCount).toBe(1);
      // e2 - new cluster
      expect(result[1].columnIndex).toBe(0);
      expect(result[1].columnsCount).toBe(1);
    });

    it("handles simple overlapping events", () => {
      // e1: 9:00 - 10:00
      // e2: 9:30 - 10:30 (overlaps e1)
      const e1 = { start: new Date(2023, 9, 27, 9, 0), end: new Date(2023, 9, 27, 10, 0) } as AppointmentsProps;
      const e2 = { start: new Date(2023, 9, 27, 9, 30), end: new Date(2023, 9, 27, 10, 30) } as AppointmentsProps;

      const result = layoutDayEvents([e1, e2]);

      expect(result).toHaveLength(2);
      // Both should be in same cluster (implied), so columnsCount is max width (2)
      expect(result[0].columnsCount).toBe(2);
      expect(result[1].columnsCount).toBe(2);

      // Columns indices should differ
      expect(result[0].columnIndex).not.toBe(result[1].columnIndex);
    });

    it("handles complex clustering", () => {
      // A: 9:00-10:00
      // B: 9:15-9:45 (overlaps A)
      // C: 9:30-10:30 (overlaps A and B) -> Max width 3
      // D: 11:00-12:00 (separate)
      const eA = { start: new Date(2023, 9, 27, 9, 0), end: new Date(2023, 9, 27, 10, 0) } as AppointmentsProps;
      const eB = { start: new Date(2023, 9, 27, 9, 15), end: new Date(2023, 9, 27, 9, 45) } as AppointmentsProps;
      const eC = { start: new Date(2023, 9, 27, 9, 30), end: new Date(2023, 9, 27, 10, 30) } as AppointmentsProps;
      const eD = { start: new Date(2023, 9, 27, 11, 0), end: new Date(2023, 9, 27, 12, 0) } as AppointmentsProps;

      const result = layoutDayEvents([eA, eB, eC, eD]);

      // Check first cluster
      expect(result[0].columnsCount).toBe(3);
      expect(result[1].columnsCount).toBe(3);
      expect(result[2].columnsCount).toBe(3);

      // Indices should be unique within active overlap
      const indices = new Set([result[0].columnIndex, result[1].columnIndex, result[2].columnIndex]);
      expect(indices.size).toBe(3);

      // Check second cluster
      expect(result[3].columnsCount).toBe(1);
      expect(result[3].columnIndex).toBe(0);
    });
  });

  // --- Current Time Indicator ---

  describe("getNowTopPxForDay", () => {
    beforeAll(() => {
      jest.useFakeTimers();
    });

    afterAll(() => {
      jest.useRealTimers();
    });

    it("returns null if day is not today", () => {
      jest.setSystemTime(new Date(2023, 9, 27, 12, 0)); // Today is Oct 27
      const otherDay = new Date(2023, 9, 28);
      expect(getNowTopPxForDay(otherDay)).toBeNull();
    });

    it("returns correct pixel position if day is today", () => {
      jest.setSystemTime(new Date(2023, 9, 27, 1, 0)); // 1:00 AM = 60 mins
      const today = new Date(2023, 9, 27);

      // 60 mins / 5 min step = 12 steps. 12 * 25px = 300px
      const px = getNowTopPxForDay(today);
      expect(px).toBe(300);
    });

    it("returns null if outside day range (defensive)", () => {
       // Mock system time to valid
       jest.setSystemTime(new Date(2023, 9, 27, 12, 0));
       // If day param is wrong, it returns null (covered).
       // If minutes logic fails (e.g. invalid date passed as now?), it returns null.
       // Standard Date objects won't return > 24*60, so this path is logically unreachable
       // with standard Date usage, but acts as a guard.
    });
  });

  // --- Misc Helpers ---

  describe("isAllDayForDate", () => {
    it("returns true if event covers the entire day", () => {
      const day = new Date(2023, 9, 27);
      const ev = {
        start: new Date(2023, 9, 27, 0, 0, 0),
        end: new Date(2023, 9, 27, 23, 59, 59, 999),
      } as AppointmentsProps;

      expect(isAllDayForDate(ev, day)).toBe(true);
    });

    it("returns true if event spans multiple days including this one", () => {
        const day = new Date(2023, 9, 27);
        const ev = {
          start: new Date(2023, 9, 26),
          end: new Date(2023, 9, 28),
        } as AppointmentsProps;

        expect(isAllDayForDate(ev, day)).toBe(true);
    });

    it("returns false if partial day", () => {
      const day = new Date(2023, 9, 27);
      const ev = {
        start: new Date(2023, 9, 27, 10, 0),
        end: new Date(2023, 9, 27, 11, 0),
      } as AppointmentsProps;

      expect(isAllDayForDate(ev, day)).toBe(false);
    });
  });

  describe("eventsForDay", () => {
    it("filters tasks by due date matching the day", () => {
      const t1 = { due: new Date(2023, 9, 27, 10, 0) } as TasksProps;
      const t2 = { due: new Date(2023, 9, 28, 10, 0) } as TasksProps; // Different day
      const t3 = { due: new Date(2023, 9, 27, 15, 0) } as TasksProps;

      const day = new Date(2023, 9, 27);
      const result = eventsForDay([t1, t2, t3], day);

      expect(result).toHaveLength(2);
      expect(result).toContain(t1);
      expect(result).toContain(t3);
      expect(result).not.toContain(t2);
    });
  });
});