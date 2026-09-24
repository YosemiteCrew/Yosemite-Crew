'use client';
import React, { useEffect, useId, useRef, useState } from 'react';
import clsx from 'clsx';
import { IoAddOutline, IoTrashOutline } from 'react-icons/io5';
import Field from '@/app/ui/Field';
import Input, { Textarea } from '@/app/ui/Input';
import Dropdown from '@/app/ui/inputs/Dropdown/Dropdown';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import { useIsPhone } from '@/app/ui/layout/PhoneShell/useIsPhone';
import {
  FLAG_OPTIONS,
  TEST_TYPE_OPTIONS,
  emptyPocLabForm,
  hasErrors,
  newRow,
  toDateTimeLocal,
  validatePocLabForm,
  type PocLabFormErrors,
  type PocLabFormValues,
  type PocLabRowErrors,
  type PocLabRowValues,
} from '@/app/features/companionHistory/components/pocLabForm';
import type {
  LabResultFlag,
  PocTestType,
} from '@/app/features/companionHistory/services/pocLabService';

export type PocLabResultFormProps = {
  /** Disables Save while a create is in flight. */
  creating?: boolean;
  /** Receives validated values. Resolves true once the record is saved. */
  onCreate?: (values: PocLabFormValues) => Promise<boolean> | boolean;
  /** Cancel, and a successful save, both close the form. */
  onClose: () => void;
};

/** Below this width each parameter is a card; at 1024px and up it is a table row. */
const CARD_QUERY = '(max-width: 1023px)';

const ROW_GRID =
  'lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_32px]';

const COLUMNS = ['Parameter', 'Value', 'Unit', 'Reference low', 'Reference high', 'Flag'];

const ROW_FIELDS = ['name', 'value', 'low', 'high'] as const;

const errorId = (controlId: string) => `${controlId}-error`;

const describedBy = (controlId: string, message?: string) =>
  message ? errorId(controlId) : undefined;

const OptionalLabel = ({ text }: { text: string }) => (
  <>
    {text} <span className="text-xs font-normal text-[var(--ink-faint)]">Optional</span>
  </>
);

const CellError = ({ controlId, message }: { controlId: string; message?: string }) =>
  message ? (
    <span id={errorId(controlId)} role="alert" className="text-xs text-[var(--danger-text)]">
      {message}
    </span>
  ) : null;

/**
 * One parameter cell. Cards show the column name above the control; the table
 * shows it once in the header row. The visible text is aria-hidden in both
 * layouts because the control's own aria-label already names it.
 */
const RowCell = ({
  label,
  controlId,
  error,
  children,
}: {
  label: string;
  controlId: string;
  error?: string;
  children: React.ReactNode;
}) => (
  <div className="flex min-w-0 flex-col gap-2 lg:gap-1.5">
    <span aria-hidden="true" className="text-sm font-medium text-[var(--ink-body)] lg:hidden">
      {label}
    </span>
    {children}
    <CellError controlId={controlId} message={error} />
  </div>
);

type TextColumn = 'name' | 'value' | 'unit' | 'low' | 'high';

const TEXT_COLUMNS: Record<
  TextColumn,
  { label: string; aria: string; maxLength: number; placeholder?: string; decimal?: boolean }
> = {
  name: { label: 'Parameter', aria: 'name', maxLength: 100, placeholder: 'e.g. HGB' },
  value: { label: 'Value', aria: 'value', maxLength: 100 },
  unit: { label: 'Unit', aria: 'unit', maxLength: 50 },
  low: { label: 'Reference low', aria: 'reference low', maxLength: 50, decimal: true },
  high: { label: 'Reference high', aria: 'reference high', maxLength: 50, decimal: true },
};

