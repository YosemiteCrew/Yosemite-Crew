'use client';

import React, { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { IoChevronDownOutline, IoChevronForwardOutline, IoClipboardOutline } from 'react-icons/io5';
import type { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import type { ObservationRecord, Vitals } from '@/app/features/appointments/types/workspace';
import type { Task } from '@/app/features/tasks/types/task';
import { useAppointmentsForPrimaryOrg } from '@/app/hooks/useAppointments';
import { useTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
import { loadAppointmentsForPrimaryOrg } from '@/app/features/appointments/services/appointmentService';
import { loadTasksForPrimaryOrg } from '@/app/features/tasks/services/taskService';
import {
  listObservationSubmissionsForAppointment,
  listVitalRecordsForAppointment,
} from '@/app/features/appointments/services/workspaceClinicalService';
import {
  formatReading,
  temperatureReading,
  weightReading,
} from '@/app/features/appointments/lib/vitalsUnits';
import { PermissionGate } from '@/app/ui/layout/guards/PermissionGate';
import { PERMISSIONS } from '@/app/lib/permissions';
import { useHasPermission } from '@/app/hooks/usePermissions';
import { canEnterAppointmentWorkspace } from '@/app/lib/appointmentWorkspace';
import { getHandoverVisits } from './handoverUtils';
import { getPreferredTimeZone } from '@/app/lib/timezone';

type HandoverRecords = { vitals: Vitals[]; observations: ObservationRecord[] };
type HandoverVisit = { appointment: AppointmentWithCompanion & { id: string }; openTasks: Task[] };

const subscribeToTimezoneChanges = (listener: () => void) => {
  window.addEventListener('yc:timezone-changed', listener);
  return () => window.removeEventListener('yc:timezone-changed', listener);
};

const getServerTimezone = () => 'Europe/Berlin';

const getVisitStatusLabel = (status: AppointmentWithCompanion['status']) => {
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'CHECKED_IN') return 'Checked in';
  return 'Open work';
};

const LocalizedTimestamp = ({
  value,
  includeDate = false,
}: {
  value: Date | string;
  includeDate?: boolean;
}) => {
  const timeZone = useSyncExternalStore(
    subscribeToTimezoneChanges,
    getPreferredTimeZone,
    getServerTimezone
  );
  const date = new Date(value);
  const formatter = useMemo(
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        ...(includeDate
          ? { dateStyle: 'medium', timeStyle: 'short' }
          : { hour: 'numeric', minute: '2-digit' }),
      }),
    [includeDate, timeZone]
  );

  if (Number.isNaN(date.getTime()))
    return <>{includeDate ? 'Time not recorded' : 'Time unavailable'}</>;
  return <>{formatter.format(date)}</>;
};

const vitalSummary = (vital: Vitals) => {
  const readings = [
    formatReading(weightReading(vital), '—'),
    formatReading(temperatureReading(vital), '—'),
    vital.heartRateBpm === undefined ? '—' : `${vital.heartRateBpm} bpm`,
    vital.respRateBpm === undefined ? '—' : `${vital.respRateBpm} /min`,
  ].filter((reading) => reading !== '—');
  return readings.join(' · ') || 'No readings recorded';
};

const useHandoverRecords = (
  appointment: HandoverVisit['appointment'],
  organisationId: string | null,
  actor: { id?: string; name: string },
  canViewForms: boolean
) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [records, setRecords] = useState<HandoverRecords | null>(null);
  const appointmentId = appointment.id;

  const loadRecords = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(false);
    try {
      const [vitalsResult, observationsResult] = await Promise.allSettled([
        canViewForms
          ? listVitalRecordsForAppointment(organisationId, appointmentId, {
              encounterId: appointment.encounterId,
              authorId: actor.id,
              authorName: actor.name,
            })
          : Promise.resolve([]),
        listObservationSubmissionsForAppointment(appointmentId),
      ]);
      setRecords({
        vitals: vitalsResult.status === 'fulfilled' ? vitalsResult.value : [],
        observations: observationsResult.status === 'fulfilled' ? observationsResult.value : [],
      });
      setError(
        (canViewForms && vitalsResult.status === 'rejected') ||
          observationsResult.status === 'rejected'
      );
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [actor.id, actor.name, appointment.encounterId, appointmentId, canViewForms, organisationId]);

  return { loading, error, records, loadRecords };
};

