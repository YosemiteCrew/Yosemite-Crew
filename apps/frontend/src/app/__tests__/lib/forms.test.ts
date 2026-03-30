import {
  statusToLabel,
  labelToStatus,
  hasSignatureField,
  removeSignatureFields,
  ensureSingleSignatureAtEnd,
} from '@/app/lib/forms';
import type { FormField } from '@/app/features/forms/types/forms';

// We only test pure logic functions that don't depend on timezone/date formatting

describe('statusToLabel', () => {
  it('maps "draft" to "Draft"', () => {
    expect(statusToLabel('draft')).toBe('Draft');
  });

  it('maps "published" to "Published"', () => {
    expect(statusToLabel('published')).toBe('Published');
  });

  it('maps "archived" to "Archived"', () => {
    expect(statusToLabel('archived')).toBe('Archived');
  });

  it('defaults to "Draft" for undefined', () => {
    expect(statusToLabel(undefined)).toBe('Draft');
  });
});

describe('labelToStatus', () => {
  it('maps "Draft" to "draft"', () => {
    expect(labelToStatus('Draft')).toBe('draft');
  });

  it('maps "Published" to "published"', () => {
    expect(labelToStatus('Published')).toBe('published');
  });

  it('maps "Archived" to "archived"', () => {
    expect(labelToStatus('Archived')).toBe('archived');
  });

  it('defaults to "draft" for undefined', () => {
    expect(labelToStatus(undefined)).toBe('draft');
  });
});

describe('hasSignatureField', () => {
  it('returns false for empty array', () => {
    expect(hasSignatureField([])).toBe(false);
  });

  it('returns false when no signature fields', () => {
    const fields = [{ id: '1', type: 'text', label: 'Name' }] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(false);
  });

  it('returns true when a top-level signature field exists', () => {
    const fields = [{ id: 'sig', type: 'signature', label: 'Signature' }] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(true);
  });

  it('returns true when a nested group contains a signature field', () => {
    const fields = [
      {
        id: 'grp',
        type: 'group',
        label: 'Group',
        fields: [{ id: 'sig', type: 'signature', label: 'Sign' }],
      },
    ] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(true);
  });

  it('returns false for nested group with no signature', () => {
    const fields = [
      {
        id: 'grp',
        type: 'group',
        label: 'Group',
        fields: [{ id: 'txt', type: 'text', label: 'Text' }],
      },
    ] as unknown as FormField[];
    expect(hasSignatureField(fields)).toBe(false);
  });
});

describe('removeSignatureFields', () => {
  it('returns empty array for empty input', () => {
    expect(removeSignatureFields([])).toEqual([]);
  });

  it('removes top-level signature fields', () => {
    const fields = [
      { id: '1', type: 'text', label: 'Name' },
      { id: '2', type: 'signature', label: 'Sig' },
    ] as unknown as FormField[];
    const result = removeSignatureFields(fields);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('removes nested signature fields from groups', () => {
    const fields = [
      {
        id: 'grp',
        type: 'group',
        label: 'Group',
        fields: [
          { id: 'txt', type: 'text', label: 'Text' },
          { id: 'sig', type: 'signature', label: 'Sign' },
        ],
      },
    ] as unknown as FormField[];
    const result = removeSignatureFields(fields);
    expect(result).toHaveLength(1);
    expect((result[0] as any).fields).toHaveLength(1);
    expect((result[0] as any).fields[0].type).toBe('text');
  });

  it('keeps non-signature, non-group fields unchanged', () => {
    const fields = [
      { id: '1', type: 'text', label: 'Name' },
      { id: '2', type: 'checkbox', label: 'Agree' },
    ] as unknown as FormField[];
    expect(removeSignatureFields(fields)).toHaveLength(2);
  });
});

describe('ensureSingleSignatureAtEnd', () => {
  it('appends a signature field to the end', () => {
    const fields = [{ id: '1', type: 'text', label: 'Name' }] as unknown as FormField[];
    const result = ensureSingleSignatureAtEnd(fields);
    expect(result).toHaveLength(2);
    expect(result[result.length - 1].type).toBe('signature');
  });

  it('removes existing signatures and adds one at end', () => {
    const fields = [
      { id: 'sig1', type: 'signature', label: 'Old Sig' },
      { id: '1', type: 'text', label: 'Name' },
    ] as unknown as FormField[];
    const result = ensureSingleSignatureAtEnd(fields);
    const signatures = result.filter((f) => f.type === 'signature');
    expect(signatures).toHaveLength(1);
    expect(result[result.length - 1].type).toBe('signature');
  });

  it('uses custom label for the signature field', () => {
    const fields = [{ id: '1', type: 'text', label: 'Name' }] as unknown as FormField[];
    const result = ensureSingleSignatureAtEnd(fields, 'Owner Signature');
    expect(result[result.length - 1].label).toBe('Owner Signature');
  });

  it('works with empty array', () => {
    const result = ensureSingleSignatureAtEnd([]);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('signature');
  });
});
