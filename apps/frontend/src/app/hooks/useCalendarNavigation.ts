import { useCallback } from "react";

type SetDateFn = React.Dispatch<React.SetStateAction<Date>>;

export const useCalendarNavigation = (setCurrentDate: SetDateFn) => {
  const handleNextDay = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() + 1);
      return d;
    });
  }, [setCurrentDate]);

  const handlePrevDay = useCallback(() => {
    setCurrentDate((prev) => {
      const d = new Date(prev);
      d.setDate(d.getDate() - 1);
      return d;
    });
  }, [setCurrentDate]);

  return { handleNextDay, handlePrevDay };
};

export const getDateDisplay = (date: Date) => ({
  weekday: date.toLocaleDateString("en-US", { weekday: "long" }),
  dateNumber: date.getDate(),
});
