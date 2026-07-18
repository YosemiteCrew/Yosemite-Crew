'use client';
import React from 'react';
import { IoAddOutline, IoEllipsisHorizontal, IoPaperPlaneOutline } from 'react-icons/io5';
import SectionContainer from '@/app/ui/primitives/SectionContainer/SectionContainer';
import { getStatusStyle } from '@/app/config/statusConfig';
import type {
  OutpatientScheduleModel,
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

const StatusPill = ({ status }: { status: OutpatientVisitStatus }) => {
  const style = getStatusStyle(STATUS_STYLE_KEY[status]);
  return (
    <span
      className="text-caption-3 inline-flex w-fit items-center rounded-full! border px-2.5 py-1"
      style={{
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderColor: style.borderColor,
        borderWidth: '1px',
        borderStyle: 'solid',
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
};

const VisitRow = ({ visit }: { visit: OutpatientVisit }) => {
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
    <li className="flex items-center gap-3 border-t border-card-border px-4 py-3 first:border-t-0">
      <span className="flex w-12 shrink-0 flex-col items-center leading-tight">
        <span className="text-caption-2 font-bold uppercase tracking-wide text-text-tertiary">
          {marker.weekday}
        </span>
        <span className="text-body-3-emphasis tabular-nums text-text-primary">{marker.day}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-4 font-bold text-text-primary">
          {visit.title}
        </span>
        <span className="block truncate text-caption-1 text-text-tertiary">{subline}</span>
      </span>
      <StatusPill status={visit.status} />
      <IoEllipsisHorizontal size={15} aria-hidden="true" className="shrink-0 text-text-tertiary" />
    </li>
  );
};

const GroupHeading = ({ label }: { label: string }) => (
  <div className="px-4 pb-1.5 pt-3 text-caption-2 font-bold uppercase tracking-[0.1em] text-text-tertiary">
    {label}
  </div>
);

/**
 * Outpatient visit schedule for the Treatment step (design's "This week / Next week"
 * card). It is built from the companion's real upcoming appointments — there is no
 * dedicated outpatient "series" data model, so the series note / progress rail from the
 * design mock is intentionally omitted rather than fabricated. When no upcoming visits
 * are sourced it shows an empty state.
 */
const OutpatientSchedule = ({
  schedule,
  readOnly = false,
  onAddVisit,
}: OutpatientScheduleProps) => (
  <SectionContainer
    titleClassName="text-yc-20-b-primary"
    title="Visit schedule"
    className="flex flex-col gap-4"
  >
    <div className="overflow-hidden rounded-[14px] border border-card-border bg-neutral-0 shadow-[0_1px_2px_var(--sh03),0_8px_22px_var(--sh05)]">
      <div className="flex items-center justify-between border-b border-card-border px-4 py-2.5">
        <span className="text-body-4 font-bold text-text-primary">
          Scheduled outpatient visits · {schedule.total}
        </span>
        {onAddVisit && (
          <button
            type="button"
            disabled={readOnly}
            onClick={onAddVisit}
            className="inline-flex items-center gap-1.5 text-caption-1 font-semibold text-text-brand hover:underline disabled:opacity-50"
          >
            <IoAddOutline size={13} aria-hidden="true" />
            Add visit
          </button>
        )}
      </div>

      {schedule.total === 0 ? (
        <p className="px-4 py-6 text-center text-body-4 text-text-secondary">
          No scheduled visits for this companion.
        </p>
      ) : (
        <>
          {schedule.thisWeek.length > 0 && (
            <>
              <GroupHeading label="This week" />
              <ul>
                {schedule.thisWeek.map((visit) => (
                  <VisitRow key={visit.id} visit={visit} />
                ))}
              </ul>
            </>
          )}
          {schedule.nextWeek.length > 0 && (
            <>
              <GroupHeading label="Next week" />
              <ul>
                {schedule.nextWeek.map((visit) => (
                  <VisitRow key={visit.id} visit={visit} />
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
  </SectionContainer>
);

export default OutpatientSchedule;
