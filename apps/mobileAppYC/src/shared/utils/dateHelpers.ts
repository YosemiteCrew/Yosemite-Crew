// Date utility functions for task module

export interface DateInfo {
  date: Date;
  dayName: string;
  dayNumber: number;
  monthName: string;
  year: number;
  isToday: boolean;
  isSelected: boolean;
  hasTask?: boolean; // Optional: indicates if date has tasks
}

export const formatDateToISODate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const parseISODate = (iso: string): Date => {
  const [yearStr, monthStr, dayStr] = iso.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) {
    return new Date();
  }
  return new Date(year, month - 1, day);
};

export const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/**
 * Get week dates around a selected date
 */
export const getWeekDates = (selectedDate: Date): DateInfo[] => {
  const dates: DateInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Get the start of the week (Sunday)
  const startOfWeek = new Date(selectedDate);
  startOfWeek.setDate(selectedDate.getDate() - selectedDate.getDay());

  // Generate 7 days
  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    date.setHours(0, 0, 0, 0);

    const selectedDateNormalized = new Date(selectedDate);
    selectedDateNormalized.setHours(0, 0, 0, 0);

    dates.push({
      date,
      dayName: date.toLocaleDateString('en-US', {weekday: 'short'}),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString('en-US', {month: 'long'}),
      year: date.getFullYear(),
      isToday: date.getTime() === today.getTime(),
      isSelected: date.getTime() === selectedDateNormalized.getTime(),
    });
  }

  return dates;
};

/**
 * Get all dates in a month (with padding for full weeks)
 */
export const getMonthDates = (monthDate: Date, selectedDate: Date): DateInfo[] => {
  const dates: DateInfo[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const selectedDateNormalized = new Date(selectedDate);
  selectedDateNormalized.setHours(0, 0, 0, 0);

  // Get first day of month
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  // Get last day of month
  const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

  // Get start of week for first day
  const startOfFirstWeek = new Date(firstDay);
  startOfFirstWeek.setDate(firstDay.getDate() - firstDay.getDay());

  // Get end of week for last day
  const endOfLastWeek = new Date(lastDay);
  endOfLastWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  // Generate all dates from start to end
  for (let d = new Date(startOfFirstWeek); d <= endOfLastWeek; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    date.setHours(0, 0, 0, 0);

    dates.push({
      date,
      dayName: date.toLocaleDateString('en-US', {weekday: 'short'}),
      dayNumber: date.getDate(),
      monthName: date.toLocaleDateString('en-US', {month: 'long'}),
      year: date.getFullYear(),
      isToday: date.getTime() === today.getTime(),
      isSelected: date.getTime() === selectedDateNormalized.getTime(),
    });
  }

  return dates;
};

/**
 * Navigate to previous month
 */
export const getPreviousMonth = (currentDate: Date): Date => {
  const newDate = new Date(currentDate);
  newDate.setMonth(currentDate.getMonth() - 1);
  return newDate;
};

/**
 * Navigate to next month
 */
export const getNextMonth = (currentDate: Date): Date => {
  const newDate = new Date(currentDate);
  newDate.setMonth(currentDate.getMonth() + 1);
  return newDate;
};

/**
 * Format month and year for display
 */
export const formatMonthYear = (date: Date): string => {
  const month = date.toLocaleDateString('en-US', {month: 'long'});
  const year = date.getFullYear();
  return `${month} ${year}`;
};

/**
 * Check if two dates are on the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

/**
 * Format time for display (e.g., "2:30 PM")
 */
export const formatTime = (date: Date | string): string => {
  const timeDate = typeof date === 'string' ? new Date(date) : date;
  return timeDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

/**
 * Get start of day
 */
export const getStartOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(0, 0, 0, 0);
  return newDate;
};

/**
 * Get end of day
 */
export const getEndOfDay = (date: Date): Date => {
  const newDate = new Date(date);
  newDate.setHours(23, 59, 59, 999);
  return newDate;
};

/**
 * Check if date is in the past
 */
export const isPast = (date: Date): boolean => {
  const today = getStartOfDay(new Date());
  const checkDate = getStartOfDay(date);
  return checkDate < today;
};

/**
 * Check if date is today
 */
export const isToday = (date: Date): boolean => {
  const today = new Date();
  return isSameDay(date, today);
};

/**
 * Check if date is in the future
 */
export const isFuture = (date: Date): boolean => {
  const today = getStartOfDay(new Date());
  const checkDate = getStartOfDay(date);
  return checkDate > today;
};
