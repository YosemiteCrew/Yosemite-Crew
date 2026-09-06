'use client';
import React from 'react';
import { IoAddOutline, IoEllipsisHorizontal, IoPaperPlaneOutline } from 'react-icons/io5';
import './OutpatientSchedule.css';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import SharedStatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import { getAppointmentStatusTone } from '@/app/config/statusConfig';
import type {
  OutpatientScheduleModel,
  OutpatientSeriesProgress,
  OutpatientVisit,
  OutpatientVisitStatus,
} from '@/app/features/appointments/lib/outpatientSchedule';

type OutpatientScheduleProps = {
  schedule: OutpatientScheduleModel;
  readOnly?: boolean;
  /** Create a new visit (routes to the appointments booking flow). */
  onAddVisit?: () => void;
};

const STATUS_LABEL: Record<OutpatientVisitStatus, string> = {
  SCHEDULED: 'Scheduled',
  PROPOSED: 'Proposed',
};

// SCHEDULED reuses the neutral "upcoming" chip; PROPOSED reuses "requested" — the
// same status token source as the appointment status pill, so colours stay in sync.
const STATUS_STYLE_KEY: Record<OutpatientVisitStatus, string> = {
  SCHEDULED: 'upcoming',
  PROPOSED: 'requested',
};

const pad2 = (value: number): string => String(value).padStart(2, '0');

/** Local "HH:MM" clock label for a visit start. */
const timeLabel = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
};

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

const dayMarker = (iso: string): { weekday: string; day: string } => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return { weekday: '--', day: '--' };
  return { weekday: WEEKDAYS[date.getDay()], day: String(date.getDate()) };
};

const StatusPill = ({ status }: { status: OutpatientVisitStatus }) => (
  <SharedStatusPill
    tone={getAppointmentStatusTone(STATUS_STYLE_KEY[status])}
    label={STATUS_LABEL[status]}
    className="w-fit"
  />
);

/**
 * "Laser therapy · session 2 of 6" — the design's session suffix. Only appended
 * when the backend reports both the position and the course length; otherwise the
 * plain visit title is shown.
 */
const visitTitle = (visit: OutpatientVisit): string =>
  visit.seriesIndex && visit.seriesTotal
    ? `${visit.title} · session ${visit.seriesIndex} of ${visit.seriesTotal}`
    : visit.title;

const VisitRow = ({ visit, isNext = false }: { visit: OutpatientVisit; isNext?: boolean }) => {
  const marker = dayMarker(visit.startTime);
  const subline = [
    timeLabel(visit.startTime),
    visit.durationMinutes ? `${visit.durationMinutes} min` : undefined,
    visit.leadName,
    visit.roomName,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <li
      className="flex items-center gap-3 border-t border-card-border px-4 py-3 first:border-t-0"
      style={
        isNext
          ? { background: 'var(--surface-soft)', boxShadow: 'inset 3px 0 0 var(--blue)' }
          : undefined
      }
    >
      <span className="flex w-12 shrink-0 flex-col items-center leading-tight">
        <span
          className="text-[10px] font-bold uppercase tracking-wide"
          style={{ color: 'var(--ink-faint)' }}
        >
          {marker.weekday}
        </span>
        <span className="text-[17px] font-bold tabular-nums" style={{ color: 'var(--ink)' }}>
          {marker.day}
        </span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-4 font-bold text-text-primary">
          {visitTitle(visit)}
        </span>
        <span className="block truncate text-caption-1 text-text-tertiary">{subline}</span>
      </span>
      <StatusPill status={visit.status} />
      <IoEllipsisHorizontal size={15} aria-hidden="true" className="shrink-0 text-text-tertiary" />
    </li>
  );
};

/** The design's inset "Series note" card — shown only when a note actually exists. */
const SeriesNote = ({ note }: { note: string }) => (
  <div
    className="flex flex-col gap-1.5 rounded-[14px] border px-4 py-3"
    style={{ background: 'var(--inset)', borderColor: 'var(--divider)' }}
  >
    <span
      className="text-caption-2 font-bold uppercase tracking-[0.1em]"
      style={{ color: 'var(--ink-faint)' }}
    >
      Series note
    </span>
    <span className="text-body-4 leading-relaxed" style={{ color: 'var(--ink-body)' }}>
      {note}
    </span>
  </div>
);

