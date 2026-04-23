import type { Organisation } from '@yosemite-crew/types';

import { validatePhone } from '@/app/lib/validators';

type OrgBasicsErrors = {
  country?: string;
  dunsNumber?: string;
  name?: string;
  number?: string;
  taxId?: string;
  website?: string;
};

type OrgAddressErrors = {
  address?: string;
  appointmentCheckInBufferMinutes?: string;
  appointmentCheckInRadiusMeters?: string;
  city?: string;
  country?: string;
  postalCode?: string;
  state?: string;
};

type CountryDialCodeInput = {
  countryName: string;
  dialCode: string;
};

const normalizeText = (value?: string | null) => String(value ?? '').trim();
const getDigitsOnly = (value?: string | null) => String(value ?? '').replaceAll(/\D/g, '');

const normalizeWebsite = (value?: string | null) => {
  const trimmed = normalizeText(value);
  if (!trimmed) return '';

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    const parsed = new URL(candidate);
    if (!parsed.hostname?.includes('.')) {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
};

const toInteger = (value: unknown) => {
  const parsed = Number.parseInt(
    typeof value === 'string' || typeof value === 'number' ? String(value) : '',
    10
  );
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const normalizeAddress = (org: Organisation) => ({
  ...org.address,
  addressLine: normalizeText(org.address?.addressLine),
  city: normalizeText(org.address?.city),
  country: normalizeText(org.address?.country),
  postalCode: normalizeText(org.address?.postalCode),
  state: normalizeText(org.address?.state),
});

export const validateOrgBasics = ({
  formData,
  localPhoneNumber,
  selectedCountryCode,
}: {
  formData: Organisation;
  localPhoneNumber: string;
  selectedCountryCode: CountryDialCodeInput | null;
}): {
  errors: OrgBasicsErrors;
  normalizedData: Organisation;
} => {
  const errors: OrgBasicsErrors = {};
  const normalizedName = normalizeText(formData.name);
  const normalizedTaxId = normalizeText(formData.taxId);
  const normalizedDuns = getDigitsOnly(formData.DUNSNumber);
  const normalizedLocalPhoneNumber = getDigitsOnly(localPhoneNumber).slice(0, 15);
  const normalizedWebsite = normalizeWebsite(formData.website);
  const normalizedCountry = normalizeText(
    selectedCountryCode?.countryName ?? formData.address?.country
  );
  if (!normalizedName) {
    errors.name = 'Organisation name is required';
  } else if (normalizedName.length < 2) {
    errors.name = 'Organisation name must be at least 2 characters';
  } else if (normalizedName.length > 120) {
    errors.name = 'Organisation name must be 120 characters or fewer';
  }

  if (!normalizedCountry) {
    errors.country = 'Country is required';
  }

  if (
    !selectedCountryCode?.dialCode ||
    !normalizedLocalPhoneNumber ||
    !validatePhone(`${selectedCountryCode.dialCode}${normalizedLocalPhoneNumber}`)
  ) {
    errors.number = 'Enter a valid phone number';
  }

  if (!normalizedTaxId) {
    errors.taxId = 'Tax ID is required';
  } else if (normalizedTaxId.length < 2 || normalizedTaxId.length > 50) {
    errors.taxId = 'Tax ID must be between 2 and 50 characters';
  }

  if (normalizeText(formData.website) && !normalizedWebsite) {
    errors.website = 'Enter a valid website';
  }

  if (normalizedDuns && normalizedDuns.length !== 9) {
    errors.dunsNumber = 'DUNS number must be 9 digits';
  }

  return {
    errors,
    normalizedData: {
      ...formData,
      DUNSNumber: normalizedDuns,
      name: normalizedName,
      phoneNo:
        selectedCountryCode?.dialCode && normalizedLocalPhoneNumber
          ? `${selectedCountryCode.dialCode}${normalizedLocalPhoneNumber}`
          : '',
      taxId: normalizedTaxId,
      website: normalizedWebsite ?? normalizeText(formData.website),
      address: {
        ...normalizeAddress(formData),
        country: normalizedCountry,
      },
    },
  };
};

export const validateOrgAddress = (
  formData: Organisation
): {
  errors: OrgAddressErrors;
  normalizedData: Organisation;
} => {
  const errors: OrgAddressErrors = {};
  const normalizedAddress = normalizeAddress(formData);
  const appointmentCheckInBufferMinutes = toInteger(formData.appointmentCheckInBufferMinutes ?? 5);
  const appointmentCheckInRadiusMeters = toInteger(formData.appointmentCheckInRadiusMeters ?? 200);

  if (!normalizedAddress.addressLine) {
    errors.address = 'Address line is required';
  }

  if (!normalizedAddress.city) {
    errors.city = 'City is required';
  }

  if (!normalizedAddress.state) {
    errors.state = 'State or province is required';
  }

  if (!normalizedAddress.postalCode) {
    errors.postalCode = 'Postal code is required';
  } else if (normalizedAddress.postalCode.length < 3 || normalizedAddress.postalCode.length > 12) {
    errors.postalCode = 'Postal code must be between 3 and 12 characters';
  }

  if (!normalizedAddress.country) {
    errors.country = 'Country is required';
  }

  if (!Number.isInteger(appointmentCheckInBufferMinutes) || appointmentCheckInBufferMinutes < 0) {
    errors.appointmentCheckInBufferMinutes = 'Check-in buffer must be 0 or more';
  } else if (appointmentCheckInBufferMinutes > 1440) {
    errors.appointmentCheckInBufferMinutes = 'Check-in buffer must be 1440 minutes or fewer';
  }

  if (!Number.isInteger(appointmentCheckInRadiusMeters) || appointmentCheckInRadiusMeters < 1) {
    errors.appointmentCheckInRadiusMeters = 'Check-in radius must be at least 1 meter';
  } else if (appointmentCheckInRadiusMeters > 50000) {
    errors.appointmentCheckInRadiusMeters = 'Check-in radius must be 50000 meters or fewer';
  }

  return {
    errors,
    normalizedData: {
      ...formData,
      appointmentCheckInBufferMinutes: Number.isNaN(appointmentCheckInBufferMinutes)
        ? formData.appointmentCheckInBufferMinutes
        : appointmentCheckInBufferMinutes,
      appointmentCheckInRadiusMeters: Number.isNaN(appointmentCheckInRadiusMeters)
        ? formData.appointmentCheckInRadiusMeters
        : appointmentCheckInRadiusMeters,
      address: normalizedAddress,
    },
  };
};
