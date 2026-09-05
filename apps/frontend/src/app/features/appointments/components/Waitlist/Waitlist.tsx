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
import { IoListOutline, IoAddOutline } from 'react-icons/io5';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import type {
  WaitlistEntry,
  WaitlistStatus,
  AddToWaitlistPayload,
} from '@/app/features/appointments/services/waitlistService';

/** A companion the add-form offers as the subject of a new waitlist entry. */
export type WaitlistCompanionOption = { id: string; name: string; ownerName?: string };

/**
 * A waitlist row for display. The API entry carries only `patientId`; the
 * container resolves the companion + owner names from the companions store and
 * attaches them here, falling back to a generic label when the companion is not
 * loaded (same optional-with-fallback shape the inventory alerts panel uses).
 */
export type WaitlistEntryView = WaitlistEntry & {
  companionName?: string;
  ownerName?: string;
};

export type WaitlistProps = {
  entries: WaitlistEntryView[];
  /** Companions offered in the add-form select. Empty disables adding. */
  companions?: WaitlistCompanionOption[];
  loading?: boolean;
  error?: string | null;
  /** Id of the entry whose action is in flight, so its buttons disable. */
  busyEntryId?: string | null;
  onOffer?: (id: string) => void;
  onBook?: (id: string) => void;
  onCancel?: (id: string) => void;
  /** Resolves true when the entry was added, so the form can reset and close. */
  onAdd?: (payload: AddToWaitlistPayload) => Promise<boolean>;
};

const STATUS_TONE: Record<WaitlistStatus, StatusTone> = {
  WAITING: 'info',
  OFFERED: 'warning',
  BOOKED: 'success',
  CANCELLED: 'danger',
  EXPIRED: 'neutral',
};