/**
 * The design's "Series progress · 1 / 6 done" rail. The fill is a real ratio of
 * backend-reported counts, so it is rendered only when both are known. The rail is
 * a native <progress> — the engine derives the fill from value/max, and the design's
 * pill geometry and token colours are restyled in OutpatientSchedule.css.
 */
const SeriesProgressRail = ({ progress }: { progress: OutpatientSeriesProgress }) => (
  <div className="flex items-center justify-between gap-3 rounded-[14px] border border-card-border bg-neutral-0 px-4 py-3 shadow-[0_1px_2px_var(--sh03)]">
    <span className="shrink-0 text-body-4 text-text-secondary">Series progress</span>
    <progress
      className="yc-series-progress"
      aria-label="Series progress"
      value={progress.completed}
      max={progress.total}
    />
    <span className="shrink-0 text-body-4 font-bold tabular-nums text-text-primary">
      {progress.completed} / {progress.total} done
    </span>
  </div>
);

const GroupHeading = ({ label }: { label: string }) => (
  <div className="px-4 pb-1.5 pt-3 text-caption-2 font-bold uppercase tracking-[0.1em] text-text-tertiary">
    {label}
  </div>
);

/**
 * Outpatient visit schedule for the Treatment step (design's "This week / Next week"
 * card), including the design's highlight on the nearest visit. It is built from the
 * companion's real upcoming appointments.
 *
 * The design's series note and series-progress rail render only when the schedule
 * actually carries them; no backend populates the underlying `Appointment` series
 * fields yet, so today they are simply absent rather than fabricated. When no
 * upcoming visits are sourced the list shows an empty state.
 */
const OutpatientSchedule = ({
  schedule,
  readOnly = false,
  onAddVisit,
}: OutpatientScheduleProps) => {
  // The design highlights the nearest upcoming visit with a soft wash and a blue
  // inset spine; the schedule is already ordered, so that is the first row.
  const nextVisitId = schedule.thisWeek[0]?.id ?? schedule.nextWeek[0]?.id;

  return (
    <SectionContainer title="Task schedule" className="flex flex-col gap-4">
      <div className="overflow-hidden yc-card-surface yc-card-surface--inset">
        <div className="flex items-center justify-between border-b border-card-border px-4 py-2.5">
          <span className="text-body-4 font-bold text-text-primary">
            Scheduled outpatient tasks · {schedule.total}
          </span>
          {onAddVisit && (
            <button
              type="button"
              disabled={readOnly}
              onClick={onAddVisit}
              className="inline-flex items-center gap-1.5 text-caption-1 font-semibold text-blue-text hover:underline disabled:opacity-50"
            >
              <IoAddOutline size={13} aria-hidden="true" />
              Add task
            </button>
          )}
        </div>

        {schedule.total === 0 ? (
          <p className="px-4 py-6 text-center text-body-4 text-text-secondary">
            No scheduled tasks for this companion.
          </p>
        ) : (
          <>
            {schedule.thisWeek.length > 0 && (
              <>
                <GroupHeading label="This week" />
                <ul>
                  {schedule.thisWeek.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} isNext={visit.id === nextVisitId} />
                  ))}
                </ul>
              </>
            )}
            {schedule.nextWeek.length > 0 && (
              <>
                <GroupHeading label="Next week" />
                <ul>
                  {schedule.nextWeek.map((visit) => (
                    <VisitRow key={visit.id} visit={visit} isNext={visit.id === nextVisitId} />
                  ))}
                </ul>
              </>
            )}
            {schedule.proposedCount > 0 && (
              <div className="flex items-center gap-2 border-t border-card-border px-4 py-3 text-caption-1 text-text-tertiary">
                <IoPaperPlaneOutline size={13} aria-hidden="true" className="shrink-0" />
                {schedule.proposedCount} proposed visit
                {schedule.proposedCount === 1 ? '' : 's'} awaiting owner confirmation
              </div>
            )}
          </>
        )}
      </div>
      {schedule.seriesNote && <SeriesNote note={schedule.seriesNote} />}
      {schedule.seriesProgress && <SeriesProgressRail progress={schedule.seriesProgress} />}
    </SectionContainer>
  );
};

export default OutpatientSchedule;
