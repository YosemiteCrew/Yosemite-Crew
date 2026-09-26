import React from 'react';
import clsx from 'clsx';
import { IoAddOutline, IoCloseOutline } from 'react-icons/io5';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { rowClass } from '@/app/features/companionHistory/components/clinicalListStyles';

/**
 * Chrome shared by the clinical record lists in the companion record (problem
 * list, allergies, and the lists that follow the same shape).
 *
 * Each list had its own byte-identical copy of the class strings, the date
 * formatter and the section header. The strings and the formatter live in
 * `clinicalListStyles.ts`; defining them once keeps the lists visually
 * identical by construction instead of by convention, and stops every new list
 * re-introducing the same duplicated block.
 */

export const ClinicalListEmpty = ({ message }: { message: string }) => (
  <p className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-faint)]">{message}</p>
);

export const ClinicalListLoadingRows = () => (
  <ul className="divide-y divide-[var(--divider)]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className={rowClass}>
        <span className="h-3.5 w-44 rounded bg-[var(--inset)]" />
        <span className="h-5 w-16 rounded-full bg-[var(--inset)]" />
      </li>
    ))}
  </ul>
);

/** The list's error banner. Renders nothing when there is no error. */
export const ClinicalListError = ({ error }: { error: string | null }) =>
  error ? (
    <div
      role="alert"
      className="mx-4 mt-3 rounded-xl border border-[var(--divider)] bg-[var(--inset)] px-4 py-3 text-[12.5px] font-semibold text-[var(--danger-text)]"
    >
      {error}
    </div>
  ) : null;

export type ClinicalListHeaderProps = {
  /** Leading glyph; each list passes its own icon element. */
  icon: React.ReactNode;
  /** Must match the section's `aria-labelledby`. */
  headingId: string;
  title: string;
  /** Count of active records; the pill is withheld while loading, on error, or at zero. */
  activeCount: number;
  /** Word after the count in the pill. Defaults to "active". */
  countLabel?: string;
  /** Tone of the count pill. Defaults to warning, the tone of an active problem. */
  countTone?: StatusTone;
  loading: boolean;
  /** When set, the body shows only the error and the count pill is withheld. */
  error?: string | null;
  canEdit: boolean;
  showForm: boolean;
  onToggle: () => void;
  /** Label for the add control when the form is closed. */
  addLabel: string;
};

/*
 * Below 768px the add control is a 44px icon button: the phone record is 354px
 * wide and the full label overflowed it. The label stays in the accessible name.
 */
export const ClinicalListHeader = ({
  icon,
  headingId,
  title,
  activeCount,
  countLabel = 'active',
  countTone = 'warning',
  loading,
  error,
  canEdit,
  showForm,
  onToggle,
  addLabel,
}: ClinicalListHeaderProps) => {
  const ToggleIcon = showForm ? IoCloseOutline : IoAddOutline;
  return (
    <header
      className={clsx(
        'flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3',
        canEdit && 'max-md:py-2 max-md:pr-2'
      )}
    >
      <span className="text-[var(--ink-muted)]" aria-hidden="true">
        {icon}
      </span>
      <h2 id={headingId} className="text-[13.5px] font-bold text-[var(--ink)]">
        {title}
      </h2>
      {!loading && !error && activeCount > 0 ? (
        <StatusPill
          label={`${activeCount} ${countLabel}`}
          tone={countTone}
          className="ml-2 tabular-nums"
        />
      ) : null}
      {canEdit ? (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={showForm}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] max-md:size-11 max-md:shrink-0 max-md:justify-center max-md:p-0"
        >
          <ToggleIcon size={15} aria-hidden="true" className="max-md:size-[18px]" />
          <span className="max-md:sr-only">{showForm ? 'Close' : addLabel}</span>
        </button>
      ) : null}
    </header>
  );
};
