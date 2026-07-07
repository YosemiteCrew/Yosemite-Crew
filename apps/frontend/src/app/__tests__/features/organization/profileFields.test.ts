import {
  field,
  BasicFields,
  AddressFields,
  CheckInFields,
} from '@/app/features/organization/pages/Organization/Sections/profileFields';

describe('profileFields', () => {
  describe('field', () => {
    it('applies defaults for type/editable/required when omitted', () => {
      const result = field('Label', 'key');
      expect(result).toEqual({
        label: 'Label',
        key: 'key',
        type: 'text',
        editable: true,
        required: true,
        options: undefined,
      });
    });

    it('honors explicit type/editable/required/options', () => {
      const options = [{ label: 'A', value: 'a' }];
      const result = field('Label', 'key', 'select', false, false, options);
      expect(result).toEqual({
        label: 'Label',
        key: 'key',
        type: 'select',
        editable: false,
        required: false,
        options,
      });
    });
  });

  describe('BasicFields', () => {
    it('includes the organization type field with business options', () => {
      const typeField = BasicFields.find((f) => f.key === 'type');
      expect(typeField?.type).toBe('select');
      expect(typeField?.editable).toBe(false);
      expect(typeField?.options).toEqual([
        { label: 'Hospital', value: 'HOSPITAL' },
        { label: 'Breeder', value: 'BREEDER' },
        { label: 'Boarder', value: 'BOARDER' },
        { label: 'Groomer', value: 'GROOMER' },
      ]);
    });

    it('marks DUNS number as optional', () => {
      const dunsField = BasicFields.find((f) => f.key === 'DUNSNumber');
      expect(dunsField?.required).toBe(false);
    });

    it('has exactly 6 fields', () => {
      expect(BasicFields).toHaveLength(6);
    });
  });

  describe('AddressFields', () => {
    it('has the address line as googleAddress type', () => {
      const addressLine = AddressFields.find((f) => f.key === 'addressLine');
      expect(addressLine?.type).toBe('googleAddress');
    });

    it('has exactly 4 fields', () => {
      expect(AddressFields).toHaveLength(4);
    });
  });

  describe('CheckInFields', () => {
    it('has number-type fields', () => {
      expect(CheckInFields).toHaveLength(2);
      CheckInFields.forEach((f) => expect(f.type).toBe('number'));
    });
  });
});
