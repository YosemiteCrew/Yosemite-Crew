import { renderHook, act } from "@testing-library/react";
import {
  useCalendarNavigation,
  getDateDisplay,
} from "@/app/hooks/useCalendarNavigation";
import { useState } from "react";

describe("useCalendarNavigation", () => {
  describe("useCalendarNavigation hook", () => {
    it("increments date by one day when handleNextDay is called", () => {
      const initialDate = new Date(2024, 0, 15);

      const { result } = renderHook(() => {
        const [date, setDate] = useState(initialDate);
        const navigation = useCalendarNavigation(setDate);
        return { date, navigation };
      });

      act(() => {
        result.current.navigation.handleNextDay();
      });

      expect(result.current.date.getDate()).toBe(16);
    });

    it("decrements date by one day when handlePrevDay is called", () => {
      const initialDate = new Date(2024, 0, 15);

      const { result } = renderHook(() => {
        const [date, setDate] = useState(initialDate);
        const navigation = useCalendarNavigation(setDate);
        return { date, navigation };
      });

      act(() => {
        result.current.navigation.handlePrevDay();
      });

      expect(result.current.date.getDate()).toBe(14);
    });

    it("handles month transition when going to next day", () => {
      const initialDate = new Date(2024, 0, 31);

      const { result } = renderHook(() => {
        const [date, setDate] = useState(initialDate);
        const navigation = useCalendarNavigation(setDate);
        return { date, navigation };
      });

      act(() => {
        result.current.navigation.handleNextDay();
      });

      expect(result.current.date.getMonth()).toBe(1);
      expect(result.current.date.getDate()).toBe(1);
    });

    it("handles month transition when going to prev day", () => {
      const initialDate = new Date(2024, 1, 1);

      const { result } = renderHook(() => {
        const [date, setDate] = useState(initialDate);
        const navigation = useCalendarNavigation(setDate);
        return { date, navigation };
      });

      act(() => {
        result.current.navigation.handlePrevDay();
      });

      expect(result.current.date.getMonth()).toBe(0);
      expect(result.current.date.getDate()).toBe(31);
    });

    it("returns stable callbacks", () => {
      const initialDate = new Date(2024, 0, 15);

      const { result, rerender } = renderHook(() => {
        const [date, setDate] = useState(initialDate);
        const navigation = useCalendarNavigation(setDate);
        return { date, navigation, setDate };
      });

      const firstNextDay = result.current.navigation.handleNextDay;
      const firstPrevDay = result.current.navigation.handlePrevDay;

      rerender();

      expect(result.current.navigation.handleNextDay).toBe(firstNextDay);
      expect(result.current.navigation.handlePrevDay).toBe(firstPrevDay);
    });
  });

  describe("getDateDisplay", () => {
    it("returns correct weekday and date number", () => {
      const date = new Date(2024, 0, 15);
      const result = getDateDisplay(date);

      expect(result.weekday).toBe("Monday");
      expect(result.dateNumber).toBe(15);
    });

    it("returns Sunday for Sunday dates", () => {
      const date = new Date(2024, 0, 14);
      const result = getDateDisplay(date);

      expect(result.weekday).toBe("Sunday");
      expect(result.dateNumber).toBe(14);
    });

    it("returns correct date for end of month", () => {
      const date = new Date(2024, 0, 31);
      const result = getDateDisplay(date);

      expect(result.dateNumber).toBe(31);
    });

    it("returns correct date for first of month", () => {
      const date = new Date(2024, 1, 1);
      const result = getDateDisplay(date);

      expect(result.dateNumber).toBe(1);
    });

    it("returns correct weekday for different days", () => {
      const wednesday = new Date(2024, 0, 17);
      expect(getDateDisplay(wednesday).weekday).toBe("Wednesday");

      const friday = new Date(2024, 0, 19);
      expect(getDateDisplay(friday).weekday).toBe("Friday");

      const saturday = new Date(2024, 0, 20);
      expect(getDateDisplay(saturday).weekday).toBe("Saturday");
    });
  });
});
