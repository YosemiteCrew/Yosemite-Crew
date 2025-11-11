import { DayOfWeek } from './baseAvailability';

export type OverrideSlot = {
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "12:00"
  isAvailable: boolean; // override availability for that time window
};

export type WeeklyOverrideDay = {
  dayOfWeek: DayOfWeek;
  slots: OverrideSlot[];
};

export type WeeklyAvailabilityOverride = {
  _id?: string;
  userId: string;             // Ref to User
  weekStartDate: Date;        // Monday (or first day) of that week
  overrides: WeeklyOverrideDay[];
  createdAt?: Date;
  updatedAt?: Date;
};