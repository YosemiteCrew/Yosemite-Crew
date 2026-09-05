import React from 'react';
import { IoAddOutline } from 'react-icons/io5';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

/**
 * Chrome shared by the clinical record lists in the companion record (problem
 * list, allergies, and the lists that follow the same shape).
 *
 * Each list had its own byte-identical copy of these class strings, the date
 * formatter and the section header. Defining them once keeps the lists visually
 * identical by construction instead of by convention, and stops every new list
 * re-introducing the same duplicated block.
 */

export const cardClass =
  'flex w-full flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
export const rowClass = 'flex items-start justify-between gap-3 px-4 py-3';
export const titleClass = 'text-[13px] font-bold text-[var(--ink)]';
export const metaClass = 'text-[11.5px] text-[var(--ink-faint)]';
export const fieldLabelClass = 'text-[11.5px] font-semibold text-[var(--ink-muted)]';
export const controlClass =
  'w-full rounded-xl border border-[var(--hairline)] bg-[var(--screen)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--blue)]';

/** Short, locale-aware date. Null when the value is absent or unparseable. */
export const formatDate = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
};

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
  /** Count of active records; the pill is withheld while loading or at zero. */
  activeCount: number;
  loading: boolean;
  canEdit: boolean;
  showForm: boolean;
  onToggle: () => void;
  /** Label for the add control when the form is closed. */
  addLabel: string;
};

export const ClinicalListHeader = ({
  icon,
  headingId,
  title,
  activeCount,
  loading,
  canEdit,
  showForm,
  onToggle,
  addLabel,
}: ClinicalListHeaderProps) => (
  <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
    <span className="text-[var(--ink-muted)]" aria-hidden="true">
      {icon}
    </span>
    <h3 id={headingId} className="text-[13.5px] font-bold text-[var(--ink)]">
      {title}
    </h3>
    {!loading && activeCount > 0 ? (
      <StatusPill label={`${activeCount} active`} tone="warning" className="ml-2 tabular-nums" />
    ) : null}
    {canEdit ? (
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={showForm}
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
      >
        <IoAddOutline size={15} aria-hidden="true" />
        {showForm ? 'Close' : addLabel}
      </button>
    ) : null}
  </header>
);
