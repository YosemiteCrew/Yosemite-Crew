'use client';
import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { IoAddOutline, IoCheckmarkOutline, IoMedkitOutline } from 'react-icons/io5';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type {
  PatientProblem,
  ProblemSeverity,
  ProblemStatus,
} from '@/app/features/companionHistory/services/patientProblemService';

/** The values the create form emits. `onsetDate` is a raw `YYYY-MM-DD` (or ''). */
export type ProblemFormValues = {
  name: string;
  notes: string;
  severity: ProblemSeverity | '';
  onsetDate: string;
};

export type ProblemListProps = {
  problems: PatientProblem[];
  loading?: boolean;
  error?: string | null;
  /** Gates the add/resolve controls. Mirrors the backend `appointments:edit` gate. */
  canEdit?: boolean;
  /** Fired when the create form is submitted. Returns true once the record is saved. */
  onCreate?: (values: ProblemFormValues) => Promise<boolean> | boolean;
  /** Fired when an active problem's resolve action is clicked. */
  onResolve?: (problem: PatientProblem) => void;
  /** Disables the create form's submit while a create is in flight. */
  creating?: boolean;
  /** Id of the problem currently being resolved, so its row shows a pending state. */
  resolvingId?: string | null;
};

const STATUS_LABEL: Record<ProblemStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  RESOLVED: 'Resolved',
};

const STATUS_TONE: Record<ProblemStatus, StatusTone> = {
  ACTIVE: 'warning',
  INACTIVE: 'neutral',
  RESOLVED: 'success',
};

const SEVERITY_LABEL: Record<ProblemSeverity, string> = {
  MILD: 'Mild',
  MODERATE: 'Moderate',
  SEVERE: 'Severe',
};

const SEVERITY_TONE: Record<ProblemSeverity, StatusTone> = {
  MILD: 'info',
  MODERATE: 'warning',
  SEVERE: 'danger',
};

const SEVERITY_OPTIONS: ProblemSeverity[] = ['MILD', 'MODERATE', 'SEVERE'];

const cardClass =
  'flex w-full flex-col rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_2px_var(--sh03)]';
const rowClass = 'flex items-start justify-between gap-3 px-4 py-3';
const titleClass = 'text-[13px] font-bold text-[var(--ink)]';
const metaClass = 'text-[11.5px] text-[var(--ink-faint)]';
const fieldLabelClass = 'text-[11.5px] font-semibold text-[var(--ink-muted)]';
const controlClass =
  'w-full rounded-xl border border-[var(--hairline)] bg-[var(--screen)] px-3 py-2 text-[13px] text-[var(--ink)] outline-none focus:border-[var(--blue)]';

const formatDate = (value: string | null): string | null => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const EmptyState = () => (
  <p className="px-4 py-8 text-center text-[12.5px] text-[var(--ink-faint)]">
    No problems recorded for this patient yet.
  </p>
);

const LoadingRows = () => (
  <ul className="divide-y divide-[var(--divider)]" aria-hidden="true">
    {[0, 1, 2].map((i) => (
      <li key={i} className={rowClass}>
        <span className="h-3.5 w-44 rounded bg-[var(--inset)]" />
        <span className="h-5 w-16 rounded-full bg-[var(--inset)]" />
      </li>
    ))}
  </ul>
);

