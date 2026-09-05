'use client';
import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import {
  PanelEmptyState,
  PanelLoadingRows,
  panelFieldLabelClass as fieldLabelClass,
  panelInputClass as inputClass,
} from '@/app/ui/primitives/PanelStates/PanelStates';
import { CompanionSelect } from '@/app/features/appointments/components/CompanionSelect';
import { IoPulseOutline, IoAddOutline } from 'react-icons/io5';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import type {
  PatientCheckIn,
  CheckInStatus,
  TriagePriority,
  CreateCheckInPayload,
} from '@/app/features/appointments/services/patientCheckInService';

/** A companion the add-form offers as the subject of a new check-in. */
export type CheckInCompanionOption = {
  id: string;
  name: string;
  ownerName?: string;
  /** The linked client (owner) id, used as the required `clientId`. */
  clientId?: string;
};

/** A room the row's assign-room control offers. */
export type CheckInRoomOption = { id: string; name: string };

/**
 * A check-in row for display. The API row carries only ids; the container
 * resolves the companion/owner names and the assigned room name and attaches
 * them here, falling back to a generic label when a name is not loaded.
 */
export type PatientCheckInView = PatientCheckIn & {
  companionName?: string;
  ownerName?: string;
  roomName?: string;
};

export type CheckInBoardProps = {
  entries: PatientCheckInView[];
  companions?: CheckInCompanionOption[];
  rooms?: CheckInRoomOption[];
  loading?: boolean;
  error?: string | null;
  /** Id of the entry whose action is in flight, so its controls disable. */
  busyEntryId?: string | null;
  /** True shows every status; false (default) shows only active check-ins. */
  showAll?: boolean;
  onToggleShowAll?: (next: boolean) => void;
  onSeen?: (id: string) => void;
  onComplete?: (id: string) => void;
  onCancel?: (id: string) => void;
  onNoShow?: (id: string) => void;
  onAssignRoom?: (id: string, roomId: string) => void;
  /** Resolves true when the check-in was created, so the form can reset/close. */
  onAdd?: (payload: CreateCheckInPayload) => Promise<boolean>;
};

const TRIAGE_ORDER: TriagePriority[] = [
  'IMMEDIATE',
  'URGENT',
  'LESS_URGENT',
  'STANDARD',
  'NON_URGENT',
];

const TRIAGE_RANK: Record<TriagePriority, number> = {
  IMMEDIATE: 0,
  URGENT: 1,
  LESS_URGENT: 2,
  STANDARD: 3,
  NON_URGENT: 4,
};

const TRIAGE_TONE: Record<TriagePriority, StatusTone> = {
  IMMEDIATE: 'danger',
  URGENT: 'warning',
  LESS_URGENT: 'accent',
  STANDARD: 'info',
  NON_URGENT: 'neutral',
};

const TRIAGE_LABEL: Record<TriagePriority, string> = {
  IMMEDIATE: 'Immediate',
  URGENT: 'Urgent',
  LESS_URGENT: 'Less urgent',
  STANDARD: 'Standard',
  NON_URGENT: 'Non-urgent',
};

const STATUS_TONE: Record<CheckInStatus, StatusTone> = {
  WAITING: 'info',
  IN_CONSULTATION: 'progress',
  COMPLETED: 'success',
  NO_SHOW: 'warning',
  CANCELLED: 'danger',
};

const STATUS_LABEL: Record<CheckInStatus, string> = {
  WAITING: 'Waiting',
  IN_CONSULTATION: 'In consultation',
  COMPLETED: 'Completed',
  NO_SHOW: 'No show',
  CANCELLED: 'Cancelled',
};

type CheckInAction = 'seen' | 'complete' | 'noShow' | 'cancel';

/** Which transitions the backend permits from each status. */
const ACTIONS_BY_STATUS: Record<CheckInStatus, CheckInAction[]> = {
  WAITING: ['seen', 'noShow', 'cancel'],
  IN_CONSULTATION: ['complete', 'cancel'],
  COMPLETED: [],
  NO_SHOW: [],
  CANCELLED: [],
};

