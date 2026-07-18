import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { normalizeAppointmentStatus } from '@/app/lib/appointments';

export type BoardStatus =
  'REQUESTED' | 'UPCOMING' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export const BOARD_COLUMNS: Array<{ key: BoardStatus; label: string }> = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'CHECKED_IN', label: 'Checked-in' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'CANCELLED', label: 'Cancelled' },
  { key: 'NO_SHOW', label: 'No show' },
];

export const normalizeStatus = (status?: string): BoardStatus | null => {
  return normalizeAppointmentStatus(status);
};

const MUTED_BOARD_STATUSES: ReadonlySet<BoardStatus> = new Set<BoardStatus>([
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
]);

/** Closed-out columns recede on the board so live work stays dominant. */
export const isMutedBoardStatus = (status: BoardStatus | null): boolean =>
  !!status && MUTED_BOARD_STATUSES.has(status);

// Slim danger-outlined emergency pill matching the rebuilt calendar toolbar recipe
// (rounded-full, --danger-border hairline, --danger-text ink; filled with --danger-bg when active).
export const getEmergencyPillStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? 'var(--danger-bg)' : 'transparent',
  borderColor: 'var(--danger-border)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: '9999px',
  color: 'var(--danger-text)',
});

export const getBoardOrgType = (
  appointment: Appointment,
  orgsById: Record<string, { type?: string } | undefined>
) => {
  return (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
};
