import { AppointmentsProps } from "@/app/types/appointments";
import { isSameDay } from "./helpers";

export const HOURS_IN_DAY = 24;

export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getWeekDays(weekStart: Date): Date[] {
  const base = startOfDay(weekStart);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return d;
  });
}

export function eventsForDayHour(
  events: AppointmentsProps[],
  day: Date,
  hour: number
): AppointmentsProps[] {
  return events.filter((ev) => {
    return isSameDay(ev.start, day) && ev.start.getHours() === hour;
  });
}

export function getNextWeek(currentWeekStart: Date): Date {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() + 7);
  return d;
}

export function getPrevWeek(currentWeekStart: Date): Date {
  const d = new Date(currentWeekStart);
  d.setDate(d.getDate() - 7);
  return d;
}
export function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sun, 1 = Mon ...
  const diff = d.getDate() - day + 1; // shift to Monday

  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}