const HandoverRecords = ({
  loading,
  error,
  records,
  onRetry,
}: {
  loading: boolean;
  error: boolean;
  records: HandoverRecords | null;
  onRetry: () => void;
}) => (
  <>
    {loading && (
      <output className="text-caption-1 text-[var(--ink-muted)]">Loading saved records…</output>
    )}
    {error && (
      <div
        role="alert"
        className="flex flex-wrap items-center gap-2 text-caption-1 text-[var(--ink-body)]"
      >
        <span>Some saved records could not be loaded.</span>
        <button type="button" onClick={onRetry} className="font-semibold text-blue-text underline">
          Try again
        </button>
      </div>
    )}
    {records && records.vitals.length + records.observations.length === 0 && (
      <p className="text-caption-1 text-[var(--ink-muted)]">
        No observations have been recorded for this visit.
      </p>
    )}
    {records?.vitals.map((vital) => (
      <div key={vital.id} className="rounded-xl bg-[var(--inset)] px-3 py-2 text-caption-1">
        <p className="font-semibold text-[var(--ink)]">Vitals · {vitalSummary(vital)}</p>
        <p className="mt-0.5 text-[var(--ink-muted)]">
          Recorded by {vital.recordedByName} ·{' '}
          <LocalizedTimestamp value={vital.recordedAt} includeDate />
        </p>
      </div>
    ))}
    {records?.observations.map((observation) => (
      <div key={observation.id} className="rounded-xl bg-[var(--inset)] px-3 py-2 text-caption-1">
        <p className="font-semibold text-[var(--ink)]">
          {observation.toolName}
          {observation.total === undefined ? '' : ` · Score ${observation.total}`}
        </p>
        <p className="mt-0.5 text-[var(--ink-muted)]">
          Recorded by {observation.recordedByName} ·{' '}
          <LocalizedTimestamp value={observation.recordedAt} includeDate />
        </p>
      </div>
    ))}
  </>
);

const HandoverObservations = ({
  appointment,
  organisationId,
  actor,
  canViewForms,
}: {
  appointment: HandoverVisit['appointment'];
  organisationId: string | null;
  actor: { id?: string; name: string };
  canViewForms: boolean;
}) => {
  const [expanded, setExpanded] = useState(false);
  const { loading, error, records, loadRecords } = useHandoverRecords(
    appointment,
    organisationId,
    actor,
    canViewForms
  );
  const toggleRecords = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !records && !error) void loadRecords();
  };

  return (
    <section aria-label="Recorded observations">
      <button
        type="button"
        onClick={toggleRecords}
        aria-expanded={expanded}
        aria-controls={`handover-records-${appointment.id}`}
        className="flex min-h-8 items-center gap-2 text-left text-caption-1 font-bold text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
      >
        {expanded ? (
          <IoChevronDownOutline aria-hidden="true" />
        ) : (
          <IoChevronForwardOutline aria-hidden="true" />
        )}
        Recorded observations
      </button>
      {expanded && (
        <div id={`handover-records-${appointment.id}`} className="mt-2 space-y-3">
          <HandoverRecords
            loading={loading}
            error={error}
            records={records}
            onRetry={() => void loadRecords()}
          />
        </div>
      )}
    </section>
  );
};

const HandoverOpenWork = ({ tasks }: { tasks: Task[] }) => (
  <section aria-label="Open work">
    <h3 className="mb-2 flex items-center gap-2 text-caption-1 font-bold text-[var(--ink)]">
      <IoClipboardOutline aria-hidden="true" /> Open work{' '}
      <span className="text-[var(--ink-muted)]">{tasks.length}</span>
    </h3>
    {tasks.length ? (
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task._id} className="flex items-start justify-between gap-3 text-caption-1">
            <span className="text-[var(--ink-body)]">{task.name}</span>
            <span className="shrink-0 text-[var(--ink-muted)]">
              {task.status === 'IN_PROGRESS' ? 'In progress' : 'Not started'}
            </span>
          </li>
        ))}
      </ul>
    ) : (
      <p className="text-caption-1 text-[var(--ink-muted)]">No open work linked to this visit.</p>
    )}
  </section>
);

const HandoverVisitCard = ({
  visit,
  organisationId,
  actor,
  canViewForms,
}: {
  visit: HandoverVisit;
  organisationId: string | null;
  actor: { id?: string; name: string };
  canViewForms: boolean;
}) => {
  const { appointment, openTasks } = visit;
  const appointmentId = appointment.id;

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_3px_var(--sh03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-caption-2 font-semibold text-[var(--ink-muted)]">
            <LocalizedTimestamp value={appointment.startTime} /> ·{' '}
            {getVisitStatusLabel(appointment.status)}
          </p>
          <h2 className="mt-1 truncate text-body-2 font-bold text-[var(--ink)]">
            {appointment.patient.name}
          </h2>
          <p className="mt-0.5 text-caption-1 text-[var(--ink-muted)]">
            {appointment.appointmentType?.name ?? 'Appointment'}
            {appointment.room?.name ? ` · ${appointment.room.name}` : ''}
          </p>
        </div>
        {canEnterAppointmentWorkspace(appointment.status) && (
          <Link
            href={`/appointments/${encodeURIComponent(appointmentId)}/workspace`}
            className="inline-flex min-h-10 items-center rounded-full border border-[var(--hairline)] px-4 text-caption-1 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            Open visit
          </Link>
        )}
      </div>

      <div className="grid gap-4 border-t border-[var(--hairline)] px-4 py-4 sm:grid-cols-2 sm:px-5">
        <HandoverOpenWork tasks={openTasks} />
        <HandoverObservations
          appointment={appointment}
          organisationId={organisationId}
          actor={actor}
          canViewForms={canViewForms}
        />
      </div>
    </article>
  );
};