const ResultRow = ({
  row,
  position,
  errors,
  canRemove,
  idFor,
  onChange,
  onRemove,
}: {
  row: PocLabRowValues;
  position: number;
  errors: PocLabRowErrors;
  canRemove: boolean;
  idFor: (column: string) => string;
  onChange: (patch: Partial<PocLabRowValues>) => void;
  onRemove: () => void;
}) => {
  const text = (column: TextColumn) => {
    const spec = TEXT_COLUMNS[column];
    const controlId = idFor(column);
    const message = column === 'unit' ? undefined : errors[column];
    return (
      <RowCell label={spec.label} controlId={controlId} error={message}>
        <Input
          id={controlId}
          aria-label={`Parameter ${position} ${spec.aria}`}
          aria-describedby={describedBy(controlId, message)}
          placeholder={spec.placeholder ?? ''}
          maxLength={spec.maxLength}
          inputMode={spec.decimal ? 'decimal' : undefined}
          value={row[column]}
          error={Boolean(message)}
          onChange={(event) => onChange({ [column]: event.target.value })}
        />
      </RowCell>
    );
  };

  return (
    <div
      className={clsx(
        'flex flex-col gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--screen)] p-3',
        'lg:grid lg:items-start lg:gap-x-2 lg:gap-y-1.5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0',
        ROW_GRID
      )}
    >
      <div className="flex min-h-7 items-center justify-between lg:contents">
        <span className="text-[13px] font-bold text-[var(--ink)] lg:hidden">
          {`Parameter ${position}`}
        </span>
        {canRemove ? (
          <button
            type="button"
            aria-label={`Remove parameter ${position}`}
            onClick={onRemove}
            className="-my-2 -mr-2 flex size-11 shrink-0 items-center justify-center rounded-xl text-[var(--ink-muted)] transition-colors hover:bg-[var(--inset)] hover:text-[var(--danger-text)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] lg:col-start-7 lg:row-start-1 lg:m-0 lg:h-10 lg:w-8 lg:rounded-[10px]"
          >
            <IoTrashOutline size={16} aria-hidden="true" className="max-lg:size-[18px]" />
          </button>
        ) : null}
      </div>
      {text('name')}
      <div className="grid grid-cols-2 items-start gap-3 lg:contents">
        {text('value')}
        {text('unit')}
      </div>
      <div className="grid grid-cols-2 items-start gap-3 lg:contents">
        {text('low')}
        {text('high')}
      </div>
      <RowCell label="Flag" controlId={idFor('flag')}>
        <LabelDropdown
          placeholder={`Parameter ${position} flag`}
          hideLabel
          searchable={false}
          options={FLAG_OPTIONS}
          defaultOption={row.flag}
          onSelect={(option) => onChange({ flag: option.value as '' | LabResultFlag })}
        />
      </RowCell>
    </div>
  );
};

/**
 * Inline form that records one in-house (point-of-care) lab result. It
 * validates on submit and again on every change after the first attempt, and
 * keeps Save enabled so a press always says what is missing. It emits raw
 * values; the payload is built by the caller.
 */
