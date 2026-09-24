'use client';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type React from 'react';
import {
  MAX_PARAMETERS,
  emptyPocLabForm,
  hasErrors,
  newRow,
  validatePocLabForm,
  type PocLabFormErrors,
  type PocLabFormValues,
  type PocLabRowValues,
} from '@/app/features/companionHistory/components/pocLabForm';

const ROW_FIELDS = ['name', 'value', 'low', 'high'] as const;

const fieldIds = (baseId: string) => ({
  testType: `${baseId}-test-type`,
  performedAt: `${baseId}-performed-at`,
  sampleType: `${baseId}-sample-type`,
  analyzer: `${baseId}-analyzer`,
  interpretation: `${baseId}-interpretation`,
  notes: `${baseId}-notes`,
  followUp: `${baseId}-follow-up`,
  row: (rowId: string, column: string) => `${baseId}-${rowId}-${column}`,
});

export type PocLabFieldIds = ReturnType<typeof fieldIds>;

/** Test type, then Performed at, then the first bad cell in row order. */
const firstInvalidControl = (
  ids: PocLabFieldIds,
  rows: PocLabRowValues[],
  found: PocLabFormErrors
): HTMLElement | null | undefined => {
  if (found.testType) return document.getElementById(ids.testType)?.querySelector('button');
  if (found.performedAt) return document.getElementById(ids.performedAt);
  for (const row of rows) {
    const column = ROW_FIELDS.find((key) => found.rows[row.id]?.[key]);
    if (column) return document.getElementById(ids.row(row.id, column));
  }
  return null;
};

/** Values and their errors. Nothing is shown until Save; after that every change re-validates. */
const useValidatedValues = () => {
  const [values, setValues] = useState<PocLabFormValues>(() => emptyPocLabForm(new Date()));
  const [errors, setErrors] = useState<PocLabFormErrors | null>(null);
  const patch = (partial: Partial<PocLabFormValues>) => {
    const next = { ...values, ...partial };
    setValues(next);
    if (errors) setErrors(validatePocLabForm(next, new Date()));
  };
  const validate = () => {
    const found = validatePocLabForm(values, new Date());
    setErrors(found);
    return found;
  };
  return { values, errors, patch, validate };
};

/** Row edits. A row added here takes focus on its name once it has rendered. */
const useParameterRows = (
  rows: PocLabRowValues[],
  patch: (partial: Partial<PocLabFormValues>) => void,
  ids: PocLabFieldIds
) => {
  const focusRowId = useRef<string | null>(null);
  useEffect(() => {
    const rowId = focusRowId.current;
    if (!rowId) return;
    focusRowId.current = null;
    document.getElementById(ids.row(rowId, 'name'))?.focus();
  }, [rows, ids]);

  const canAddRow = rows.length < MAX_PARAMETERS;
  const addRow = () => {
    if (!canAddRow) return;
    const row = newRow();
    focusRowId.current = row.id;
    patch({ rows: [...rows, row] });
  };
  const patchRow = (rowId: string, partial: Partial<PocLabRowValues>) =>
    patch({ rows: rows.map((row) => (row.id === rowId ? { ...row, ...partial } : row)) });
  const removeRow = (rowId: string) => patch({ rows: rows.filter((row) => row.id !== rowId) });
  return { canAddRow, addRow, patchRow, removeRow };
};

export type UsePocLabResultFormOptions = {
  creating: boolean;
  onCreate?: (values: PocLabFormValues) => Promise<boolean> | boolean;
  onClose: () => void;
};

/**
 * State for {@link PocLabResultForm}: values, errors, row edits and submit. A
 * failed check focuses the first problem; a save that resolves true closes the
 * form. It emits raw values; the payload is built by the caller.
 */
export const usePocLabResultForm = ({
  creating,
  onCreate,
  onClose,
}: UsePocLabResultFormOptions) => {
  const baseId = useId();
  const ids = useMemo(() => fieldIds(baseId), [baseId]);
  const { values, errors, patch, validate } = useValidatedValues();
  const rows = useParameterRows(values.rows, patch, ids);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (creating) return;
    const found = validate();
    if (hasErrors(found)) {
      firstInvalidControl(ids, values.rows, found)?.focus();
      return;
    }
    const saved = await onCreate?.(values);
    if (saved) onClose();
  };

  return { ids, values, errors, patch, ...rows, handleSubmit };
};

export type PocLabResultFormState = ReturnType<typeof usePocLabResultForm>;
