import { buildInitialValues } from '@/app/features/forms/pages/Forms/Sections/AddForm/reviewUtils';
import type { FormField } from '@/app/features/forms/types/forms';

describe('buildInitialValues', () => {
  it('defaults checkbox fields to an empty array when no default value', () => {
    const fields = [{ id: 'c1', type: 'checkbox' }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ c1: [] });
  });

  it('uses the provided default value for checkbox fields', () => {
    const fields = [{ id: 'c1', type: 'checkbox', defaultValue: ['a'] }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ c1: ['a'] });
  });

  it('defaults boolean fields to false when no default value', () => {
    const fields = [{ id: 'b1', type: 'boolean' }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ b1: false });
  });

  it('uses the provided default value for boolean fields', () => {
    const fields = [{ id: 'b1', type: 'boolean', defaultValue: true }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ b1: true });
  });

  it('defaults other field types to an empty string when no default value', () => {
    const fields = [{ id: 't1', type: 'text' }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ t1: '' });
  });

  it('uses the provided default value for other field types', () => {
    const fields = [{ id: 't1', type: 'text', defaultValue: 'hello' }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ t1: 'hello' });
  });

  it('recurses into group fields and flattens their children', () => {
    const fields = [
      {
        id: 'g1',
        type: 'group',
        fields: [
          { id: 'child1', type: 'text', defaultValue: 'x' },
          { id: 'child2', type: 'checkbox' },
        ],
      },
    ] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({ child1: 'x', child2: [] });
  });

  it('handles a group field with no nested fields', () => {
    const fields = [{ id: 'g1', type: 'group' }] as unknown as FormField[];
    expect(buildInitialValues(fields)).toEqual({});
  });

  it('returns an empty object for an empty field list', () => {
    expect(buildInitialValues([])).toEqual({});
  });
});
