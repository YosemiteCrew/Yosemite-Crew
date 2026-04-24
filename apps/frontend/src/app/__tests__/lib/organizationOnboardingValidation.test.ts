import { validateOrgAddress, validateOrgBasics } from '@/app/lib/organizationOnboardingValidation';
import type { Organisation } from '@yosemite-crew/types';

jest.mock('@/app/lib/validators', () => ({
  validatePhone: jest.fn(() => true),
}));

describe('organizationOnboardingValidation', () => {
  const baseOrg: Organisation = {
    name: 'Test Vet',
    taxId: ' TAX-1 ',
    website: 'example.com',
    DUNSNumber: '123-456-789',
    appointmentCheckInBufferMinutes: 5,
    appointmentCheckInRadiusMeters: 200,
    address: {
      addressLine: '123 Main St',
      city: 'Austin',
      state: 'TX',
      postalCode: '73301',
      country: 'United States',
    },
  } as Organisation;

  it('normalizes valid org basics', () => {
    const { errors, normalizedData } = validateOrgBasics({
      formData: baseOrg,
      localPhoneNumber: '1234567890',
      selectedCountryCode: {
        countryName: 'United States',
        dialCode: '+1',
      },
    });

    expect(errors).toEqual({});
    expect(normalizedData.taxId).toBe('TAX-1');
    expect(normalizedData.DUNSNumber).toBe('123456789');
    expect(normalizedData.website).toBe('https://example.com/');
    expect(normalizedData.phoneNo).toBe('+11234567890');
  });

  it('returns field errors for invalid org basics', () => {
    const { errors } = validateOrgBasics({
      formData: { ...baseOrg, name: '', taxId: '', website: 'bad-url' },
      localPhoneNumber: '',
      selectedCountryCode: null,
    });

    expect(errors.name).toBe('Organisation name is required');
    expect(errors.number).toBe('Enter a valid phone number');
    expect(errors.taxId).toBe('Tax ID is required');
    expect(errors.website).toBe('Enter a valid website');
  });

  it('validates address and check-in settings together', () => {
    const { errors } = validateOrgAddress({
      ...baseOrg,
      appointmentCheckInBufferMinutes: -1,
      appointmentCheckInRadiusMeters: 0,
      address: {
        addressLine: '',
        city: '',
        state: '',
        postalCode: '',
        country: '',
      },
    } as Organisation);

    expect(errors.address).toBe('Address line is required');
    expect(errors.city).toBe('City is required');
    expect(errors.state).toBe('State or province is required');
    expect(errors.postalCode).toBe('Postal code is required');
    expect(errors.country).toBe('Country is required');
    expect(errors.appointmentCheckInBufferMinutes).toBe('Check-in buffer must be 0 or more');
    expect(errors.appointmentCheckInRadiusMeters).toBe('Check-in radius must be at least 1 meter');
  });
});
