'use client';

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { IoAddOutline, IoCheckmarkOutline, IoFlagOutline } from 'react-icons/io5';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import type {
  FlagSeverity,
  PatientFlag,
  PatientFlagType,
} from '@/app/features/companionHistory/services/patientFlagService';

export type FlagFormValues = {
  title: string;
  flagType: PatientFlagType;
  severity: FlagSeverity;
  description: string;
};

export type FlagListProps = {
  flags: PatientFlag[];
  loading?: boolean;
  error?: string | null;
  canEdit?: boolean;
  onCreate?: (values: FlagFormValues) => Promise<boolean> | boolean;
  onResolve?: (flag: PatientFlag) => void;
  creating?: boolean;
  resolvingId?: string | null;
};

const TYPE_LABEL: Record<PatientFlagType, string> = {
  AGGRESSION: 'Aggression risk',
  ESCAPE_RISK: 'Escape risk',
  ALLERGY_WARNING: 'Allergy warning',
  ANXIETY: 'Anxiety',
  SPECIAL_HANDLING: 'Special handling',
  BILLING_NOTE: 'Billing note',
  VIP: 'Priority patient',
  QUARANTINE: 'Quarantine',
  OTHER: 'Other',
};

const SEVERITY_LABEL: Record<FlagSeverity, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const SEVERITY_TONE: Record<FlagSeverity, StatusTone> = {
  LOW: 'info',
  MEDIUM: 'warning',
  HIGH: 'danger',
  CRITICAL: 'danger',
};

const TYPE_OPTIONS: PatientFlagType[] = [
  'AGGRESSION',
  'ESCAPE_RISK',
  'ALLERGY_WARNING',
  'ANXIETY',
  'SPECIAL_HANDLING',
  'BILLING_NOTE',
  'VIP',
  'QUARANTINE',
  'OTHER',
];
const SEVERITY_OPTIONS: FlagSeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

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
    No active flags for this patient.
  </p>
);

const LoadingRows = () => (
  <ul className="divide-y divide-[var(--divider)]" aria-hidden="true">
    {[0, 1, 2].map((index) => (
      <li key={index} className={rowClass}>
        <span className="h-3.5 w-44 rounded bg-[var(--inset)]" />
        <span className="h-5 w-16 rounded-full bg-[var(--inset)]" />
      </li>
    ))}
  </ul>
);

type FlagRowProps = {
  flag: PatientFlag;
  canEdit: boolean;
  onResolve?: (flag: PatientFlag) => void;
  resolving: boolean;
};

const FlagRow = ({ flag, canEdit, onResolve, resolving }: FlagRowProps) => {
  const resolved = formatDate(flag.resolvedAt);
  return (
    <li className={rowClass}>
      <span className="min-w-0">
        <span className={clsx(titleClass, 'block truncate')}>{flag.title}</span>
        <span className={clsx(metaClass, 'mt-0.5 block')}>{TYPE_LABEL[flag.flagType]}</span>
        {flag.description ? (
          <span className={clsx(metaClass, 'mt-1 block line-clamp-2 text-[var(--ink-muted)]')}>
            {flag.description}
          </span>
        ) : null}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        <span className="flex flex-wrap items-center justify-end gap-1.5">
          <StatusPill label={SEVERITY_LABEL[flag.severity]} tone={SEVERITY_TONE[flag.severity]} />
          <StatusPill
            label={flag.isActive ? 'Active' : 'Resolved'}
            tone={flag.isActive ? 'warning' : 'success'}
          />
        </span>
        {flag.isActive && canEdit ? (
          <Secondary
            size="compact"
            text={resolving ? 'Resolving…' : 'Resolve'}
            icon={<IoCheckmarkOutline size={15} aria-hidden="true" />}
            isDisabled={resolving}
            onClick={() => onResolve?.(flag)}
            ariaLabel={`Resolve ${flag.title}`}
          />
        ) : null}
        {!flag.isActive && resolved ? <span className={metaClass}>Resolved {resolved}</span> : null}
      </span>
    </li>
  );
};

