'use client';

import { useMemo, useState } from 'react';
import { IoClose, IoPencil, IoTimeOutline } from 'react-icons/io5';
import Modal from '@/app/ui/overlays/Modal';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import ModalFooter from '@/app/ui/overlays/Modal/ModalFooter';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type { Team } from '@/app/features/organization/types/team';
import {
  formatDateInPreferredTimeZone,
  fromDateTimeInputInPreferredTimeZone,
  toDateTimeInputInPreferredTimeZone,
} from '@/app/lib/timezone';
import type { OrganisationRoom } from '@yosemite-crew/types';
import type {
  CalendarBlock,
  CalendarBlockInput,
  CalendarBlockTargetType,
} from '@/app/features/appointments/services/calendarBlockService';

type CalendarBlocksPanelProps = {
  blocks: CalendarBlock[];
  teams: Team[];
  rooms: OrganisationRoom[];
  canEdit: boolean;
  onSave: (id: string | null, input: CalendarBlockInput) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

type Draft = {
  id: string | null;
  targetType: CalendarBlockTargetType;
  targetId: string;
  startAt: string;
  endAt: string;
  reason: string;
};

const emptyDraft = (): Draft => ({
  id: null,
  targetType: 'STAFF',
  targetId: '',
  startAt: '',
  endAt: '',
  reason: '',
});

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
};

// Blocks are entered and shown in the practice's time zone, like the calendar around them.
const displayTime = (value: string): string =>
  formatDateInPreferredTimeZone(new Date(value), TIME_FORMAT);

const displayTimeRange = (startAt: string, endAt: string): string =>
  `${displayTime(startAt)} – ${displayTime(endAt)}`;

type CalendarBlockEditorProps = {
  draft: Draft;
  targetOptions: { id: string; name: string }[];
  error: string;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: React.SubmitEvent<HTMLFormElement>) => void;
  onChange: (draft: Draft) => void;
};

