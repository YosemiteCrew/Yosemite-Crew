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

type VisitContext = {
  companionId?: string;
  excludeAppointmentId?: string;
  nowMs: number;
};

const byStart = (a: OutpatientVisit, b: OutpatientVisit): number => {
  if (a.startTime < b.startTime) return -1;
  if (a.startTime > b.startTime) return 1;
  return 0;
};

/** Map a single appointment to an outpatient visit, or null when it should be skipped. */
const toOutpatientVisit = (
  appointment: Appointment,
  { companionId, excludeAppointmentId, nowMs }: VisitContext
): OutpatientVisit | null => {
  if (!appointment.id || appointment.id === excludeAppointmentId) return null;
  const companion = getAppointmentCompanion(appointment);
  if (companionId && companion?.id !== companionId) return null;

  const startMs = toMs(appointment.startTime);
  if (startMs === undefined || startMs <= nowMs) return null;

  const normalized = normalizeAppointmentStatus(appointment.status);
  if (isExcludedStatus(normalized)) return null;

  return {
    id: appointment.id,
    title: appointment.appointmentType?.name?.trim() || 'Scheduled visit',
    startTime: new Date(startMs).toISOString(),
    durationMinutes: appointment.durationMinutes,
    leadName: appointment.lead?.name?.trim() || undefined,
    roomName: appointment.room?.name?.trim() || undefined,
    status: isProposedStatus(normalized) ? 'PROPOSED' : 'SCHEDULED',
    group: startMs - nowMs < WEEK_MS ? 'THIS_WEEK' : 'NEXT_WEEK',
  };
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
    const visit = toOutpatientVisit(appointment, { companionId, excludeAppointmentId, nowMs });
    if (!visit) continue;
    (visit.group === 'THIS_WEEK' ? thisWeek : nextWeek).push(visit);
  }

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
