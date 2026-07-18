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

export const getEmergencyPillStyle = (isActive: boolean): React.CSSProperties => ({
  backgroundColor: isActive ? 'var(--color-semantic-error-100)' : 'var(--color-neutral-0)',
  borderColor: isActive ? 'var(--color-semantic-error-500)' : 'var(--color-neutral-500)',
  borderWidth: '1px',
  borderStyle: 'solid',
  borderRadius: '16px',
  boxShadow: '0 1px 10px 0 rgba(169, 163, 158, 0.10)',
  color: isActive ? 'var(--color-semantic-error-700)' : 'var(--color-neutral-700)',
});

export const getBoardOrgType = (
  appointment: Appointment,
  orgsById: Record<string, { type?: string } | undefined>
) => {
  return (appointment.organisationId && orgsById[appointment.organisationId]?.type) || 'HOSPITAL';
};
