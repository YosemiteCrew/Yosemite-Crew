export type DayOfWeek =
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

export type AvailabilitySlot = {
  startTime: string; // e.g. "09:00"
  endTime: string;   // e.g. "17:00"
  isAvailable: boolean;
};

export type UserAvailability = {
  _id?: string;
  userId: string; // Reference to User
  dayOfWeek: DayOfWeek;
  slots: AvailabilitySlot[]; // Allows multiple slots in a single day
  createdAt?: Date;
  updatedAt?: Date;
};