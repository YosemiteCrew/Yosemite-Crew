import { AppointmentStatus } from '@/app/features/appointments/types/appointments';

export const isRequestedLikeStatus = (status?: AppointmentStatus | string | null) => {
  return status === 'REQUESTED' || status === 'NO_PAYMENT';
};

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  NO_PAYMENT: 'No payment',
  REQUESTED: 'Requested',
  UPCOMING: 'Upcoming',
  CHECKED_IN: 'Checked in',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No show',
};

const ALLOWED_STATUS_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  NO_PAYMENT: ['UPCOMING', 'CANCELLED'],
  REQUESTED: ['UPCOMING', 'CANCELLED'],
  UPCOMING: ['CHECKED_IN', 'CANCELLED', 'NO_SHOW'],
  CHECKED_IN: ['IN_PROGRESS', 'COMPLETED'],
  IN_PROGRESS: ['COMPLETED'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export const normalizeAppointmentStatus = (
  status?: AppointmentStatus | string | null
): AppointmentStatus | null => {
  if (!status) return null;
  if (status === 'NO_PAYMENT') return 'NO_PAYMENT';
  if (
    status === 'REQUESTED' ||
    status === 'UPCOMING' ||
    status === 'CHECKED_IN' ||
    status === 'IN_PROGRESS' ||
    status === 'COMPLETED' ||
    status === 'CANCELLED' ||
    status === 'NO_SHOW'
  ) {
    return status;
  }
  return null;
};

export const toStatusLabel = (status?: AppointmentStatus | string | null) => {
  const normalized = normalizeAppointmentStatus(status);
  if (!normalized) return 'Unknown';
  return STATUS_LABELS[normalized];
};

export const getAllowedAppointmentStatusTransitions = (
  currentStatus?: AppointmentStatus | string | null
): AppointmentStatus[] => {
  const normalized = normalizeAppointmentStatus(currentStatus);
  if (!normalized) return [];
  return ALLOWED_STATUS_TRANSITIONS[normalized];
};

export const canTransitionAppointmentStatus = (
  currentStatus: AppointmentStatus | string | null | undefined,
  nextStatus: AppointmentStatus
) => {
  const normalizedCurrent = normalizeAppointmentStatus(currentStatus);
  if (!normalizedCurrent) return false;
  if (normalizedCurrent === nextStatus) return true;
  return ALLOWED_STATUS_TRANSITIONS[normalizedCurrent].includes(nextStatus);
};

export const getInvalidAppointmentStatusTransitionMessage = (
  currentStatus: AppointmentStatus | string | null | undefined,
  nextStatus: AppointmentStatus
) => {
  const from = normalizeAppointmentStatus(currentStatus);
  const fromLabel = toStatusLabel(from);
  const toLabel = toStatusLabel(nextStatus);

  if (!from) return `Cannot change status to ${toLabel} from the current state.`;
  if (from === nextStatus) return '';

  if (nextStatus === 'REQUESTED' || nextStatus === 'NO_PAYMENT') {
    return 'Appointments cannot be moved back to Requested.';
  }

  if (from === 'CHECKED_IN' && (nextStatus === 'CANCELLED' || nextStatus === 'NO_SHOW')) {
    return 'Checked-in appointments cannot be cancelled or marked as no-show.';
  }

  if (from === 'UPCOMING' && nextStatus === 'IN_PROGRESS') {
    return 'Please check in the appointment before moving it to In progress.';
  }

  return `${fromLabel} appointments cannot be moved to ${toLabel}.`;
};

export const canShowStatusChangeAction = (status?: AppointmentStatus | string | null) => {
  if (isRequestedLikeStatus(status)) return false;
  return getAllowedAppointmentStatusTransitions(status).length > 0;
};

export const canAssignAppointmentRoom = (status?: AppointmentStatus | string | null) => {
  const normalized = normalizeAppointmentStatus(status);
  if (!normalized) return false;
  return ['UPCOMING', 'CHECKED_IN', 'IN_PROGRESS'].includes(normalized);
};

export const allowReschedule = (status: AppointmentStatus) => {
  return ['NO_PAYMENT', 'REQUESTED', 'UPCOMING'].includes(status);
};

export const allowCalendarDrag = (status: AppointmentStatus) => {
  return ['NO_PAYMENT', 'REQUESTED', 'UPCOMING'].includes(status);
};

export const getClinicalNotesLabel = (orgType?: string) => {
  return orgType === 'HOSPITAL' ? 'Prescription' : 'Care';
};

export const getClinicalNotesIntent = (orgType?: string) => {
  if (orgType === 'HOSPITAL') {
    return { label: 'prescription', subLabel: 'subjective' } as const;
  }

  return { label: 'care', subLabel: 'forms' } as const;
};
