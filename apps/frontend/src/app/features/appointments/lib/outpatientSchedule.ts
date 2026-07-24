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
  /**
   * 1-based position of this visit in a booked course of sessions, and the length
   * of that course — the design's "Laser therapy · session 2 of 6" suffix. Both
   * come from `Appointment.seriesIndex` / `seriesTotal`, which no backend supplies
   * yet, so the suffix is rendered only when BOTH are present.
   */
  seriesIndex?: number;
  seriesTotal?: number;
};

/** Sessions delivered out of the course length — the design's "1 / 6 done" rail. */
export type OutpatientSeriesProgress = {
  completed: number;
  total: number;
};

export type OutpatientScheduleModel = {
  thisWeek: OutpatientVisit[];
  nextWeek: OutpatientVisit[];
  total: number;
  proposedCount: number;
  /**
   * BACKEND WORK REQUIRED (`Appointment.seriesCompletedCount` + `seriesTotal`).
   * Present only when the backend reports both; it is never inferred from
   * `seriesIndex`, because a scheduled session 2 does not prove session 1 was
   * delivered. Absent means the design's progress rail is not rendered.
   */
  seriesProgress?: OutpatientSeriesProgress;
  /** BACKEND WORK REQUIRED (`Appointment.seriesNote`) — the design's "Series note" card. */
  seriesNote?: string;
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
  /**
   * The appointment the workspace is open on. It is the only carrier of the
   * course-level series signals (note + delivered count), since a series belongs
   * to the visit being worked on rather than to the upcoming list.
   */
  currentAppointment?: Appointment;
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

/** Accept a series count only when it is a real, non-negative whole number. */
const wholeCount = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : undefined;

const positiveInteger = (value: unknown): number | undefined => {
  const count = wholeCount(value);
  return count && count > 0 ? count : undefined;
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
    seriesIndex: positiveInteger(appointment.seriesIndex),
    seriesTotal: positiveInteger(appointment.seriesTotal),
  };
};

/**
 * The course-level progress for the visit in hand. Requires BOTH a delivered
 * count and a course length from the backend, and never derives one from the
 * other; anything else yields undefined and the design's rail stays hidden.
 */
const toSeriesProgress = (
  appointment: Appointment | undefined
): OutpatientSeriesProgress | undefined => {
  if (!appointment) return undefined;
  const completed = wholeCount(appointment.seriesCompletedCount);
  const total = positiveInteger(appointment.seriesTotal);
  if (completed === undefined || total === undefined || completed > total) return undefined;
  return { completed, total };
};

/**
 * Derive the outpatient This-week / Next-week visit schedule for a companion from the
 * real appointment list already in the store. There is still no dedicated outpatient
 * treatment-series model in the backend, so this sources every FUTURE, non-cancelled
 * appointment for the same companion (excluding the current one) and buckets it by lead
 * time. When nothing is available the schedule is empty and the UI shows a "no scheduled
 * visits" state — no data is fabricated.
 *
 * The series signals (`seriesProgress`, `seriesNote`, and each visit's session position)
 * are pass-throughs of optional `Appointment` fields that no backend populates yet. They
 * stay undefined today and the corresponding design elements are simply not rendered.
 */
export const buildOutpatientSchedule = (
  appointments: Appointment[],
  { companionId, excludeAppointmentId, nowMs = Date.now(), currentAppointment }: BuildOptions
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
    seriesProgress: toSeriesProgress(currentAppointment),
    seriesNote: currentAppointment?.seriesNote?.trim() || undefined,
  };
};
