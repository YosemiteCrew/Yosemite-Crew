import { DayOfWeek } from "./base-availability";

export interface OverrideSlot {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface WeeklyOverrideDay {
  dayOfWeek: DayOfWeek;
  slots: OverrideSlot[];
}

export interface WeeklyAvailabilityOverrideMongo {
  userId: string;
  organisationId: string;
  weekStartDate: Date;
  overrides: WeeklyOverrideDay[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type WeeklyAvailabilityOverrideDocument =
  WeeklyAvailabilityOverrideMongo;