const emptyForm: FlagFormValues = {
  title: '',
  flagType: 'SPECIAL_HANDLING',
  severity: 'MEDIUM',
  description: '',
};

type CreateFlagFormProps = {
  creating: boolean;
  onCreate?: NonNullable<FlagListProps['onCreate']>;
  onCancel: () => void;
};

const CreateFlagForm = ({ creating, onCreate, onCancel }: CreateFlagFormProps) => {
  const [values, setValues] = useState<FlagFormValues>(emptyForm);
  const trimmedTitle = values.title.trim();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!trimmedTitle || creating) return;
    const saved = await onCreate?.({ ...values, title: trimmedTitle });
    if (saved) {
      setValues(emptyForm);
      onCancel();
    }
  };

  return (
    <form
      className="flex flex-col gap-3 border-b border-[var(--divider)] bg-[var(--inset)] px-4 py-4"
      onSubmit={handleSubmit}
    >
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="patient-flag-title">
          Flag title
        </label>
        <input
          id="patient-flag-title"
          className={controlClass}
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          maxLength={200}
          required
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="patient-flag-type">
            Flag type
          </label>
          <select
            id="patient-flag-type"
            className={controlClass}
            value={values.flagType}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                flagType: event.target.value as PatientFlagType,
              }))
            }
          >
            {TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABEL[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className={fieldLabelClass} htmlFor="patient-flag-severity">
            Severity
          </label>
          <select
            id="patient-flag-severity"
            className={controlClass}
            value={values.severity}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                severity: event.target.value as FlagSeverity,
              }))
            }
          >
            {SEVERITY_OPTIONS.map((severity) => (
              <option key={severity} value={severity}>
                {SEVERITY_LABEL[severity]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        <label className={fieldLabelClass} htmlFor="patient-flag-description">
          Description
        </label>
        <textarea
          id="patient-flag-description"
          className={clsx(controlClass, 'min-h-16 resize-y')}
          value={values.description}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
        />
      </div>
      <div className="flex items-center justify-end gap-2">
        <Secondary size="compact" text="Cancel" onClick={onCancel} />
        <Primary
          size="compact"
          type="submit"
          text="Save flag"
          isDisabled={!trimmedTitle || creating}
        />
      </div>
    </form>
  );
};

const FlagList = ({
  flags,
  loading = false,
  error = null,
  canEdit = false,
  onCreate,
  onResolve,
  creating = false,
  resolvingId = null,
}: FlagListProps) => {
  const [showForm, setShowForm] = useState(false);
  const activeCount = useMemo(() => flags.filter((flag) => flag.isActive).length, [flags]);

  const body = (() => {
    if (loading) return <LoadingRows />;
    if (flags.length === 0) return <EmptyState />;
    return (
      <ul className="divide-y divide-[var(--divider)]">
        {flags.map((flag) => (
          <FlagRow
            key={flag.id}
            flag={flag}
            canEdit={canEdit}
            onResolve={onResolve}
            resolving={resolvingId === flag.id}
          />
        ))}
      </ul>
    );
  })();

  return (
    <section className={cardClass} aria-labelledby="patient-flag-list-heading">
      <header className="flex items-center gap-2 border-b border-[var(--divider)] px-4 py-3">
        <span className="text-[var(--ink-muted)]" aria-hidden="true">
          <IoFlagOutline size={18} />
        </span>
        <h3 id="patient-flag-list-heading" className="text-[13.5px] font-bold text-[var(--ink)]">
          Patient flags
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
            onClick={() => setShowForm((current) => !current)}
            aria-expanded={showForm}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--hairline)] px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-soft)] transition-colors hover:bg-[var(--inset)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            <IoAddOutline size={15} aria-hidden="true" />
            {showForm ? 'Close' : 'Add flag'}
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
        <CreateFlagForm
          creating={creating}
          onCreate={onCreate}
          onCancel={() => setShowForm(false)}
        />
      ) : null}

      {body}
    </section>
  );
};

export default FlagList;
