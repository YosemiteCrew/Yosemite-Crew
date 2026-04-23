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
  status(
    'All',
    'all',
    'var(--status-requested-bg)',
    'var(--status-requested-text)',
    'var(--status-requested-border)'
  ),
  status(
    'Requested',
    'requested',
    'var(--status-requested-bg)',
    'var(--status-requested-text)',
    'var(--status-requested-border)'
  ),
  status(
    'Upcoming',
    'upcoming',
    'var(--status-upcoming-bg)',
    'var(--status-upcoming-text)',
    'var(--status-upcoming-border)'
  ),
  status(
    'Checked-in',
    'checked_in',
    'var(--status-checked-in-bg)',
    'var(--status-checked-in-text)',
    'var(--status-checked-in-border)'
  ),
  status(
    'In progress',
    'in_progress',
    'var(--status-in-progress-bg)',
    'var(--status-in-progress-text)',
    'var(--status-in-progress-border)'
  ),
  status(
    'Completed',
    'completed',
    'var(--status-completed-bg)',
    'var(--status-completed-text)',
    'var(--status-completed-border)'
  ),
  status(
    'Cancelled',
    'cancelled',
    'var(--status-cancelled-bg)',
    'var(--status-cancelled-text)',
    'var(--status-cancelled-border)'
  ),
  status(
    'No show',
    'no_show',
    'var(--status-no-show-bg)',
    'var(--status-no-show-text)',
    'var(--status-no-show-border)'
  ),
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
