'use client';
import React, { useMemo, useState } from 'react';
import { IoAddOutline, IoSearchOutline, IoWarningOutline } from 'react-icons/io5';
import clsx from 'clsx';

import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';
import GenericTable, { type Column } from '@/app/ui/tables/GenericTable/GenericTable';
import { formatDateTimeLocal } from '@/app/lib/date';
import {
  DEA_SCHEDULES,
  DEA_SCHEDULE_LABEL,
  DEA_SCHEDULE_TONE,
  DRUG_UNITS,
  DRUG_UNIT_LABEL,
  formatAmount,
  type ControlledSubstanceLog,
  type CreateControlledSubstanceLogInput,
  type DeaSchedule,
  type DrugUnit,
} from '@/app/features/compliance/types/controlledSubstance';

export type ControlledSubstanceDateRange = { fromDate?: string; toDate?: string };

type ControlledSubstanceRegisterProps = {
  entries: ControlledSubstanceLog[];
  loading: boolean;
  error: string | null;
  dateRange: ControlledSubstanceDateRange;
  onDateRangeChange: (range: ControlledSubstanceDateRange) => void;
  /** Whether the viewer may append entries (prescription:edit permission). */
  canRecord: boolean;
  creating: boolean;
  createError: string | null;
  /** Resolves `true` when the entry was saved, so the form can close itself. */
  onCreate: (input: CreateControlledSubstanceLogInput) => Promise<boolean>;
};

const fieldClass =
  'flex items-stretch overflow-hidden rounded-2xl border border-input-border-default focus-within:border-input-border-active';
const inputClass =
  'min-w-0 flex-1 bg-transparent px-3 py-2 text-body-4 text-text-primary outline-none';
const labelClass = 'text-caption-2 font-bold text-text-tertiary';

/** yyyy-mm-dd (from a date input) to the ISO datetime the API's date bounds want. */
const toIsoBound = (date: string, endOfDay: boolean): string | undefined => {
  if (!date) return undefined;
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000';
  return `${date}T${time}Z`;
};

/** A date input value (yyyy-mm-dd) back out of an ISO bound, for controlled inputs. */
const fromIsoBound = (iso?: string): string => (iso ? iso.slice(0, 10) : '');

/** The witness line under a waste amount: the name, or a compliance-gap flag. */
const WitnessLine = ({ entry }: { entry: ControlledSubstanceLog }) => {
  if (entry.amountWasted <= 0) return null;
  if (!entry.wastedWitness?.trim()) {
    return (
      <span
        className="inline-flex items-center gap-1 text-caption-2 font-semibold"
        style={{ color: 'var(--danger-text)' }}
      >
        <IoWarningOutline size={12} aria-hidden="true" />
        Witness missing
      </span>
    );
  }
  return (
    <span className="text-caption-2 text-text-tertiary" title={entry.wastedWitness}>
      Witness: {entry.wastedWitness}
    </span>
  );
};

/** The `wasted` cell: emphasised amount plus its witness, the compliance line. */
const WastedCell = ({ entry }: { entry: ControlledSubstanceLog }) => {
  const hasWaste = entry.amountWasted > 0;
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={clsx('tabular-nums', hasWaste ? 'font-bold' : 'text-text-secondary')}
        style={hasWaste ? { color: 'var(--danger-text)' } : undefined}
      >
        {formatAmount(entry.amountWasted)}
      </span>
      <WitnessLine entry={entry} />
    </div>
  );
};

const BalanceCell = ({ entry }: { entry: ControlledSubstanceLog }) => {
  if (entry.balanceBefore === null && entry.balanceAfter === null) {
    return <span className="text-text-tertiary">—</span>;
  }
  return (
    <span className="whitespace-nowrap tabular-nums text-text-secondary">
      {formatAmount(entry.balanceBefore)}
      <span className="px-1 text-text-tertiary" aria-hidden="true">
        →
      </span>
      {formatAmount(entry.balanceAfter)}
    </span>
  );
};

const StrengthUnitCell = ({ entry }: { entry: ControlledSubstanceLog }) => (
  <span className="whitespace-nowrap text-text-secondary">
    {entry.strength !== null && (
      <span className="tabular-nums text-text-primary">{formatAmount(entry.strength)} </span>
    )}
    {DRUG_UNIT_LABEL[entry.unit]}
  </span>
);

