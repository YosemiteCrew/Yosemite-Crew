import type { Appointment } from '@yosemite-crew/types';
import { getAppointmentCompanion, normalizeAppointmentStatus } from '@/app/lib/appointments';

export type OutpatientVisitStatus = 'SCHEDULED' | 'PROPOSED';
export type OutpatientVisitGroup = 'THIS_WEEK' | 'NEXT_WEEK';

export type OutpatientVisit = {
  id: string;
  title: string;
  /** ISO start timestamp. */
  startTime: string;
  durationMinutes?: number;
  leadName?: string;
  roomName?: string;
  status: OutpatientVisitStatus;
  group: OutpatientVisitGroup;
};

export type OutpatientScheduleModel = {
  thisWeek: OutpatientVisit[];
  nextWeek: OutpatientVisit[];
  total: number;
  proposedCount: number;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const toMs = (value?: Date | string): number | undefined => {
  if (!value) return undefined;
  const ms = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(ms) ? undefined : ms;
};

/** Appointment statuses that read as a proposed (owner-confirmation-pending) visit. */
const isProposedStatus = (status: string | null): boolean =>
  status === 'REQUESTED' || status === 'NO_PAYMENT';

/** Statuses that keep an appointment out of the upcoming outpatient list. */
const isExcludedStatus = (status: string | null): boolean =>
  status === 'CANCELLED' || status === 'NO_SHOW' || status === 'COMPLETED';

type BuildOptions = {
  companionId?: string;
  /** The current appointment, which is never listed as an upcoming visit. */
  excludeAppointmentId?: string;
  nowMs?: number;
};

/**
 * Derive the outpatient This-week / Next-week visit schedule for a companion from the
 * real appointment list already in the store. There is no dedicated outpatient "series"
 * data model, so this sources every FUTURE, non-cancelled appointment for the same
 * companion (excluding the current one) and buckets it by lead time. When nothing is
 * available the schedule is empty and the UI shows a "no scheduled visits" state — no
 * data is fabricated.
 */
export const buildOutpatientSchedule = (
  appointments: Appointment[],
  { companionId, excludeAppointmentId, nowMs = Date.now() }: BuildOptions
): OutpatientScheduleModel => {
  const thisWeek: OutpatientVisit[] = [];
  const nextWeek: OutpatientVisit[] = [];

  for (const appointment of appointments) {
    if (!appointment.id || appointment.id === excludeAppointmentId) continue;
    const companion = getAppointmentCompanion(appointment);
    if (companionId && companion?.id !== companionId) continue;

    const startMs = toMs(appointment.startTime);
    if (startMs === undefined || startMs <= nowMs) continue;

    const normalized = normalizeAppointmentStatus(appointment.status);
    if (isExcludedStatus(normalized)) continue;

    const visit: OutpatientVisit = {
      id: appointment.id,
      title: appointment.appointmentType?.name?.trim() || 'Scheduled visit',
      startTime: new Date(startMs).toISOString(),
      durationMinutes: appointment.durationMinutes,
      leadName: appointment.lead?.name?.trim() || undefined,
      roomName: appointment.room?.name?.trim() || undefined,
      status: isProposedStatus(normalized) ? 'PROPOSED' : 'SCHEDULED',
      group: startMs - nowMs < WEEK_MS ? 'THIS_WEEK' : 'NEXT_WEEK',
    };
    (visit.group === 'THIS_WEEK' ? thisWeek : nextWeek).push(visit);
  }

  const byStart = (a: OutpatientVisit, b: OutpatientVisit) =>
    a.startTime < b.startTime ? -1 : a.startTime > b.startTime ? 1 : 0;
  thisWeek.sort(byStart);
  nextWeek.sort(byStart);

  const all = [...thisWeek, ...nextWeek];
  return {
    thisWeek,
    nextWeek,
    total: all.length,
    proposedCount: all.filter((visit) => visit.status === 'PROPOSED').length,
  };
};
