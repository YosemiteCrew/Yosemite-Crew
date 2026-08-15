import {
  filter,
  statusFromToken,
  StatusOption,
} from '@/app/features/companions/pages/Companions/types';
import type { Appointment } from '@yosemite-crew/types';

export type AppointmentWithCompanion = Appointment & {
  companion: NonNullable<Appointment['companion']>;
};

export type AppointmentStatus = Appointment['status'];

const opt = (value: string, label: string) => ({ value, label });

export const AppointmentStatusOptions = [
  opt('REQUESTED', 'Requested'),
  opt('UPCOMING', 'Upcoming'),
  opt('CHECKED_IN', 'Checked in'),
  opt('IN_PROGRESS', 'In progress'),
  opt('COMPLETED', 'Completed'),
  opt('CANCELLED', 'Cancelled'),
  opt('NO_SHOW', 'No show'),
];

export type DayOfWeek =
  'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export type AvailabilityWindow = {
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  isAvailable: boolean;
  vetIds: string[];
};

export type AvailabilityData = {
  date: string; // "YYYY-MM-DD"
  dayOfWeek: DayOfWeek;
  windows: AvailabilityWindow[];
};

export interface AvailabilityResponse {
  success: boolean;
  data: AvailabilityData;
}

export type Slot = {
  startTime: string;
  endTime: string;
  vetIds: string[];
};

export type SlotsResponse = {
  slots: Slot[];
};

export const AppointmentStatusFilters: StatusOption[] = [
  statusFromToken('All', 'all', 'status-requested'),
  statusFromToken('Requested', 'requested', 'status-requested'),
  statusFromToken('Upcoming', 'upcoming', 'status-upcoming'),
  statusFromToken('Checked-in', 'checked_in', 'status-checked-in'),
  statusFromToken('In progress', 'in_progress', 'status-in-progress'),
  statusFromToken('Completed', 'completed', 'status-completed'),
  statusFromToken('Cancelled', 'cancelled', 'status-cancelled'),
  statusFromToken('No show', 'no_show', 'status-no-show'),
];

export const AppointmentStatusFiltersUI: StatusOption[] = AppointmentStatusFilters;

export const AppointmentFilters = [filter('Emergencies', 'emergencies')];

type ReasonOptions =
  'APPOINTMENT_USAGE' | 'MANUAL_ADJUSTMENT' | 'GROOMING_USAGE' | 'BOARDING_USAGE' | 'OTHER';

export type InventoryConsumeRequest = {
  itemId: string;
  quantity: number;
  reason: ReasonOptions;
  referenceId?: string;
};
