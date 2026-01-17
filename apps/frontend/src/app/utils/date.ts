import { Option } from "../types/companion";

export const formatDateLocal = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const formatDateUTC = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export function getAgeInYears(dateOfBirth: Date | string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();

  let age = today.getFullYear() - dob.getFullYear();

  const hasHadBirthdayThisYear =
    today.getMonth() > dob.getMonth() ||
    (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());

  if (!hasHadBirthdayThisYear) {
    age--;
  }

  return age;
}

export const buildUtcDateFromDateAndTime = (
  selectedDate: Date,
  startTime: string
): Date => {
  const [hours, minutes] = startTime.split(":").map(Number);

  return new Date(
    Date.UTC(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hours,
      minutes,
      0,
      0
    )
  );
};

export const getDurationMinutes = (start: string, end: string): number => {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);

  return eh * 60 + em - (sh * 60 + sm);
};

export function generateTimeSlots(intervalMinutes = 15): Option[] {
  const slots: Option[] = [];
  const baseDateUTC = new Date(Date.UTC(2000, 0, 1, 0, 0, 0));
  for (let minutes = 0; minutes < 24 * 60; minutes += intervalMinutes) {
    const utcDate = new Date(baseDateUTC.getTime() + minutes * 60_000);
    const value = utcDate.toISOString().slice(11, 16);
    const label = utcDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    slots.push({ value, label });
  }
  return slots;
}

export function applyUtcTime(base: Date, hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setUTCHours(h, m, 0, 0);
  return d;
}