const buildColumns = (): Column<ControlledSubstanceLog>[] => [
  {
    key: 'loggedAt',
    label: 'Logged at',
    render: (entry) => (
      <span className="whitespace-nowrap text-text-secondary">
        {formatDateTimeLocal(entry.loggedAt)}
      </span>
    ),
  },
  {
    key: 'drug',
    label: 'Drug',
    render: (entry) => (
      <div className="flex min-w-0 flex-col gap-1">
        <span className="truncate font-semibold text-text-primary" title={entry.drug}>
          {entry.drug}
        </span>
        <StatusPill
          label={DEA_SCHEDULE_LABEL[entry.deaSchedule]}
          tone={DEA_SCHEDULE_TONE[entry.deaSchedule]}
        />
      </div>
    ),
  },
  {
    key: 'strength',
    label: 'Strength / unit',
    render: (entry) => <StrengthUnitCell entry={entry} />,
  },
  {
    key: 'amountDrawn',
    label: 'Drawn',
    render: (entry) => (
      <span className="tabular-nums text-text-primary">{formatAmount(entry.amountDrawn)}</span>
    ),
  },
  {
    key: 'amountAdministered',
    label: 'Administered',
    render: (entry) => (
      <span className="tabular-nums text-text-primary">
        {formatAmount(entry.amountAdministered)}
      </span>
    ),
  },
  {
    key: 'amountWasted',
    label: 'Wasted',
    render: (entry) => <WastedCell entry={entry} />,
  },
  {
    key: 'balanceAfter',
    label: 'Balance',
    render: (entry) => <BalanceCell entry={entry} />,
  },
  {
    key: 'administeredBy',
    label: 'By',
    render: (entry) => (
      <span className="truncate text-text-secondary" title={entry.administeredBy ?? undefined}>
        {entry.administeredBy?.trim() ? entry.administeredBy : '—'}
      </span>
    ),
  },
  {
    key: 'notes',
    label: 'Notes',
    render: (entry) =>
      entry.notes?.trim() ? (
        <span className="line-clamp-2 max-w-[16rem] text-text-secondary" title={entry.notes}>
          {entry.notes}
        </span>
      ) : (
        <span className="text-text-tertiary">—</span>
      ),
  },
];

