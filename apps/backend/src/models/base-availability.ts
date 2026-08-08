export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export interface AvailabilitySlotMongo {
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface BaseAvailabilityMongo {
  userId: string;
  organisationId?: string;
  dayOfWeek: DayOfWeek;
  slots: AvailabilitySlotMongo[];
  createdAt?: Date;
  updatedAt?: Date;
}