const NurseHandoverContent = () => {
  const appointments = useAppointmentsForPrimaryOrg();
  const tasks = useTasksForPrimaryOrg();
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const attributes = useAuthStore((state) => state.attributes);
  const canViewForms = useHasPermission(PERMISSIONS.FORMS_VIEW_ANY);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const actor = useMemo(
    () => ({
      id: attributes?.sub,
      name: `${attributes?.given_name ?? ''} ${attributes?.family_name ?? ''}`.trim() || 'You',
    }),
    [attributes]
  );
  const visits = useMemo(() => getHandoverVisits(appointments, tasks), [appointments, tasks]);

  const loadHandover = useCallback(
    () =>
      Promise.allSettled(
        organisationId
          ? [
              loadAppointmentsForPrimaryOrg({ force: true, silent: true }),
              loadTasksForPrimaryOrg({ force: true, silent: true }),
            ]
          : []
      ),
    [organisationId]
  );

  const refreshHandover = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    void loadHandover().then((results) => {
      setLoadError(results.some((result) => result.status === 'rejected'));
      setLoading(false);
    });
  }, [loadHandover]);

  useEffect(() => {
    let active = true;
    void loadHandover().then((results) => {
      if (!active) return;
      setLoadError(results.some((result) => result.status === 'rejected'));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [loadHandover]);

  const loadErrorNotice = (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 text-body-4 text-[var(--ink-body)]"
    >
      <span>
        {visits.length
          ? 'Showing saved handover data; the latest updates could not be loaded.'
          : 'The latest handover could not be loaded.'}
      </span>
      <button
        type="button"
        onClick={refreshHandover}
        className="font-semibold text-blue-text underline"
      >
        Try again
      </button>
    </div>
  );

  let handoverContent: React.ReactNode;
  if (loading) {
    handoverContent = (
      <output className="text-body-4 text-[var(--ink-muted)]">Loading shift handover…</output>
    );
  } else if (!organisationId) {
    handoverContent = (
      <p className="text-body-4 text-[var(--ink-muted)]">
        Select a practice to view shift handover.
      </p>
    );
  } else if (loadError && !visits.length) {
    handoverContent = loadErrorNotice;
  } else if (visits.length) {
    handoverContent = (
      <div className="space-y-3">
        {loadError && loadErrorNotice}
        {visits.map((visit) => (
          <HandoverVisitCard
            key={visit.appointment.id}
            visit={visit}
            organisationId={organisationId}
            actor={actor}
            canViewForms={canViewForms}
          />
        ))}
      </div>
    );
  } else {
    handoverContent = (
      <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-5 py-8 text-center">
        <h2 className="text-body-2 font-bold text-[var(--ink)]">Nothing to hand over right now</h2>
        <p className="mt-1 text-caption-1 text-[var(--ink-muted)]">
          Checked-in visits and appointments with unfinished staff work will appear here.
        </p>
        <Link
          href="/appointments"
          className="mt-4 inline-flex min-h-10 items-center rounded-full bg-blue-strong px-4 text-caption-1 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          View appointments
        </Link>
      </section>
    );
  }

  return (
    <div className="yc-page-content flex flex-col gap-4">
      <header>
        <p className="text-caption-2 font-semibold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
          Care team
        </p>
        <h1 className="mt-1 text-page-title text-[var(--ink)]">Shift handover</h1>
        <p className="mt-1 max-w-2xl text-body-4 text-[var(--ink-muted)]">
          Current visits, saved observations and staff work that still needs attention.
        </p>
      </header>
      {handoverContent}
    </div>
  );
};

const NurseHandover = () => (
  <PermissionGate
    allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.TASKS_VIEW_ANY]}
    deniedResource="Shift handover"
    deniedDetail="appointments and staff tasks"
  >
    <NurseHandoverContent />
  </PermissionGate>
);

export default NurseHandover;