const CalendarBlockEditor = ({
  draft,
  targetOptions,
  error,
  saving,
  onClose,
  onSubmit,
  onChange,
}: CalendarBlockEditorProps) => (
  <Modal
    showModal
    setShowModal={(show) => {
      if (!show) onClose();
    }}
    variant="centered"
    size="sm"
    aria-labelledby="calendar-block-title"
  >
    <form onSubmit={onSubmit} className="flex max-h-full flex-col gap-4">
      <ModalHeader
        title={draft.id ? 'Edit calendar block' : 'Block calendar time'}
        titleId="calendar-block-title"
        onClose={onClose}
      />
      <div className="grid gap-3">
        <label className="grid gap-1 text-[12px] font-semibold text-[var(--ink-body)]">
          <span>Applies to</span>
          <select
            value={draft.targetType}
            onChange={(event) =>
              onChange({
                ...draft,
                targetType: event.target.value as CalendarBlockTargetType,
                targetId: '',
              })
            }
            className="min-h-10 rounded-xl border border-[var(--hairline)] bg-[var(--field-bg)] px-3 text-[13px] font-normal text-[var(--ink)]"
          >
            <option value="STAFF">Staff member</option>
            <option value="ROOM">Room</option>
          </select>
        </label>
        <label className="grid gap-1 text-[12px] font-semibold text-[var(--ink-body)]">
          <span>{draft.targetType === 'ROOM' ? 'Room' : 'Staff member'}</span>
          <select
            required
            value={draft.targetId}
            onChange={(event) => onChange({ ...draft, targetId: event.target.value })}
            className="min-h-10 rounded-xl border border-[var(--hairline)] bg-[var(--field-bg)] px-3 text-[13px] font-normal text-[var(--ink)]"
          >
            <option value="">Choose…</option>
            {targetOptions.map((target) => (
              <option key={target.id} value={target.id}>
                {target.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-[12px] font-semibold text-[var(--ink-body)]">
            <span>Starts</span>
            <input
              required
              type="datetime-local"
              value={draft.startAt}
              onChange={(event) => onChange({ ...draft, startAt: event.target.value })}
              className="min-h-10 min-w-0 rounded-xl border border-[var(--hairline)] bg-[var(--field-bg)] px-2 text-[12px] font-normal text-[var(--ink)]"
            />
          </label>
          <label className="grid gap-1 text-[12px] font-semibold text-[var(--ink-body)]">
            <span>Ends</span>
            <input
              required
              type="datetime-local"
              value={draft.endAt}
              onChange={(event) => onChange({ ...draft, endAt: event.target.value })}
              className="min-h-10 min-w-0 rounded-xl border border-[var(--hairline)] bg-[var(--field-bg)] px-2 text-[12px] font-normal text-[var(--ink)]"
            />
          </label>
        </div>
        <label className="grid gap-1 text-[12px] font-semibold text-[var(--ink-body)]">
          <span>Reason</span>
          <input
            required
            maxLength={200}
            value={draft.reason}
            onChange={(event) => onChange({ ...draft, reason: event.target.value })}
            placeholder="Lunch, training, closure…"
            className="min-h-10 rounded-xl border border-[var(--hairline)] bg-[var(--field-bg)] px-3 text-[13px] font-normal text-[var(--ink)] placeholder:text-[var(--ink-faint)]"
          />
        </label>
        {error && (
          <p role="alert" className="text-[12px] text-[var(--danger-text)]">
            {error}
          </p>
        )}
      </div>
      <ModalFooter>
        <Secondary text="Cancel" onClick={onClose} />
        <Primary text={saving ? 'Saving…' : 'Save block'} type="submit" isDisabled={saving} />
      </ModalFooter>
    </form>
  </Modal>
);

type CalendarBlockListProps = {
  blocks: CalendarBlock[];
  teams: Team[];
  rooms: OrganisationRoom[];
  canEdit: boolean;
  onEdit: (block: CalendarBlock) => void;
  onCancel: (id: string) => void;
};

const getTargetName = (block: CalendarBlock, teams: Team[], rooms: OrganisationRoom[]): string => {
  const target =
    block.targetType === 'ROOM'
      ? rooms.find((room) => room.id === block.targetId)
      : teams.find(
          (member) => member.practionerId === block.targetId || member._id === block.targetId
        );
  return target?.name || (block.targetType === 'ROOM' ? 'Room' : 'Staff member');
};

const CalendarBlockList = ({
  blocks,
  teams,
  rooms,
  canEdit,
  onEdit,
  onCancel,
}: CalendarBlockListProps) => (
  <section
    aria-label="Calendar blocks"
    className="flex shrink-0 items-center gap-2 overflow-x-auto border-b px-3 py-2"
    style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--inset)' }}
  >
    <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
      Blocks
    </span>
    {blocks.map((block) => {
      const name = getTargetName(block, teams, rooms);
      return (
        <div
          key={block.id}
          className="flex max-w-[min(28rem,80vw)] shrink-0 items-center gap-2 rounded-xl border px-2.5 py-1.5"
          style={{ borderColor: 'var(--hairline)', backgroundColor: 'var(--screen)' }}
        >
          <IoTimeOutline
            size={14}
            aria-hidden="true"
            className="shrink-0 text-[var(--blue-text)]"
          />
          <span
            className="min-w-0 truncate text-[12px] text-[var(--ink)]"
            title={`${block.reason} · ${name}`}
          >
            <strong>{block.reason}</strong>
            <span className="text-[var(--ink-muted)]">
              {' '}
              · {name} · {displayTimeRange(block.startAt, block.endAt)}
            </span>
          </span>
          {canEdit && (
            <>
              <button
                type="button"
                aria-label={`Edit ${block.reason}`}
                onClick={() => onEdit(block)}
                className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-card-hover hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <IoPencil size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Cancel ${block.reason}`}
                onClick={() => onCancel(block.id)}
                className="rounded-full p-1 text-[var(--ink-muted)] hover:bg-card-hover hover:text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
              >
                <IoClose size={15} aria-hidden="true" />
              </button>
            </>
          )}
        </div>
      );
    })}
  </section>
);

const useCalendarBlockEditor = ({
  teams,
  rooms,
  onSave,
}: Pick<CalendarBlocksPanelProps, 'teams' | 'rooms' | 'onSave'>) => {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const targetOptions = useMemo(
    () =>
      draft?.targetType === 'ROOM'
        ? rooms.map((room) => ({ id: room.id, name: room.name }))
        : teams.map((member) => ({
            id: member.practionerId || member._id,
            name: member.name || member.role,
          })),
    [draft?.targetType, rooms, teams]
  );
  const beginEdit = (block: CalendarBlock) => {
    setError('');
    setDraft({
      id: block.id,
      targetType: block.targetType,
      targetId: block.targetId,
      startAt: toDateTimeInputInPreferredTimeZone(new Date(block.startAt)),
      endAt: toDateTimeInputInPreferredTimeZone(new Date(block.endAt)),
      reason: block.reason,
    });
  };
  const submit = async (event: React.SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft) return;
    if (!draft.targetId) {
      setError('Choose a staff member or room.');
      return;
    }
    const startAt = fromDateTimeInputInPreferredTimeZone(draft.startAt);
    const endAt = fromDateTimeInputInPreferredTimeZone(draft.endAt);
    if (!startAt || !endAt) {
      setError('Choose when the block starts and ends.');
      return;
    }
    if (endAt <= startAt) {
      setError('The end must be after the start.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(draft.id, {
        targetType: draft.targetType,
        targetId: draft.targetId,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        reason: draft.reason.trim(),
      });
      setDraft(null);
    } catch {
      setError('Could not save this block. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  return { draft, setDraft, error, setError, saving, targetOptions, beginEdit, submit };
};

const CalendarBlocksPanel = ({
  blocks,
  teams,
  rooms,
  canEdit,
  onSave,
  onDelete,
}: CalendarBlocksPanelProps) => {
  const [feedback, setFeedback] = useState('');
  const editor = useCalendarBlockEditor({ teams, rooms, onSave });

  return (
    <>
      {blocks.length > 0 && (
        <CalendarBlockList
          blocks={blocks}
          teams={teams}
          rooms={rooms}
          canEdit={canEdit}
          onEdit={editor.beginEdit}
          onCancel={(id) => {
            setFeedback('');
            void onDelete(id).catch(() =>
              setFeedback('Could not cancel this block. Please try again.')
            );
          }}
        />
      )}
      {feedback && (
        <p role="alert" className="px-3 py-1 text-[12px] text-[var(--danger-text)]">
          {feedback}
        </p>
      )}
      {canEdit && (
        <div
          className="flex shrink-0 items-center justify-end border-b px-3 py-1.5"
          style={{ borderColor: 'var(--hairline)' }}
        >
          <button
            type="button"
            onClick={() => {
              editor.setError('');
              editor.setDraft(emptyDraft());
            }}
            className="rounded-full px-3 py-1 text-[12px] font-semibold text-[var(--blue-text)] hover:bg-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-text-brand"
          >
            Block time
          </button>
        </div>
      )}
      {editor.draft && (
        <CalendarBlockEditor
          draft={editor.draft}
          targetOptions={editor.targetOptions}
          error={editor.error}
          saving={editor.saving}
          onClose={() => editor.setDraft(null)}
          onSubmit={(event) => void editor.submit(event)}
          onChange={editor.setDraft}
        />
      )}
    </>
  );
};

export default CalendarBlocksPanel;
