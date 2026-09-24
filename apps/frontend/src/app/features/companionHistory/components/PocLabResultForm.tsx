'use client';
import React, { useState } from 'react';
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
  MAX_PARAMETERS,
  TEST_TYPE_OPTIONS,
  toDateTimeLocal,
  type PocLabFormValues,
  type PocLabRowErrors,
  type PocLabRowValues,
} from '@/app/features/companionHistory/components/pocLabForm';
import {
  usePocLabResultForm,
  type PocLabResultFormState,
} from '@/app/features/companionHistory/components/usePocLabResultForm';
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

const PARAMETER_LIMIT = `A lab result can have up to ${MAX_PARAMETERS} parameters.`;

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

type RowTextCellProps = {
  column: TextColumn;
  position: number;
  controlId: string;
  value: string;
  error?: string;
  onChange: (value: string) => void;
};

const RowTextCell = ({ column, position, controlId, value, error, onChange }: RowTextCellProps) => {
  const spec = TEXT_COLUMNS[column];
  return (
    <RowCell label={spec.label} controlId={controlId} error={error}>
      <Input
        id={controlId}
        aria-label={`Parameter ${position} ${spec.aria}`}
        aria-describedby={describedBy(controlId, error)}
        placeholder={spec.placeholder ?? ''}
        maxLength={spec.maxLength}
        inputMode={spec.decimal ? 'decimal' : undefined}
        value={value}
        error={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
    </RowCell>
  );
};

type ResultRowProps = {
  row: PocLabRowValues;
  position: number;
  errors: PocLabRowErrors;
  canRemove: boolean;
  idFor: (column: string) => string;
  onChange: (patch: Partial<PocLabRowValues>) => void;
  onRemove: () => void;
};

const ResultRow = ({
  row,
  position,
  errors,
  canRemove,
  idFor,
  onChange,
  onRemove,
}: ResultRowProps) => {
  const text = (column: TextColumn) => (
    <RowTextCell
      column={column}
      position={position}
      controlId={idFor(column)}
      value={row[column]}
      error={column === 'unit' ? undefined : errors[column]}
      onChange={(value) => onChange({ [column]: value })}
    />
  );

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

type SectionProps = Pick<PocLabResultFormState, 'ids' | 'values' | 'errors' | 'patch'>;

/**
 * The latest time the control offers moves forward to now whenever it takes
 * focus, so a form left open for a while still accepts the current minute.
 */
const PerformedAtField = ({ ids, values, errors, patch }: SectionProps) => {
  const [latestAllowed, setLatestAllowed] = useState(() => toDateTimeLocal(new Date()));
  return (
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
  );
};

/** Test type, performed at, sample type and analyzer. */
const TestDetailsFields = (props: SectionProps) => {
  const { ids, values, errors, patch } = props;
  return (
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
      <PerformedAtField {...props} />
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
  );
};

type ResultsFieldsetProps = Pick<
  PocLabResultFormState,
  'ids' | 'values' | 'errors' | 'canAddRow' | 'addRow' | 'patchRow' | 'removeRow'
> & { isCardLayout: boolean };

/**
 * One row per parameter, and Add parameter. At the backend's parameter limit
 * the button is disabled and the status line under it says why.
 */
const ResultsFieldset = ({
  ids,
  values,
  errors,
  canAddRow,
  addRow,
  patchRow,
  removeRow,
  isCardLayout,
}: ResultsFieldsetProps) => (
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
          onRemove={() => removeRow(row.id)}
        />
      ))}
    </div>
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Secondary
        text="Add parameter"
        icon={<IoAddOutline />}
        size={isCardLayout ? 'large' : 'compact'}
        className={isCardLayout ? 'w-full' : undefined}
        isDisabled={!canAddRow}
        onClick={addRow}
      />
      {/* An <output> is a status region; it stays mounted so the limit is announced. */}
      <output className={clsx('text-xs text-[var(--ink-faint)]', canAddRow && 'sr-only')}>
        {canAddRow ? '' : PARAMETER_LIMIT}
      </output>
    </div>
  </fieldset>
);

/** Interpretation and notes. */
const NotesFields = ({ ids, values, patch }: SectionProps) => (
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
);

type FormFooterProps = Pick<SectionProps, 'ids' | 'values' | 'patch'> & {
  creating: boolean;
  onClose: () => void;
};

/** Follow-up, then Cancel and Save. Below 768px the buttons are full-width 44px targets. */
const FormFooter = ({ ids, values, patch, creating, onClose }: FormFooterProps) => {
  const isPhone = useIsPhone();
  const buttonSize = isPhone ? 'large' : 'compact';
  return (
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
  );
};

/**
 * Inline form that records one in-house (point-of-care) lab result. It
 * validates on submit and again on every change after the first attempt, and
 * keeps Save enabled so a press always says what is missing. It emits raw
 * values; the payload is built by the caller. State lives in
 * {@link usePocLabResultForm}.
 */
const PocLabResultForm = ({ creating = false, onCreate, onClose }: PocLabResultFormProps) => {
  const form = usePocLabResultForm({ creating, onCreate, onClose });
  const isCardLayout = useIsPhone(CARD_QUERY);
  return (
    <form
      noValidate
      aria-label="Record a lab result"
      className="flex flex-col gap-5 border-b border-[var(--divider)] bg-[var(--inset)] p-4"
      onSubmit={form.handleSubmit}
    >
      <TestDetailsFields {...form} />
      <ResultsFieldset {...form} isCardLayout={isCardLayout} />
      <NotesFields {...form} />
      <FormFooter {...form} creating={creating} onClose={onClose} />
    </form>
  );
};

export default PocLabResultForm;
