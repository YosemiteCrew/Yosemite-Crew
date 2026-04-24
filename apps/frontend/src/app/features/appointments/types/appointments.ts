import { filter, status, StatusOption } from '@/app/features/companions/pages/Companions/types';
import type { Appointment } from '@yosemite-crew/types';

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
  | 'MONDAY'
  | 'TUESDAY'
  | 'WEDNESDAY'
  | 'THURSDAY'
  | 'FRIDAY'
  | 'SATURDAY'
  | 'SUNDAY';

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
  status('All', 'all', '#f5f3f1', '#5c5956', '#a9a39e'),
  status('Requested', 'requested', '#f5f3f1', '#5c5956', '#a9a39e'),
  status('Upcoming', 'upcoming', '#e6f2ff', '#0057c2', '#007cf5'),
  status('Checked-in', 'checked_in', '#eef2ff', '#3730a3', '#6366f1'),
  status('In progress', 'in_progress', '#f5f3ff', '#5b21b6', '#8b5cf6'),
  status('Completed', 'completed', '#f0fdf4', '#166534', '#64c487'),
  status('Cancelled', 'cancelled', '#fff7ed', '#9a3412', '#f97316'),
  status('No show', 'no_show', '#fff7ed', '#9a3412', '#f97316'),
];

export const AppointmentStatusFiltersUI: StatusOption[] = AppointmentStatusFilters;

export const AppointmentFilters = [filter('Emergencies', 'emergencies')];

type ReasonOptions =
  | 'APPOINTMENT_USAGE'
  | 'MANUAL_ADJUSTMENT'
  | 'GROOMING_USAGE'
  | 'BOARDING_USAGE'
  | 'OTHER';

export type InventoryConsumeRequest = {
  itemId: string;
  quantity: number;
  reason: ReasonOptions;
  referenceId?: string;
};
