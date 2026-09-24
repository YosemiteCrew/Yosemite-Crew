import type React from 'react';
import { act, renderHook } from '@testing-library/react';
import { MAX_PARAMETERS } from '@/app/features/companionHistory/components/pocLabForm';
import { usePocLabResultForm } from '@/app/features/companionHistory/components/usePocLabResultForm';

const submitEvent = () => ({ preventDefault: jest.fn() }) as unknown as React.FormEvent;

const setup = ({
  creating = false,
  onCreate = jest.fn().mockResolvedValue(true),
}: { creating?: boolean; onCreate?: jest.Mock } = {}) => {
  const onClose = jest.fn();
  const hook = renderHook(() => usePocLabResultForm({ creating, onCreate, onClose }));
  return { ...hook, onCreate, onClose };
};

/** A form that passes validation: a test type and one named, valued row. */
const makeValid = (result: ReturnType<typeof setup>['result']) => {
  act(() => result.current.patch({ testType: 'CBC' }));
  const [row] = result.current.values.rows;
  act(() => result.current.patchRow(row.id, { name: 'PLT', value: '38' }));
};

describe('usePocLabResultForm', () => {
  it('starts with one blank row, no errors and room for more rows', () => {
    const { result } = setup();
    expect(result.current.values.rows).toHaveLength(1);
    expect(result.current.errors).toBeNull();
    expect(result.current.canAddRow).toBe(true);
    expect(result.current.ids.row('r1', 'name')).toMatch(/-r1-name$/);
    expect(result.current.ids.testType).not.toBe(result.current.ids.performedAt);
  });

  it('shows no errors until Save, then re-validates on every change', async () => {
    const { result, onCreate } = setup();
    act(() => result.current.patch({ testType: 'CBC' }));
    expect(result.current.errors).toBeNull();

    act(() => result.current.patch({ testType: '' }));
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(result.current.errors?.testType).toBe('Choose a test type.');
    expect(onCreate).not.toHaveBeenCalled();

    act(() => result.current.patch({ testType: 'URINALYSIS' }));
    expect(result.current.errors?.testType).toBeUndefined();
  });

  it('adds, edits and removes rows', () => {
    const { result } = setup();
    act(() => result.current.addRow());
    const [first, second] = result.current.values.rows;
    expect(second.id).not.toBe(first.id);

    act(() => result.current.patchRow(second.id, { name: 'HCT' }));
    expect(result.current.values.rows[1].name).toBe('HCT');
    expect(result.current.values.rows[0].name).toBe('');

    act(() => result.current.removeRow(first.id));
    expect(result.current.values.rows.map((row) => row.name)).toEqual(['HCT']);
  });

  it(`stops adding rows at the backend limit of ${MAX_PARAMETERS}`, () => {
    const { result } = setup();
    for (let count = 1; count < MAX_PARAMETERS - 1; count += 1) {
      act(() => result.current.addRow());
    }
    expect(result.current.values.rows).toHaveLength(MAX_PARAMETERS - 1);
    expect(result.current.canAddRow).toBe(true);

    act(() => result.current.addRow());
    expect(result.current.values.rows).toHaveLength(MAX_PARAMETERS);
    expect(result.current.canAddRow).toBe(false);

    // A stray call past the limit, e.g. a double click, adds nothing.
    act(() => result.current.addRow());
    expect(result.current.values.rows).toHaveLength(MAX_PARAMETERS);

    act(() => result.current.removeRow(result.current.values.rows[0].id));
    expect(result.current.canAddRow).toBe(true);
  });

  it('sends valid values and closes once the save resolves true', async () => {
    const { result, onCreate, onClose } = setup();
    makeValid(result);
    const event = submitEvent();
    await act(() => result.current.handleSubmit(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onCreate).toHaveBeenCalledWith(result.current.values);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when the save resolves false', async () => {
    const { result, onClose } = setup({ onCreate: jest.fn().mockResolvedValue(false) });
    makeValid(result);
    await act(() => result.current.handleSubmit(submitEvent()));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a submit while a save is in flight', async () => {
    const { result, onCreate } = setup({ creating: true });
    makeValid(result);
    const event = submitEvent();
    await act(() => result.current.handleSubmit(event));

    expect(event.preventDefault).toHaveBeenCalled();
    expect(onCreate).not.toHaveBeenCalled();
    expect(result.current.errors).toBeNull();
  });
});