const ControlledSubstanceRegister = ({
  entries,
  loading,
  error,
  dateRange,
  onDateRangeChange,
  canRecord,
  creating,
  createError,
  onCreate,
}: ControlledSubstanceRegisterProps) => {
  const [drugQuery, setDrugQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  // Close the form only when the save actually succeeds. Driven by the create
  // promise resolving inside the submit path, not a useEffect watching a prop,
  // so a failed save keeps the form (and its values) on screen.
  const handleFormSubmit = async (input: CreateControlledSubstanceLogInput) => {
    if (await onCreate(input)) setAddOpen(false);
  };

  const columns = useMemo(() => buildColumns(), []);

  const filteredEntries = useMemo(() => {
    const query = drugQuery.trim().toLowerCase();
    if (!query) return entries;
    return entries.filter((entry) => entry.drug.toLowerCase().includes(query));
  }, [entries, drugQuery]);

  const setBound = (key: 'fromDate' | 'toDate', value: string) => {
    onDateRangeChange({
      ...dateRange,
      [key]: toIsoBound(value, key === 'toDate'),
    });
  };

  return (
    <div className="relative flex h-full min-h-0 w-full flex-col gap-4 yc-page-content">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-heading-4 text-text-primary">Controlled substances register</h1>
          <p className="max-w-2xl text-body-4 text-text-secondary">
            A running DEA compliance log of every controlled-drug draw, administration and waste.
          </p>
        </div>
        {canRecord && (
          <Primary
            text="Add entry"
            icon={<IoAddOutline size={16} aria-hidden="true" />}
            onClick={() => setAddOpen((open) => !open)}
            ariaLabel="Add a controlled substance entry"
          />
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-56 flex-1 flex-col gap-1">
          <label htmlFor="cs-drug-filter" className={labelClass}>
            Drug
          </label>
          <span className={fieldClass}>
            <span className="flex items-center pl-3 text-text-tertiary" aria-hidden="true">
              <IoSearchOutline size={16} />
            </span>
            <input
              id="cs-drug-filter"
              type="search"
              value={drugQuery}
              onChange={(event) => setDrugQuery(event.target.value)}
              placeholder="Filter by drug"
              className={inputClass}
            />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cs-from-date" className={labelClass}>
            From
          </label>
          <span className={fieldClass}>
            <input
              id="cs-from-date"
              type="date"
              value={fromIsoBound(dateRange.fromDate)}
              onChange={(event) => setBound('fromDate', event.target.value)}
              className={inputClass}
            />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="cs-to-date" className={labelClass}>
            To
          </label>
          <span className={fieldClass}>
            <input
              id="cs-to-date"
              type="date"
              value={fromIsoBound(dateRange.toDate)}
              onChange={(event) => setBound('toDate', event.target.value)}
              className={inputClass}
            />
          </span>
        </div>
      </div>

      {addOpen && canRecord && (
        <AddEntryForm
          creating={creating}
          createError={createError}
          onSubmit={handleFormSubmit}
          onCancel={() => setAddOpen(false)}
        />
      )}

      <div className="min-h-0 flex-1">
        <RegisterBody loading={loading} error={error} entries={filteredEntries} columns={columns} />
      </div>
    </div>
  );
};

const RegisterBody = ({
  loading,
  error,
  entries,
  columns,
}: {
  loading: boolean;
  error: string | null;
  entries: ControlledSubstanceLog[];
  columns: Column<ControlledSubstanceLog>[];
}) => {
  if (loading) {
    return (
      <div
        className="h-full min-h-64 animate-pulse rounded-2xl bg-card-hover"
        aria-hidden="true"
        data-testid="cs-register-loading"
      />
    );
  }
  if (error) {
    return (
      <div
        role="alert"
        className="rounded-2xl border border-card-border p-6 text-body-4 text-text-error"
      >
        {error}
      </div>
    );
  }
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-card-border p-8 text-center">
        <p className="text-body-3 text-text-primary">No controlled substance entries yet.</p>
        <p className="mt-1 text-body-4 text-text-secondary">
          Log a draw, administration or waste to start the compliance register.
        </p>
      </div>
    );
  }
  return (
    <GenericTable
      data={entries}
      columns={columns}
      caption="Controlled substance register for this organisation"
      itemNoun="entries"
      pagination
    />
  );
};

type AddEntryFormProps = {
  creating: boolean;
  createError: string | null;
  onSubmit: (input: CreateControlledSubstanceLogInput) => void;
  onCancel: () => void;
};

const parseOptionalNumber = (raw: string): number | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/** Now as the value a datetime-local input expects (local time, no seconds). */
const nowLocalDateTime = (): string => {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
};

const AddEntryForm = ({ creating, createError, onSubmit, onCancel }: AddEntryFormProps) => {
  const [loggedAt, setLoggedAt] = useState(nowLocalDateTime);
  const [drug, setDrug] = useState('');
  const [deaSchedule, setDeaSchedule] = useState<DeaSchedule>('II');
  const [unit, setUnit] = useState<DrugUnit>('ML');
  const [strength, setStrength] = useState('');
  const [lotNumber, setLotNumber] = useState('');
  const [amountDrawn, setAmountDrawn] = useState('');
  const [amountAdministered, setAmountAdministered] = useState('');
  const [amountWasted, setAmountWasted] = useState('');
  const [wastedWitness, setWastedWitness] = useState('');
  const [balanceBefore, setBalanceBefore] = useState('');
  const [balanceAfter, setBalanceAfter] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const submit = () => {
    const trimmedDrug = drug.trim();
    if (!trimmedDrug) {
      setFormError('Enter the drug name.');
      return;
    }
    const drawn = parseOptionalNumber(amountDrawn);
    if (drawn === undefined || drawn <= 0) {
      setFormError('Amount drawn must be greater than zero.');
      return;
    }
    const administered = parseOptionalNumber(amountAdministered);
    if (administered === undefined) {
      setFormError('Enter the amount administered.');
      return;
    }
    // Negatives are rejected by the inputs' `min="0"` and again by the server,
    // so a blank field is the only administered/wasted case left to catch here.
    const wasted = parseOptionalNumber(amountWasted) ?? 0;
    // Mirror the backend reconciliation so the user is told before the request.
    if (administered + wasted > drawn) {
      setFormError('Administered plus wasted cannot exceed the amount drawn.');
      return;
    }
    // Compliance affordance: waste needs a witness. The backend leaves the
    // witness optional, so the register enforces it at the form.
    if (wasted > 0 && !wastedWitness.trim()) {
      setFormError('A witness is required whenever any amount is wasted.');
      return;
    }

    setFormError(null);
    onSubmit({
      loggedAt: new Date(loggedAt).toISOString(),
      drug: trimmedDrug,
      deaSchedule,
      unit,
      amountDrawn: drawn,
      amountAdministered: administered,
      amountWasted: wasted,
      wastedWitness: wastedWitness.trim() || undefined,
      strength: parseOptionalNumber(strength),
      lotNumber: lotNumber.trim() || undefined,
      balanceBefore: parseOptionalNumber(balanceBefore),
      balanceAfter: parseOptionalNumber(balanceAfter),
      notes: notes.trim() || undefined,
    });
  };

  const message = formError ?? createError;

  return (
    <form
      aria-label="Add controlled substance entry"
      className="flex flex-col gap-4 rounded-2xl border border-card-border p-5!"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <h2 className="text-heading-6 text-text-primary">New register entry</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="cs-logged-at" label="Logged at">
          <input
            id="cs-logged-at"
            type="datetime-local"
            value={loggedAt}
            onChange={(event) => setLoggedAt(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-drug" label="Drug name">
          <input
            id="cs-drug"
            type="text"
            value={drug}
            onChange={(event) => setDrug(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-schedule" label="DEA schedule">
          <select
            id="cs-schedule"
            value={deaSchedule}
            onChange={(event) => setDeaSchedule(event.target.value as DeaSchedule)}
            className={inputClass}
          >
            {DEA_SCHEDULES.map((schedule) => (
              <option key={schedule} value={schedule}>
                {DEA_SCHEDULE_LABEL[schedule]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="cs-unit" label="Unit">
          <select
            id="cs-unit"
            value={unit}
            onChange={(event) => setUnit(event.target.value as DrugUnit)}
            className={inputClass}
          >
            {DRUG_UNITS.map((option) => (
              <option key={option} value={option}>
                {DRUG_UNIT_LABEL[option]}
              </option>
            ))}
          </select>
        </Field>

        <Field id="cs-strength" label="Strength (optional)">
          <input
            id="cs-strength"
            type="number"
            step="any"
            min="0"
            value={strength}
            onChange={(event) => setStrength(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-lot" label="Lot number (optional)">
          <input
            id="cs-lot"
            type="text"
            value={lotNumber}
            onChange={(event) => setLotNumber(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-drawn" label="Amount drawn">
          <input
            id="cs-drawn"
            type="number"
            step="any"
            min="0"
            value={amountDrawn}
            onChange={(event) => setAmountDrawn(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-administered" label="Amount administered">
          <input
            id="cs-administered"
            type="number"
            step="any"
            min="0"
            value={amountAdministered}
            onChange={(event) => setAmountAdministered(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-wasted" label="Amount wasted">
          <input
            id="cs-wasted"
            type="number"
            step="any"
            min="0"
            value={amountWasted}
            onChange={(event) => setAmountWasted(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-witness" label="Waste witness">
          <input
            id="cs-witness"
            type="text"
            value={wastedWitness}
            onChange={(event) => setWastedWitness(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-balance-before" label="Balance before (optional)">
          <input
            id="cs-balance-before"
            type="number"
            step="any"
            min="0"
            value={balanceBefore}
            onChange={(event) => setBalanceBefore(event.target.value)}
            className={inputClass}
          />
        </Field>

        <Field id="cs-balance-after" label="Balance after (optional)">
          <input
            id="cs-balance-after"
            type="number"
            step="any"
            min="0"
            value={balanceAfter}
            onChange={(event) => setBalanceAfter(event.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="cs-notes" className={labelClass}>
          Notes (optional)
        </label>
        <span className={fieldClass}>
          <textarea
            id="cs-notes"
            rows={2}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className={inputClass}
          />
        </span>
      </div>

      {message ? (
        <p role="alert" className="text-body-4 text-text-error">
          {message}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2">
        <Secondary
          text="Cancel"
          isDisabled={creating}
          onClick={onCancel}
          ariaLabel="Cancel adding an entry"
        />
        <Primary
          text={creating ? 'Saving…' : 'Save entry'}
          type="submit"
          isDisabled={creating}
          ariaLabel="Save this controlled substance entry"
        />
      </div>
    </form>
  );
};

const Field = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) => (
  <div className="flex flex-col gap-1">
    <label htmlFor={id} className={labelClass}>
      {label}
    </label>
    <span className={fieldClass}>{children}</span>
  </div>
);

export default ControlledSubstanceRegister;