const STATUS_LABEL: Record<WaitlistStatus, string> = {
  WAITING: 'Waiting',
  OFFERED: 'Offered',
  BOOKED: 'Booked',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

type WaitlistAction = 'offer' | 'book' | 'cancel';

/** Which transitions the backend permits from each status (waitlist.service.ts). */
const ACTIONS_BY_STATUS: Record<WaitlistStatus, WaitlistAction[]> = {
  WAITING: ['offer', 'book', 'cancel'],
  OFFERED: ['book', 'cancel'],
  BOOKED: [],
  CANCELLED: [],
  EXPIRED: [],
};

const ACTION_LABEL: Record<WaitlistAction, string> = {
  offer: 'Offer',
  book: 'Book',
  cancel: 'Cancel',
};

const cardClass =
  'flex flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
const rowClass = 'flex items-start justify-between gap-3 px-4 py-3';
const titleClass = 'text-[13px] font-bold text-[var(--ink)]';
const metaClass = 'text-[11.5px] text-[var(--ink-faint)]';

const absoluteDate = (iso: string | null): string | null => {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const toIsoOrUndefined = (value: string): string | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
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

const WaitlistRow = ({
  entry,
  position,
  busy,
  onOffer,
  onBook,
  onCancel,
}: {
  entry: WaitlistEntryView;
  position: number | null;
  busy: boolean;
  onOffer?: (id: string) => void;
  onBook?: (id: string) => void;
  onCancel?: (id: string) => void;
}) => {
  const handlers = { offer: onOffer, book: onBook, cancel: onCancel };
  const serviceReason = [entry.appointmentType, entry.notes].filter(Boolean).join(' · ');
  const added = absoluteDate(entry.createdAt);
  const actions = ACTIONS_BY_STATUS[entry.status].filter((action) => handlers[action]);

  return (
    <li className={rowClass}>
      <span className="flex min-w-0 items-start gap-2.5">
        {position !== null && (
          <span
            className="mt-0.5 w-5 shrink-0 text-center text-[12px] font-bold tabular-nums text-[var(--ink-faint)]"
            aria-label={`Queue position ${position}`}
          >
            {position}
          </span>
        )}
        <span className="min-w-0">
          <span className={clsx(titleClass, 'block truncate')}>
            {entry.companionName || 'Companion'}
          </span>
          {entry.ownerName && (
            <span className={clsx(metaClass, 'block truncate')}>{entry.ownerName}</span>
          )}
          {serviceReason && (
            <span className={clsx(metaClass, 'mt-0.5 block truncate')}>{serviceReason}</span>
          )}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusPill label={STATUS_LABEL[entry.status]} tone={STATUS_TONE[entry.status]} />
        {added && <span className={metaClass}>Added {added}</span>}
        {actions.length > 0 && (
          <span className="mt-0.5 flex flex-wrap justify-end gap-1.5">
            {actions.map((action) => (
              <ActionButton
                key={action}
                label={ACTION_LABEL[action]}
                tone={action === 'cancel' ? 'danger' : 'default'}
                disabled={busy}
                onClick={() => handlers[action]?.(entry.id)}
              />
            ))}
          </span>
        )}
      </span>
    </li>
  );
};

const AddWaitlistForm = ({
  companions,
  onAdd,
  onClose,
}: {
  companions: WaitlistCompanionOption[];
  onAdd: (payload: AddToWaitlistPayload) => Promise<boolean>;
  onClose: () => void;
}) => {
  const [patientId, setPatientId] = useState('');
  const [appointmentType, setAppointmentType] = useState('');
  const [notes, setNotes] = useState('');
  const [earliestDate, setEarliestDate] = useState('');
  const [latestDate, setLatestDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!patientId) {
      setFormError('Choose a companion to add to the waitlist.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const ok = await onAdd({
        patientId,
        appointmentType: appointmentType.trim() || undefined,
        notes: notes.trim() || undefined,
        earliestDate: toIsoOrUndefined(earliestDate),
        latestDate: toIsoOrUndefined(latestDate),
      });
      if (ok) {
        onClose();
        return;
      }
      setFormError('Could not add to the waitlist. Try again.');
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
        label="Companion"
        placeholder="Select a companion"
        emptyLabel="No companions available"
        value={patientId}
        onChange={setPatientId}
        companions={companions}
      />

      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Requested service</span>
        <input
          className={inputClass}
          value={appointmentType}
          onChange={(e) => setAppointmentType(e.target.value)}
          maxLength={100}
          placeholder="e.g. Dental, Vaccination"
        />
      </label>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Earliest date</span>
          <input
            type="date"
            className={inputClass}
            value={earliestDate}
            onChange={(e) => setEarliestDate(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Latest date</span>
          <input
            type="date"
            className={inputClass}
            value={latestDate}
            onChange={(e) => setLatestDate(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Reason / notes</span>
        <textarea
          className={clsx(inputClass, 'min-h-16 resize-y')}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          placeholder="Anything the scheduler should know"
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
          {submitting ? 'Adding…' : 'Add to waitlist'}
        </button>
      </div>
    </form>
  );
};

/**
 * Presentational-only waitlist. Renders the entries the caller supplies with a
 * status pill and the row actions each status permits; it never fetches. The
 * container ({@link WaitlistPanel}) owns loading, error, data and the action
 * handlers. Actions and the add form only appear when the matching handler prop
 * is provided, so the container gates them on edit permission by withholding
 * the handlers.
 */
const Waitlist = ({
  entries,
  companions = [],
  loading = false,
  error = null,
  busyEntryId = null,
  onOffer,
  onBook,
  onCancel,
  onAdd,
}: WaitlistProps) => {
  const [addOpen, setAddOpen] = useState(false);

  // FIFO priority: the backend offers the oldest WAITING entry first, so number
  // the WAITING entries in the order the list arrives (createdAt asc).
  const positionById = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const entry of entries) {
      if (entry.status === 'WAITING') {
        n += 1;
        map.set(entry.id, n);
      }
    }
    return map;
  }, [entries]);

  const body = (() => {
    if (loading) return <PanelLoadingRows rowClass={rowClass} />;
    if (entries.length === 0) return <PanelEmptyState message="No one is on the waitlist" />;
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {entries.map((entry) => (
          <WaitlistRow
            key={entry.id}
            entry={entry}
            position={positionById.get(entry.id) ?? null}
            busy={busyEntryId === entry.id}
            onOffer={onOffer}
            onBook={onBook}
            onCancel={onCancel}
          />
        ))}
      </ul>
    );
  })();

  return (
    <section className={clsx(cardClass, 'w-full')} aria-labelledby="waitlist-heading">
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          <IoListOutline size={18} />
        </span>
        <h3 id="waitlist-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
          Waitlist
        </h3>
        {!loading && entries.length > 0 && (
          <StatusPill
            label={String(entries.length)}
            tone="neutral"
            className="ml-auto tabular-nums"
          />
        )}
        {onAdd && (
          <button
            type="button"
            onClick={() => setAddOpen((open) => !open)}
            aria-expanded={addOpen}
            className={clsx(
              'flex items-center gap-1 rounded-lg border border-[var(--hairline)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--inset)]',
              !loading && entries.length > 0 ? 'ml-2' : 'ml-auto'
            )}
          >
            <IoAddOutline size={15} aria-hidden="true" />
            {addOpen ? 'Close' : 'Add to waitlist'}
          </button>
        )}
      </header>

      {error && (
        <div
          role="alert"
          className="border-b border-[var(--divider)] bg-[var(--inset)] px-4 py-3 text-[12.5px] font-semibold text-[var(--danger-text)]"
        >
          {error}
        </div>
      )}

      {onAdd && addOpen && (
        <AddWaitlistForm companions={companions} onAdd={onAdd} onClose={() => setAddOpen(false)} />
      )}

      {body}
    </section>
  );
};

export default Waitlist;
