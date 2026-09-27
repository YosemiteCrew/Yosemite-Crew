'use client';

import React, { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { IoChevronDownOutline, IoChevronForwardOutline, IoClipboardOutline } from 'react-icons/io5';
import type { AppointmentWithCompanion } from '@/app/features/appointments/types/appointments';
import type { ObservationRecord, Vitals } from '@/app/features/appointments/types/workspace';
import type { Task } from '@/app/features/tasks/types/task';
import {
  useAppointmentsForPrimaryOrg,
  useLoadAppointmentsForPrimaryOrg,
} from '@/app/hooks/useAppointments';
import { useTasksForPrimaryOrg, useLoadTasksForPrimaryOrg } from '@/app/hooks/useTask';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAuthStore } from '@/app/stores/authStore';
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

type HandoverRecords = { vitals: Vitals[]; observations: ObservationRecord[] };
type HandoverAppointment = AppointmentWithCompanion & { id: string };
type HandoverVisit = { appointment: HandoverAppointment; openTasks: Task[] };

const OPEN_TASK_STATUSES = new Set<Task['status']>(['PENDING', 'IN_PROGRESS']);
const ACTIVE_APPOINTMENT_STATUSES = new Set(['CHECKED_IN', 'IN_PROGRESS']);

export const getHandoverVisits = (
  appointments: AppointmentWithCompanion[],
  tasks: Task[]
): HandoverVisit[] => {
  const appointmentsWithIds = appointments.filter(
    (appointment): appointment is HandoverAppointment => Boolean(appointment.id)
  );
  const openTasksByAppointment = new Map<string, Task[]>(
    appointmentsWithIds.map(({ id }) => [id, []])
  );

  tasks.forEach((task) => {
    if (
      task.audience !== 'EMPLOYEE_TASK' ||
      !task.appointmentId ||
      !OPEN_TASK_STATUSES.has(task.status) ||
      !openTasksByAppointment.has(task.appointmentId)
    )
      return;
    openTasksByAppointment.get(task.appointmentId)!.push(task);
  });

  return appointmentsWithIds
    .filter(
      (appointment) =>
        ACTIVE_APPOINTMENT_STATUSES.has(appointment.status) ||
        openTasksByAppointment.get(appointment.id)!.length > 0
    )
    .map((appointment) => ({
      appointment,
      openTasks: openTasksByAppointment.get(appointment.id)!,
    }))
    .sort(
      (left, right) =>
        new Date(left.appointment.startTime).getTime() -
        new Date(right.appointment.startTime).getTime()
    );
};

const getVisitStatusLabel = (status: AppointmentWithCompanion['status']) => {
  if (status === 'IN_PROGRESS') return 'In progress';
  if (status === 'CHECKED_IN') return 'Checked in';
  return 'Open work';
};

const formatVisitTime = (value: Date | string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(date);
};

const formatRecordTime = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time not recorded'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
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

