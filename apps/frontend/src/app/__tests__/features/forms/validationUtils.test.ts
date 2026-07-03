import { collectMissingRequiredFields } from '@/app/features/forms/pages/Forms/Sections/AddForm/validationUtils';
import type { FormField } from '@/app/features/forms/types/forms';

const field = (overrides: Partial<FormField> & { id: string }): FormField =>
  ({
    type: 'input',
    label: overrides.id,
    ...overrides,
  }) as FormField;

describe('collectMissingRequiredFields', () => {
  it('returns no missing fields when nothing is required', () => {
    const fields: FormField[] = [
      field({ id: 'a', label: 'Notes' }),
      field({ id: 'b', label: 'Weight', type: 'number' }),
    ];
    expect(collectMissingRequiredFields(fields, {})).toEqual([]);
  });

  it('flags required text fields that are empty or whitespace', () => {
    const fields: FormField[] = [
      field({ id: 'name', label: 'Patient name', required: true }),
      field({ id: 'reason', label: 'Reason', required: true }),
    ];
    const missing = collectMissingRequiredFields(fields, {
      name: '   ',
      reason: 'Vaccination',
    });
    expect(missing).toEqual(['Patient name']);
  });

  it('treats a satisfied required field as complete', () => {
    const fields: FormField[] = [field({ id: 'name', label: 'Patient name', required: true })];
    expect(collectMissingRequiredFields(fields, { name: 'Bella' })).toEqual([]);
  });

  it('requires at least one selection for required checkbox groups', () => {
    const fields: FormField[] = [
      field({
        id: 'symptoms',
        label: 'Symptoms',
        type: 'checkbox',
        required: true,
      } as Partial<FormField> & { id: string }),
    ];
    expect(collectMissingRequiredFields(fields, { symptoms: [] })).toEqual(['Symptoms']);
    expect(collectMissingRequiredFields(fields, { symptoms: ['cough'] })).toEqual([]);
  });

  it('requires a required boolean to be affirmed (true)', () => {
    const fields: FormField[] = [
      field({
        id: 'consent',
        label: 'I consent',
        type: 'boolean',
        required: true,
      }),
    ];
    expect(collectMissingRequiredFields(fields, { consent: false })).toEqual(['I consent']);
    expect(collectMissingRequiredFields(fields, { consent: true })).toEqual([]);
  });

  it('recurses into group fields', () => {
    const fields: FormField[] = [
      {
        id: 'vitals',
        type: 'group',
        label: 'Vitals',
        fields: [
          field({ id: 'temp', label: 'Temperature', required: true }),
          field({ id: 'hr', label: 'Heart rate' }),
        ],
      } as FormField,
    ];
    expect(collectMissingRequiredFields(fields, { hr: '120' })).toEqual(['Temperature']);
  });

  it('treats empty rich-text markup as unanswered for required richtext fields', () => {
    const fields: FormField[] = [
      field({ id: 'notes', label: 'Clinical notes', type: 'richtext', required: true }),
    ];
    expect(collectMissingRequiredFields(fields, { notes: '<p></p>' })).toEqual(['Clinical notes']);
    expect(collectMissingRequiredFields(fields, { notes: '<p>&nbsp;</p>' })).toEqual([
      'Clinical notes',
    ]);
    expect(collectMissingRequiredFields(fields, { notes: '<p>Seen and treated</p>' })).toEqual([]);
  });

  it('falls back to the field id when no label is set', () => {
    const fields: FormField[] = [field({ id: 'field_123', label: '', required: true })];
    expect(collectMissingRequiredFields(fields, {})).toEqual(['field_123']);
  });
});
