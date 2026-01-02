import {useCallback, useState} from 'react';

export const useTaskDateSelection = (initialDate?: Date) => {
  const seedDate = initialDate ?? new Date();
  const [selectedDate, setSelectedDate] = useState<Date>(seedDate);
  const [currentMonth, setCurrentMonth] = useState<Date>(seedDate);

  const handleMonthChange = useCallback((newMonth: Date) => {
    setCurrentMonth(newMonth);
    const firstDay = new Date(newMonth.getFullYear(), newMonth.getMonth(), 1);
    setSelectedDate(firstDay);
  }, []);

  const handleDateSelect = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

  return {
    selectedDate,
    currentMonth,
    handleMonthChange,
    handleDateSelect,
    setSelectedDate,
    setCurrentMonth,
  };
};