const HandoverVisitCard = ({
  visit,
  organisationId,
  actor,
}: {
  visit: HandoverVisit;
  organisationId: string | null;
  actor: { id?: string; name: string };
}) => {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [records, setRecords] = useState<HandoverRecords | null>(null);
  const { appointment, openTasks } = visit;
  const appointmentId = appointment.id;

  const loadRecords = useCallback(async () => {
    if (!organisationId) return;
    setLoading(true);
    setError(false);
    try {
      const [vitals, observations] = await Promise.all([
        listVitalRecordsForAppointment(organisationId, appointmentId, {
          encounterId: appointment.encounterId,
          authorId: actor.id,
          authorName: actor.name,
        }),
        listObservationSubmissionsForAppointment(appointmentId),
      ]);
      setRecords({ vitals, observations });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [actor.id, actor.name, appointment.encounterId, appointmentId, organisationId]);

  const toggleRecords = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !records && !error) void loadRecords();
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_3px_var(--sh03)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-caption-2 font-semibold text-[var(--ink-muted)]">
            {formatVisitTime(appointment.startTime)} · {getVisitStatusLabel(appointment.status)}
          </p>
          <h2 className="mt-1 truncate text-body-2 font-bold text-[var(--ink)]">
            {appointment.patient.name}
          </h2>
          <p className="mt-0.5 text-caption-1 text-[var(--ink-muted)]">
            {appointment.appointmentType?.name ?? 'Appointment'}
            {appointment.room?.name ? ` · ${appointment.room.name}` : ''}
          </p>
        </div>
        <Link
          href={`/appointments/${encodeURIComponent(appointmentId)}/workspace`}
          className="inline-flex min-h-10 items-center rounded-full border border-[var(--hairline)] px-4 text-caption-1 font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
        >
          Open visit
        </Link>
      </div>

      <div className="grid gap-4 border-t border-[var(--hairline)] px-4 py-4 sm:grid-cols-2 sm:px-5">
        <section aria-label="Open work">
          <h3 className="mb-2 flex items-center gap-2 text-caption-1 font-bold text-[var(--ink)]">
            <IoClipboardOutline aria-hidden="true" /> Open work{' '}
            <span className="text-[var(--ink-muted)]">{openTasks.length}</span>
          </h3>
          {openTasks.length ? (
            <ul className="space-y-2">
              {openTasks.map((task) => (
                <li
                  key={task._id}
                  className="flex items-start justify-between gap-3 text-caption-1"
                >
                  <span className="text-[var(--ink-body)]">{task.name}</span>
                  <span className="shrink-0 text-[var(--ink-muted)]">
                    {task.status === 'IN_PROGRESS' ? 'In progress' : 'Not started'}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption-1 text-[var(--ink-muted)]">
              No open work linked to this visit.
            </p>
          )}
        </section>

        <section aria-label="Recorded observations">
          <button
            type="button"
            onClick={toggleRecords}
            aria-expanded={expanded}
            aria-controls={`handover-records-${appointmentId}`}
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
            <div id={`handover-records-${appointmentId}`} className="mt-2 space-y-3">
              {loading && (
                <p role="status" className="text-caption-1 text-[var(--ink-muted)]">
                  Loading saved records…
                </p>
              )}
              {error && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center gap-2 text-caption-1 text-[var(--ink-body)]"
                >
                  <span>Saved records could not be loaded.</span>
                  <button
                    type="button"
                    onClick={() => void loadRecords()}
                    className="font-semibold text-blue-text underline"
                  >
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
                <div
                  key={vital.id}
                  className="rounded-xl bg-[var(--inset)] px-3 py-2 text-caption-1"
                >
                  <p className="font-semibold text-[var(--ink)]">Vitals · {vitalSummary(vital)}</p>
                  <p className="mt-0.5 text-[var(--ink-muted)]">
                    Recorded by {vital.recordedByName} · {formatRecordTime(vital.recordedAt)}
                  </p>
                </div>
              ))}
              {records?.observations.map((observation) => (
                <div
                  key={observation.id}
                  className="rounded-xl bg-[var(--inset)] px-3 py-2 text-caption-1"
                >
                  <p className="font-semibold text-[var(--ink)]">
                    {observation.toolName}
                    {observation.total === undefined ? '' : ` · Score ${observation.total}`}
                  </p>
                  <p className="mt-0.5 text-[var(--ink-muted)]">
                    Recorded by {observation.recordedByName} ·{' '}
                    {formatRecordTime(observation.recordedAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </article>
  );
};

const NurseHandover = () => {
  useLoadAppointmentsForPrimaryOrg();
  useLoadTasksForPrimaryOrg();
  const appointments = useAppointmentsForPrimaryOrg();
  const tasks = useTasksForPrimaryOrg();
  const organisationId = useOrgStore((state) => state.primaryOrgId);
  const attributes = useAuthStore((state) => state.attributes);
  const actor = useMemo(
    () => ({
      id: attributes?.sub,
      name: `${attributes?.given_name ?? ''} ${attributes?.family_name ?? ''}`.trim() || 'You',
    }),
    [attributes]
  );
  const visits = useMemo(() => getHandoverVisits(appointments, tasks), [appointments, tasks]);

  return (
    <PermissionGate
      allOf={[PERMISSIONS.APPOINTMENTS_VIEW_ANY, PERMISSIONS.TASKS_VIEW_ANY]}
      deniedResource="Shift handover"
      deniedDetail="appointments and staff tasks"
    >
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
        {visits.length ? (
          <div className="space-y-3">
            {visits.map((visit) => (
              <HandoverVisitCard
                key={visit.appointment.id}
                visit={visit}
                organisationId={organisationId}
                actor={actor}
              />
            ))}
          </div>
        ) : (
          <section className="rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] px-5 py-8 text-center">
            <h2 className="text-body-2 font-bold text-[var(--ink)]">
              Nothing to hand over right now
            </h2>
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
        )}
      </div>
    </PermissionGate>
  );
};

export default NurseHandover;
