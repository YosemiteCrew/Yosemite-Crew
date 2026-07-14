import { hasSignatureField } from '@/app/features/appointments/pages/Appointments/Sections/AppointmentInfo/Prescription/signatureUtils';
import { FormField } from '@/app/features/forms/types/forms';

describe('hasSignatureField', () => {
  it('returns false for an empty schema', () => {
    expect(hasSignatureField([])).toBe(false);
  });

  it('returns false when schema is omitted', () => {
    expect(hasSignatureField()).toBe(false);
  });

  it('returns true when a top-level signature field exists', () => {
    const schema = [{ type: 'signature' }] as unknown as FormField[];
    expect(hasSignatureField(schema)).toBe(true);
  });

  it('returns false when no field is a signature type', () => {
    const schema = [{ type: 'text' }, { type: 'number' }] as unknown as FormField[];
    expect(hasSignatureField(schema)).toBe(false);
  });

  it('returns true when a nested group field contains a signature', () => {
    const schema = [
      { type: 'group', fields: [{ type: 'text' }, { type: 'signature' }] },
    ] as unknown as FormField[];
    expect(hasSignatureField(schema)).toBe(true);
  });

  it('returns false when a group field has no signature nested', () => {
    const schema = [{ type: 'group', fields: [{ type: 'text' }] }] as unknown as FormField[];
    expect(hasSignatureField(schema)).toBe(false);
  });

  it('skips falsy field entries safely', () => {
    const schema = [null, { type: 'signature' }] as unknown as FormField[];
    expect(hasSignatureField(schema)).toBe(true);
  });

  it('returns false when a group field property is not an array', () => {
    const schema = [{ type: 'group', fields: undefined }] as unknown as FormField[];
    expect(hasSignatureField(schema)).toBe(false);
  });
});