const ProblemRow = ({
  problem,
  canEdit,
  onResolve,
  resolving,
}: {
  problem: PatientProblem;
  canEdit: boolean;
  onResolve?: (problem: PatientProblem) => void;
  resolving: boolean;
}) => {
  const onset = formatDate(problem.onsetDate);
  const resolved = formatDate(problem.resolvedDate);
  const isActive = problem.status === 'ACTIVE';
  return (
    <li className={rowClass}>
      <span className="min-w-0">
        <span className={clsx(titleClass, 'block truncate')}>{problem.name}</span>
        <span className={clsx(metaClass, 'mt-0.5 block')}>
          {onset ? `Onset ${onset}` : 'Onset not recorded'}
          {problem.code ? ` · ${problem.code}` : ''}
        </span>
        {problem.notes ? (
          <span className={clsx(metaClass, 'mt-1 block line-clamp-2 text-[var(--ink-muted)]')}>
            {problem.notes}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          {problem.severity ? (
            <StatusPill
              label={SEVERITY_LABEL[problem.severity]}
              tone={SEVERITY_TONE[problem.severity]}
            />
          ) : null}
          <StatusPill label={STATUS_LABEL[problem.status]} tone={STATUS_TONE[problem.status]} />
        </span>
        {isActive && canEdit ? (
          <Secondary
            size="compact"
            text={resolving ? 'Resolving…' : 'Resolve'}
            icon={<IoCheckmarkOutline size={15} aria-hidden="true" />}
            isDisabled={resolving}
            onClick={() => onResolve?.(problem)}
            ariaLabel={`Resolve ${problem.name}`}
          />
        ) : null}
        {problem.status === 'RESOLVED' && resolved ? (
          <span className={metaClass}>Resolved {resolved}</span>
        ) : null}
      </span>
    </li>
  );
};

const emptyForm: ProblemFormValues = { name: '', notes: '', severity: '', onsetDate: '' };

const CreateProblemForm = ({
  creating,
  onCreate,
  onCancel,
}: {
  creating: boolean;
  onCreate?: NonNullable<ProblemListProps['onCreate']>;
  onCancel: () => void;
}) => {
  const [values, setValues] = useState<ProblemFormValues>(emptyForm);
  const trimmedName = values.name.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedName || creating) return;
    const ok = await onCreate?.({ ...values, name: trimmedName });
    if (ok) {
      setValues(emptyForm);
      onCancel();
    }
  };

  return (
    <form
      className="flex flex-col gap-3 border-b border-[var(--divider)] bg-[var(--inset)] px-4 py-4"
      onSubmit={handleSubmit}
    >
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Problem title</span>
        <input
          className={controlClass}
          value={values.name}
          onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          placeholder="e.g. Chronic kidney disease"
          maxLength={300}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className={fieldLabelClass}>Description</span>
        <textarea
          className={clsx(controlClass, 'min-h-16 resize-y')}
          value={values.notes}
          onChange={(e) => setValues((v) => ({ ...v, notes: e.target.value }))}
          placeholder="Clinical notes (optional)"
          maxLength={2000}
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Severity</span>
          <select
            className={controlClass}
            value={values.severity}
            onChange={(e) =>
              setValues((v) => ({ ...v, severity: e.target.value as ProblemSeverity | '' }))
            }
          >
            <option value="">No severity</option>
            {SEVERITY_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {SEVERITY_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={fieldLabelClass}>Onset date</span>
          <input
            type="date"
            className={controlClass}
            value={values.onsetDate}
            onChange={(e) => setValues((v) => ({ ...v, onsetDate: e.target.value }))}
          />
        </label>
      </div>
      <div className="flex items-center justify-end gap-2">
        <Secondary size="compact" text="Cancel" onClick={onCancel} />
        <Primary
          size="compact"
          type="submit"
          text="Save problem"
          isDisabled={!trimmedName || creating}
        />
      </div>
    </form>
  );
};

/**
 * Presentational clinical problem-list panel. Renders the problems the caller
 * supplies and surfaces create/resolve intents through callbacks; it never
 * fetches. The container (`ProblemListPanel`) owns loading, error and data.
 */
const ProblemList = ({
  problems,
  loading = false,
  error = null,
  canEdit = false,
  onCreate,
  onResolve,
  creating = false,
  resolvingId = null,
}: ProblemListProps) => {
  const [showForm, setShowForm] = useState(false);
  const activeCount = useMemo(
    () => problems.filter((p) => p.status === 'ACTIVE').length,
    [problems]
  );

  const body = (() => {
    if (loading) return <LoadingRows />;
    if (problems.length === 0) return <EmptyState />;
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {problems.map((problem) => (
          <ProblemRow
            key={problem.id}
            problem={problem}
            canEdit={canEdit}
            onResolve={onResolve}
            resolving={resolvingId === problem.id}
          />
        ))}
      </ul>
    );
  })();

  return (
    <section className={cardClass} aria-labelledby="problem-list-heading">
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          <IoMedkitOutline size={18} />
        </span>
        <h3 id="problem-list-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
          Problem list
        </h3>
        {!loading && activeCount > 0 ? (
          <StatusPill
            label={`${activeCount} active`}
            tone="warning"
            className="ml-2 tabular-nums"
          />
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => setShowForm((s) => !s)}
            aria-expanded={showForm}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            <IoAddOutline size={15} aria-hidden="true" />
            {showForm ? 'Close' : 'Add problem'}
          </button>
        ) : null}
      </header>

      {error ? (
        <div
          role="alert"
          className="mx-4 mt-3 rounded-xl border border-[var(--divider)] bg-[var(--inset)] px-4 py-3 text-[12.5px] font-semibold text-[var(--danger-text)]"
        >
          {error}
        </div>
      ) : null}

      {showForm && canEdit ? (
        <CreateProblemForm
          creating={creating}
          onCreate={onCreate}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {body}
    </section>
  );
};

export default ProblemList;
