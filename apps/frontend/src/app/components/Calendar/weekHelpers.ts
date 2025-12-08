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

export function getStartOfWeek(date: Date, weekStartsOn: 0 | 1 = 1): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sun, 1 = Mon, ...
  const diff = (day - weekStartsOn + 7) % 7; // how many days since week start
  d.setDate(d.getDate() - diff); // go BACK to the start of the week
  return d;
}

export function getShortWeekday(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

export function getDateNumberPadded(date: Date): string {
  return String(date.getDate()).padStart(2, "0");
}

export function getFormattedDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