const ACTION_LABEL: Record<CheckInAction, string> = {
  seen: 'Start consult',
  complete: 'Complete',
  noShow: 'No-show',
  cancel: 'Cancel',
};

const cardClass =
  'flex flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
const rowClass = 'flex items-start justify-between gap-3 px-4 py-3';
const titleClass = 'text-[13px] font-bold text-[var(--ink)]';
const metaClass = 'text-[11.5px] text-[var(--ink-faint)]';

const sortForBoard = (entries: PatientCheckInView[]): PatientCheckInView[] =>
  [...entries].sort((a, b) => {
    const byTriage = TRIAGE_RANK[a.triagePriority] - TRIAGE_RANK[b.triagePriority];
    if (byTriage !== 0) return byTriage;
    return new Date(a.arrivedAt).getTime() - new Date(b.arrivedAt).getTime();
  });

const waitMinutesFor = (entry: PatientCheckInView, now: Date): number | null => {
  if (typeof entry.waitMinutes === 'number') return Math.max(entry.waitMinutes, 0);
  const arrived = new Date(entry.arrivedAt).getTime();
  if (Number.isNaN(arrived)) return null;
  return Math.max(Math.floor((now.getTime() - arrived) / 60000), 0);
};

const formatWait = (minutes: number | null): string | null => {
  if (minutes === null) return null;
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};

const toIsoOrNow = (value: string): string => {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
};

const toLocalInputValue = (date: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
};

const ActionButton = ({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: 'default' | 'danger';
  disabled?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      'rounded-lg border px-2.5 py-1 text-[11.5px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      tone === 'danger'
        ? 'border-[var(--hairline)] text-[var(--danger-text)] hover:bg-[var(--inset)]'
        : 'border-[var(--hairline)] text-[var(--ink)] hover:bg-[var(--inset)]'
    )}
  >
    {label}
  </button>
);

const RowActions = ({
  entry,
  busy,
  handlers,
}: {
  entry: PatientCheckInView;
  busy: boolean;
  handlers: Record<CheckInAction, ((id: string) => void) | undefined>;
}) => {
  const actions = ACTIONS_BY_STATUS[entry.status].filter((action) => handlers[action]);
  if (actions.length === 0) return null;
  return (
    <span className="mt-0.5 flex flex-wrap justify-end gap-1.5">
      {actions.map((action) => (
        <ActionButton
          key={action}
          label={ACTION_LABEL[action]}
          tone={action === 'cancel' || action === 'noShow' ? 'danger' : 'default'}
          disabled={busy}
          onClick={() => handlers[action]?.(entry.id)}
        />
      ))}
    </span>
  );
};

const RoomControl = ({
  entry,
  rooms,
  busy,
  onAssignRoom,
}: {
  entry: PatientCheckInView;
  rooms: CheckInRoomOption[];
  busy: boolean;
  onAssignRoom: (id: string, roomId: string) => void;
}) => {
  const selectId = `checkin-room-${entry.id}`;
  return (
    <label className="flex items-center gap-1.5" htmlFor={selectId}>
      <span className="sr-only">Assign room</span>
      <select
        id={selectId}
        className={clsx(inputClass, 'w-auto py-1')}
        value={entry.assignedRoomId ?? ''}
        disabled={busy}
        onChange={(e) => e.target.value && onAssignRoom(entry.id, e.target.value)}
      >
        <option value="">Assign room</option>
        {rooms.map((room) => (
          <option key={room.id} value={room.id}>
            {room.name}
          </option>
        ))}
      </select>
    </label>
  );
};