const PocLabResultForm = ({ creating = false, onCreate, onClose }: PocLabResultFormProps) => {
  const baseId = useId();
  const [values, setValues] = useState<PocLabFormValues>(() => emptyPocLabForm(new Date()));
  const [latestAllowed, setLatestAllowed] = useState(values.performedAt);
  const [errors, setErrors] = useState<PocLabFormErrors | null>(null);
  const focusRowId = useRef<string | null>(null);
  const isPhone = useIsPhone();
  const isCardLayout = useIsPhone(CARD_QUERY);

  const ids = {
    testType: `${baseId}-test-type`,
    performedAt: `${baseId}-performed-at`,
    sampleType: `${baseId}-sample-type`,
    analyzer: `${baseId}-analyzer`,
    interpretation: `${baseId}-interpretation`,
    notes: `${baseId}-notes`,
    followUp: `${baseId}-follow-up`,
    row: (rowId: string, column: string) => `${baseId}-${rowId}-${column}`,
  };

  useEffect(() => {
    const rowId = focusRowId.current;
    if (!rowId) return;
    focusRowId.current = null;
    document.getElementById(`${baseId}-${rowId}-name`)?.focus();
  }, [values.rows, baseId]);

  const update = (next: PocLabFormValues) => {
    setValues(next);
    if (errors) setErrors(validatePocLabForm(next, new Date()));
  };
  const patch = (partial: Partial<PocLabFormValues>) => update({ ...values, ...partial });
  const patchRow = (rowId: string, partial: Partial<PocLabRowValues>) =>
    patch({ rows: values.rows.map((row) => (row.id === rowId ? { ...row, ...partial } : row)) });

  const addRow = () => {
    const row = newRow();
    focusRowId.current = row.id;
    patch({ rows: [...values.rows, row] });
  };

  const focusFirstInvalid = (found: PocLabFormErrors) => {
    if (found.testType) {
      document.getElementById(ids.testType)?.querySelector('button')?.focus();
      return;
    }
    if (found.performedAt) {
      document.getElementById(ids.performedAt)?.focus();
      return;
    }
    for (const row of values.rows) {
      const column = ROW_FIELDS.find((key) => found.rows[row.id]?.[key]);
      if (column) {
        document.getElementById(ids.row(row.id, column))?.focus();
        return;
      }
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const found = validatePocLabForm(values, new Date());
    setErrors(found);
    if (hasErrors(found)) {
      focusFirstInvalid(found);
      return;
    }
    const saved = await onCreate?.(values);
    if (saved) onClose();
  };

  const buttonSize = isPhone ? 'large' : 'compact';

  return (
    <form
      noValidate
      aria-label="Record a lab result"
      className="flex flex-col gap-5 border-b border-[var(--divider)] bg-[var(--inset)] p-4"
      onSubmit={handleSubmit}
    >
      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div id={ids.testType} className="min-w-0">
          <Dropdown
            placeholder="Test type"
            emptyLabel="Select a test type"
            value={values.testType}
            options={TEST_TYPE_OPTIONS}
            error={errors?.testType}
            onChange={(value: string) => patch({ testType: value as PocTestType })}
          />
        </div>
        <Field
          htmlFor={ids.performedAt}
          label="Performed at"
          error={errors?.performedAt}
          messageId={errorId(ids.performedAt)}
          className="min-w-0"
        >
          <Input
            id={ids.performedAt}
            type="datetime-local"
            placeholder=""
            max={latestAllowed}
            value={values.performedAt}
            error={Boolean(errors?.performedAt)}
            aria-describedby={describedBy(ids.performedAt, errors?.performedAt)}
            onFocus={() => setLatestAllowed(toDateTimeLocal(new Date()))}
            onChange={(event) => patch({ performedAt: event.target.value })}
          />
        </Field>
        <Field
          htmlFor={ids.sampleType}
          label={<OptionalLabel text="Sample type" />}
          className="min-w-0"
        >
          <Input
            id={ids.sampleType}
            placeholder="e.g. Whole blood (EDTA)"
            maxLength={100}
            value={values.sampleType}
            onChange={(event) => patch({ sampleType: event.target.value })}
          />
        </Field>
        <Field htmlFor={ids.analyzer} label={<OptionalLabel text="Analyzer" />} className="min-w-0">
          <Input
            id={ids.analyzer}
            placeholder="e.g. In-clinic hematology analyzer"
            maxLength={200}
            value={values.analyzerName}
            onChange={(event) => patch({ analyzerName: event.target.value })}
          />
        </Field>
      </div>

      <fieldset className="m-0 flex min-w-0 flex-col gap-3 border-0 p-0">
        <legend className="mb-1 p-0">
          <span className="block text-[13px] font-bold text-[var(--ink)]">Results</span>
          <span className="mt-0.5 block text-xs text-[var(--ink-faint)]">
            Parameter and value are required. Unit, reference range and flag are optional.
          </span>
        </legend>
        <div className="flex flex-col gap-3 lg:gap-2">
          <div aria-hidden="true" className={clsx('hidden gap-x-2 lg:grid', ROW_GRID)}>
            {COLUMNS.map((column) => (
              <span key={column} className="text-xs font-semibold text-[var(--ink-muted)]">
                {column}
              </span>
            ))}
          </div>
          {values.rows.map((row, index) => (
            <ResultRow
              key={row.id}
              row={row}
              position={index + 1}
              errors={errors?.rows[row.id] ?? {}}
              canRemove={values.rows.length > 1}
              idFor={(column) => ids.row(row.id, column)}
              onChange={(partial) => patchRow(row.id, partial)}
              onRemove={() => patch({ rows: values.rows.filter((item) => item.id !== row.id) })}
            />
          ))}
        </div>
        <div>
          <Secondary
            text="Add parameter"
            icon={<IoAddOutline />}
            size={isCardLayout ? 'large' : 'compact'}
            className={isCardLayout ? 'w-full' : undefined}
            onClick={addRow}
          />
        </div>
      </fieldset>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <Field htmlFor={ids.interpretation} label={<OptionalLabel text="Interpretation" />}>
          <Textarea
            id={ids.interpretation}
            placeholder="Overall interpretation of these results"
            maxLength={3000}
            value={values.interpretation}
            onChange={(event) => patch({ interpretation: event.target.value })}
          />
        </Field>
        <Field htmlFor={ids.notes} label={<OptionalLabel text="Notes" />}>
          <Textarea
            id={ids.notes}
            placeholder="Anything else the team should know"
            maxLength={3000}
            value={values.notes}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-h-11 items-center gap-2.5 md:min-h-0">
          <input
            id={ids.followUp}
            type="checkbox"
            className="m-0 size-[18px] shrink-0 accent-[var(--cta)]"
            checked={values.followUp}
            onChange={(event) => patch({ followUp: event.target.checked })}
          />
          <label htmlFor={ids.followUp} className="text-sm font-medium text-[var(--ink-body)]">
            Follow-up recommended
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 md:flex md:gap-2">
          <Secondary
            text="Cancel"
            size={buttonSize}
            className={isPhone ? 'w-full' : undefined}
            onClick={onClose}
          />
          <Primary
            type="submit"
            text="Save lab result"
            size={buttonSize}
            className={isPhone ? 'w-full' : undefined}
            isDisabled={creating}
          />
        </div>
      </div>
    </form>
  );
};

export default PocLabResultForm;
