import {
  findFieldLabel,
  humanizeKey,
} from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/labelUtils';
import { FormField } from '@/app/features/forms/types/forms';

describe('labelUtils', () => {
  describe('findFieldLabel', () => {
    it('returns undefined when schema is undefined', () => {
      expect(findFieldLabel(undefined, 'foo')).toBeUndefined();
    });

    it('returns undefined when schema is empty', () => {
      expect(findFieldLabel([], 'foo')).toBeUndefined();
    });

    it('finds a top-level field label by id', () => {
      const schema = [{ id: 'foo', label: 'Foo Label', type: 'text' }] as unknown as FormField[];
      expect(findFieldLabel(schema, 'foo')).toBe('Foo Label');
    });

    it('finds a nested field label inside a group', () => {
      const schema = [
        {
          id: 'group1',
          type: 'group',
          fields: [{ id: 'nested', label: 'Nested Label', type: 'text' }],
        },
      ] as unknown as FormField[];
      expect(findFieldLabel(schema, 'nested')).toBe('Nested Label');
    });

    it('falls back to name when label is missing', () => {
      const schema = [{ id: 'foo', name: 'Foo Name', type: 'text' }] as unknown as FormField[];
      expect(findFieldLabel(schema, 'foo')).toBe('Foo Name');
    });

    it('returns undefined when no field matches the id', () => {
      const schema = [{ id: 'foo', label: 'Foo Label', type: 'text' }] as unknown as FormField[];
      expect(findFieldLabel(schema, 'missing')).toBeUndefined();
    });

    it('ignores group fields whose fields property is not an array', () => {
      const schema = [{ id: 'group1', type: 'group', fields: undefined }] as unknown as FormField[];
      expect(findFieldLabel(schema, 'group1')).toBeUndefined();
    });
  });

  describe('humanizeKey', () => {
    it('replaces underscores and dashes with spaces', () => {
      expect(humanizeKey('foo_bar-baz')).toBe('Foo Bar Baz');
    });

    it('splits camelCase boundaries', () => {
      expect(humanizeKey('fooBarBaz')).toBe('Foo Bar Baz');
    });

    it('capitalizes each word', () => {
      expect(humanizeKey('hello world')).toBe('Hello World');
    });

    it('trims and collapses extra whitespace-producing separators', () => {
      expect(humanizeKey('__leading_trailing__')).toBe('Leading Trailing');
    });
  });
});