const CheckInRow = ({
  entry,
  now,
  busy,
  rooms,
  handlers,
  onAssignRoom,
}: {
  entry: PatientCheckInView;
  now: Date;
  busy: boolean;
  rooms: CheckInRoomOption[];
  handlers: Record<CheckInAction, ((id: string) => void) | undefined>;
  onAssignRoom?: (id: string, roomId: string) => void;
}) => {
  const wait = formatWait(waitMinutesFor(entry, now));
  const detail = [entry.roomName && `Room: ${entry.roomName}`, entry.triageNote]
    .filter(Boolean)
    .join(' · ');
  const showRoomControl =
    onAssignRoom && rooms.length > 0 && ACTIONS_BY_STATUS[entry.status].length > 0;

  return (
    <li className={rowClass}>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <StatusPill
            label={TRIAGE_LABEL[entry.triagePriority]}
            tone={TRIAGE_TONE[entry.triagePriority]}
          />
          <span className={clsx(titleClass, 'truncate')}>{entry.companionName || 'Patient'}</span>
        </span>
        {entry.ownerName && <span className={clsx(metaClass, 'truncate')}>{entry.ownerName}</span>}
        {detail && <span className={clsx(metaClass, 'truncate')}>{detail}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusPill label={STATUS_LABEL[entry.status]} tone={STATUS_TONE[entry.status]} />
        {wait && (
          <span className={metaClass} aria-label={`Waiting ${wait}`}>
            {wait}
          </span>
        )}
        {showRoomControl && (
          <RoomControl entry={entry} rooms={rooms} busy={busy} onAssignRoom={onAssignRoom} />
        )}
        <RowActions entry={entry} busy={busy} handlers={handlers} />
      </span>
    </li>
  );
};

const AddCheckInForm = ({
  companions,
  onAdd,
  onClose,
}: {
  companions: CheckInCompanionOption[];
  onAdd: (payload: CreateCheckInPayload) => Promise<boolean>;
  onClose: () => void;
}) => {
  const [patientId, setPatientId] = useState('');
  const [triagePriority, setTriagePriority] = useState<TriagePriority>('STANDARD');
  const [arrivedAt, setArrivedAt] = useState(() => toLocalInputValue(new Date()));
  const [triageNote, setTriageNote] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const selected = companions.find((companion) => companion.id === patientId);
    if (!selected) {
      setFormError('Choose a patient to check in.');
      return;
    }
    if (!selected.clientId) {
      setFormError('This patient has no linked client to check in against.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const ok = await onAdd({
        patientId: selected.id,
        clientId: selected.clientId,
        arrivedAt: toIsoOrNow(arrivedAt),
        triagePriority,
        triageNote: triageNote.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      if (ok) {
        onClose();
        return;
      }
      setFormError('Could not check the patient in. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 border-b border-[var(--divider)] px-4 py-3"
    >
      <CompanionSelect
        id="checkin-companion"
        label="Patient"
        placeholder="Select a patient"
        emptyLabel="No patients available"
        value={patientId}
        onChange={setPatientId}
        companions={companions}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1" htmlFor="checkin-triage">
          <span className={fieldLabelClass}>Triage priority</span>
          <select
            id="checkin-triage"
            className={inputClass}
            value={triagePriority}
            onChange={(e) => setTriagePriority(e.target.value as TriagePriority)}
          >
            {TRIAGE_ORDER.map((priority) => (
              <option key={priority} value={priority}>
                {TRIAGE_LABEL[priority]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1" htmlFor="checkin-arrived">
          <span className={fieldLabelClass}>Arrived at</span>
          <input
            id="checkin-arrived"
            type="datetime-local"
            className={inputClass}
            value={arrivedAt}
            onChange={(e) => setArrivedAt(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1" htmlFor="checkin-triage-note">
        <span className={fieldLabelClass}>Triage note</span>
        <input
          id="checkin-triage-note"
          className={inputClass}
          value={triageNote}
          onChange={(e) => setTriageNote(e.target.value)}
          maxLength={200}
        />
      </label>

      <label className="flex flex-col gap-1" htmlFor="checkin-notes">
        <span className={fieldLabelClass}>Notes</span>
        <textarea
          id="checkin-notes"
          className={clsx(inputClass, 'min-h-16 resize-y')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
        />
      </label>

      {formError && (
        <p role="alert" className="text-[11.5px] font-semibold text-[var(--danger-text)]">
          {formError}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <ActionButton label="Cancel" tone="default" disabled={submitting} onClick={onClose} />
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg border border-[var(--ink)] bg-[var(--ink)] px-3 py-1 text-[11.5px] font-semibold text-[var(--screen)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? 'Checking in…' : 'Check in patient'}
        </button>
      </div>
    </form>
  );
};

const BoardHeader = ({
  count,
  loading,
  showAll,
  addOpen,
  onToggleShowAll,
  onToggleAdd,
}: {
  count: number;
  loading: boolean;
  showAll: boolean;
  addOpen: boolean;
  onToggleShowAll?: (next: boolean) => void;
  onToggleAdd?: () => void;
}) => (
  <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
    <span className="text-[var(--ink-muted)]" aria-hidden="true">
      <IoPulseOutline size={18} />
    </span>
    <h3 id="checkin-board-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
      Check-in board
    </h3>
    {!loading && count > 0 && (
      <StatusPill label={String(count)} tone="neutral" className="ml-auto tabular-nums" />
    )}
    {onToggleShowAll && (
      <button
        type="button"
        onClick={() => onToggleShowAll(!showAll)}
        aria-pressed={showAll}
        className={clsx(
          'rounded-lg border border-[var(--hairline)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--inset)]',
          !loading && count > 0 ? 'ml-2' : 'ml-auto'
        )}
      >
        {showAll ? 'Active only' : 'Show all'}
      </button>
    )}
    {onToggleAdd && (
      <button
        type="button"
        onClick={onToggleAdd}
        aria-expanded={addOpen}
        className="ml-2 flex items-center gap-1 rounded-lg border border-[var(--hairline)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--inset)]"
      >
        <IoAddOutline size={15} aria-hidden="true" />
        {addOpen ? 'Close' : 'Check in patient'}
      </button>
    )}
  </header>
);

/**
 * Presentational-only check-in / waiting-room board. Renders the check-ins the
 * caller supplies, sorted by triage priority then arrival so the most urgent
 * waiting patient is first, each row carrying a triage pill, a status pill, the
 * live wait time and the transition buttons the status permits. It never
 * fetches; the container ({@link CheckInBoardPanel}) owns loading, error, data
 * and the handlers, and gates edit actions by withholding the handler props.
 */
const CheckInBoard = ({
  entries,
  companions = [],
  rooms = [],
  loading = false,
  error = null,
  busyEntryId = null,
  showAll = false,
  onToggleShowAll,
  onSeen,
  onComplete,
  onCancel,
  onNoShow,
  onAssignRoom,
  onAdd,
}: CheckInBoardProps) => {
  const [addOpen, setAddOpen] = useState(false);
  const handlers: Record<CheckInAction, ((id: string) => void) | undefined> = {
    seen: onSeen,
    complete: onComplete,
    noShow: onNoShow,
    cancel: onCancel,
  };
  // "Now" is read fresh every render so the live wait times keep advancing; it
  // is deliberately not memoised.
  const now = new Date();
  const sorted = useMemo(() => sortForBoard(entries), [entries]);

  const body = (() => {
    if (loading) return <PanelLoadingRows rowClass={rowClass} />;
    if (sorted.length === 0) {
      return (
        <PanelEmptyState message={showAll ? 'No check-ins yet' : 'No patients are checked in'} />
      );
    }
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {sorted.map((entry) => (
          <CheckInRow
            key={entry.id}
            entry={entry}
            now={now}
            busy={busyEntryId === entry.id}
            rooms={rooms}
            handlers={handlers}
            onAssignRoom={onAssignRoom}
          />
        ))}
      </ul>
    );
  })();

  return (
    <section className={clsx(cardClass, 'w-full')} aria-labelledby="checkin-board-heading">
      <BoardHeader
        count={sorted.length}
        loading={loading}
        showAll={showAll}
        addOpen={addOpen}
        onToggleShowAll={onToggleShowAll}
        onToggleAdd={onAdd ? () => setAddOpen((open) => !open) : undefined}
      />

      {error && (
        <div
          role="alert"
          className="border-b border-[var(--divider)] bg-[var(--inset)] px-4 py-3 text-[12.5px] font-semibold text-[var(--danger-text)]"
        >
          {error}
        </div>
      )}

      {onAdd && addOpen && (
        <AddCheckInForm companions={companions} onAdd={onAdd} onClose={() => setAddOpen(false)} />
      )}

      {body}
    </section>
  );
};

export default CheckInBoard;
