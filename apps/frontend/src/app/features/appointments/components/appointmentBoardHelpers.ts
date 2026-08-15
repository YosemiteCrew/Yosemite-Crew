import React from 'react';
import { Appointment } from '@yosemite-crew/types';
import { normalizeAppointmentStatus } from '@/app/lib/appointments';

export type BoardStatus =
  'REQUESTED' | 'UPCOMING' | 'CHECKED_IN' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export const BOARD_COLUMNS: Array<{ key: BoardStatus; label: string }> = [
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'CHECKED_IN', label: 'Checked in' },
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

// Emergency filter pill. Selected and unselected must be unmistakable and AA-safe
// in both themes, so the selected state is a solid danger fill with a white label
// (--color-danger-800 is #a6271d in light and dark, so white clears ~7:1), while
// the unselected state stays an outline-only pill (--danger-border hairline,
// --danger-text ink).
export const getEmergencyPillStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? 'var(--color-danger-800)' : 'transparent',
  borderColor: isActive ? 'var(--color-danger-800)' : 'var(--danger-border)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: '9999px',
  color: isActive ? 'var(--color-white)' : 'var(--danger-text)',
});

export const getBoardOrgType = (
  appointment: Appointment,
  orgsById: Record<string, { type?: string } | undefined>
) => {
  return (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
};
