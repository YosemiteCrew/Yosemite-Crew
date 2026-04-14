import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import { Primary } from '@/app/ui/primitives/Buttons';
import Accordion from '@/app/ui/primitives/Accordion/Accordion';
import Datepicker from '@/app/ui/inputs/Datepicker';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import { StoredParent } from '@/app/features/companions/pages/Companions/types';
import SearchDropdown from '@/app/ui/inputs/SearchDropdown';
import { searchParent } from '@/app/features/companions/services/companionService';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import GlassTooltip from '@/app/ui/primitives/GlassTooltip/GlassTooltip';
import { IoInformationCircleOutline } from 'react-icons/io5';
import {
  CountryDialCodeOptions,
  CountryDialCodeOption,
  findPhoneData,
  getDigitsOnly,
} from '@/app/features/companions/components/AddCompanion/type';
import { getEmailValidationError, normalizeEmail, validatePhone } from '@/app/lib/validators';

type OptionProp = {
  label: string;
  value: string;
};

type ParentProps = {
  setActiveLabel: React.Dispatch<React.SetStateAction<string>>;
  formData: StoredParent;
  setFormData: React.Dispatch<React.SetStateAction<StoredParent>>;
};

export interface ParentSectionRef {
  validateStep: () => boolean;
}

const MAX_LOCAL_PHONE_LENGTH = 15;

const Parent = forwardRef<ParentSectionRef, ParentProps>(
  ({ setActiveLabel, formData, setFormData }, ref) => {
    const initialPhoneData = findPhoneData(formData.phoneNumber || '', formData.address.country);
    const [formDataErrors, setFormDataErrors] = useState<{
      firstName?: string;
      lastName?: string;
      email?: string;
      phoneNumber?: string;
      dateOfBirth?: string;
      countryCode?: string;
      addressLine?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    }>({});
    const [currentDate, setCurrentDate] = useState<Date | null>(
      formData.birthDate ? new Date(formData.birthDate) : null
    );
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<StoredParent[]>([]);
    const [selectedCountryCode, setSelectedCountryCode] = useState<CountryDialCodeOption>(
      initialPhoneData.selectedCode
    );
    const [localPhoneNumber, setLocalPhoneNumber] = useState(initialPhoneData.localNumber);

    const dialCodeByOptionValue = useMemo(() => {
      return new Map(CountryDialCodeOptions.map((option) => [option.value, option]));
    }, []);

    const options: OptionProp[] = useMemo(
      () =>
        results.map((p) => {
          const lastName = p.lastName ? ` ${p.lastName}` : '';
          return {
            value: p.id,
            label: `${p.firstName}${lastName}`,
          };
        }),
      [results]
    );

    useEffect(() => {
      const q = query.trim();
      if (!q) {
        setResults([]);
        return;
      }
      const t = globalThis.setTimeout(async () => {
        try {
          const parents = await searchParent(q);
          setResults(parents);
        } catch (e) {
          console.error(e);
          setResults([]);
        }
      }, 300);
      return () => globalThis.clearTimeout(t);
    }, [query]);

    useEffect(() => {
      setFormData((prev) => ({
        ...prev,
        birthDate: currentDate ?? undefined,
      }));
    }, [currentDate, setFormData]);

    const validateStep = () => {
      const errors: {
        firstName?: string;
        lastName?: string;
        email?: string;
        phoneNumber?: string;
        dateOfBirth?: string;
        countryCode?: string;
        addressLine?: string;
        city?: string;
        state?: string;
        postalCode?: string;
      } = {};
      if (!formData.firstName) errors.firstName = 'First name is required';
      if (!formData.lastName) errors.lastName = 'Last name is required';
      const emailError = getEmailValidationError(formData.email);
      if (emailError) errors.email = emailError;
      if (!selectedCountryCode?.dialCode) errors.countryCode = 'Country code is required';
      if (!localPhoneNumber) errors.phoneNumber = 'Number is required';
      if (!formData.address.addressLine?.trim()) errors.addressLine = 'Address is required';
      if (!formData.address.city?.trim()) errors.city = 'City is required';
      if (!formData.address.state?.trim()) errors.state = 'State/Province is required';
      if (!formData.address.postalCode?.trim()) errors.postalCode = 'Postal code is required';
      if (selectedCountryCode?.dialCode && localPhoneNumber) {
        const fullPhoneNumber = `${selectedCountryCode.dialCode}${localPhoneNumber}`;
        if (!validatePhone(fullPhoneNumber)) {
          errors.phoneNumber = 'Enter a valid phone number';
        }
      }

      setFormDataErrors(errors);
      if (Object.keys(errors).length > 0) {
        return false;
      }
      return true;
    };

    useImperativeHandle(ref, () => ({
      validateStep,
    }));

    const handleNext = () => {
      const isValid = validateStep();
      if (!isValid) {
        return;
      }
      setFormDataErrors({});
      setFormData((prev) => ({ ...prev, email: normalizeEmail(prev.email) }));
      setActiveLabel('companion');
    };

    const handlePhoneChange = (value: string) => {
      const sanitized = getDigitsOnly(value).slice(0, MAX_LOCAL_PHONE_LENGTH);
      setLocalPhoneNumber(sanitized);
      setFormData({
        ...formData,
        phoneNumber: sanitized ? `${selectedCountryCode.dialCode}${sanitized}` : '',
      });
    };

    const handleCountryCodeSelect = (value: string) => {
      const selectedCode = dialCodeByOptionValue.get(value);
      if (!selectedCode) {
        return;
      }
      setSelectedCountryCode(selectedCode);
      setFormData({
        ...formData,
        phoneNumber: localPhoneNumber ? `${selectedCode.dialCode}${localPhoneNumber}` : '',
      });
    };

    const handleSelect = (parentId: string) => {
      const selected = results.find((p) => p.id === parentId);
      if (!selected) return;
      setFormData(selected);
      const selectedParentPhoneData = findPhoneData(
        selected.phoneNumber || '',
        selected.address.country
      );
      setSelectedCountryCode(selectedParentPhoneData.selectedCode);
      setLocalPhoneNumber(selectedParentPhoneData.localNumber);
      setCurrentDate(new Date(selected.birthDate || '2025-10-23'));
      const lastName = selected.lastName ? ` ${selected.lastName}` : '';
      setQuery(`${selected.firstName}${lastName}`);
    };

    const updateAddressField = (
      field: 'addressLine' | 'city' | 'state' | 'postalCode',
      value: string
    ) => {
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, [field]: value },
      }));
      setFormDataErrors((prev) => ({ ...prev, [field]: undefined }));
    };

    const handleAddressSelect = (address: {
      addressLine: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      latitude?: number;
      longitude?: number;
    }) => {
      setFormData((prev) => ({
        ...prev,
        address: {
          ...prev.address,
          ...address,
          country: address.country || prev.address.country,
        },
      }));
      setFormDataErrors((prev) => ({
        ...prev,
        addressLine: undefined,
        city: undefined,
        state: undefined,
        postalCode: undefined,
      }));
    };

    return (
      <div className="flex flex-col gap-6 w-full flex-1 justify-between">
        <div className="flex flex-col gap-6">
          <SearchDropdown
            placeholder="Search parent"
            options={options}
            onSelect={handleSelect}
            query={query}
            setQuery={setQuery}
          />

          <Accordion title="Parents details" defaultOpen showEditIcon={false} isEditing={true}>
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  intype="text"
                  inname="name"
                  value={formData.firstName}
                  inlabel="Parent's name"
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  error={formDataErrors.firstName}
                  className="min-h-12!"
                />
                <FormInput
                  intype="text"
                  inname="name"
                  value={formData.lastName || ''}
                  inlabel="Last name"
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  error={formDataErrors.lastName}
                  className="min-h-12!"
                />
              </div>
              <FormInput
                intype="email"
                inname="email"
                value={formData.email}
                inlabel="Email"
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setFormDataErrors((prev) => ({ ...prev, email: undefined }));
                }}
                error={formDataErrors.email}
                className="min-h-12!"
              />
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-5">
                  <LabelDropdown
                    placeholder="Country code"
                    onSelect={(option) => handleCountryCodeSelect(option.value)}
                    defaultOption={selectedCountryCode.value}
                    options={CountryDialCodeOptions}
                    error={formDataErrors.countryCode}
                  />
                </div>
                <div className="col-span-7">
                  <FormInput
                    intype="tel"
                    inname="number"
                    value={localPhoneNumber || ''}
                    inlabel="Phone number"
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    error={formDataErrors.phoneNumber}
                    className="min-h-12!"
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Datepicker
                  currentDate={currentDate}
                  setCurrentDate={setCurrentDate}
                  type="input"
                  className="min-h-12!"
                  containerClassName="w-full"
                  placeholder="Date of birth"
                  error={formDataErrors.dateOfBirth}
                />
                <GlassTooltip
                  content="Date of birth may be required in some countries for age verification and legal consent. Please ensure the parent is 18 years or older where regulations require it."
                  side="bottom"
                  maxWidth={460}
                >
                  <button
                    type="button"
                    aria-label="Date of birth information"
                    className="mt-3 inline-flex h-5 w-5 shrink-0 items-center justify-center leading-none text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <IoInformationCircleOutline size={18} />
                  </button>
                </GlassTooltip>
              </div>
              <GoogleSearchDropDown
                intype="text"
                inname="address line"
                value={formData.address.addressLine || ''}
                inlabel="Address"
                onChange={(e) => updateAddressField('addressLine', e.target.value)}
                error={formDataErrors.addressLine}
                onAddressSelect={handleAddressSelect}
                onlyAddress={true}
              />
              <div className="grid grid-cols-2 gap-3">
                <FormInput
                  intype="text"
                  inname="city"
                  value={formData.address.city || ''}
                  inlabel="City"
                  onChange={(e) => updateAddressField('city', e.target.value)}
                  error={formDataErrors.city}
                  className="min-h-12!"
                />
                <FormInput
                  intype="text"
                  inname="state"
                  value={formData.address.state || ''}
                  inlabel="State/Province"
                  onChange={(e) => updateAddressField('state', e.target.value)}
                  error={formDataErrors.state}
                  className="min-h-12!"
                />
              </div>
              <FormInput
                intype="text"
                inname="postal code"
                value={formData.address.postalCode || ''}
                inlabel="Postal code"
                onChange={(e) => updateAddressField('postalCode', e.target.value)}
                error={formDataErrors.postalCode}
                className="min-h-12!"
              />
            </div>
          </Accordion>
        </div>

        <div className="flex justify-center items-center gap-3 w-full flex-row">
          <Primary href="#" text="Next" onClick={handleNext} />
        </div>
      </div>
    );
  }
);

Parent.displayName = 'Parent';

export default Parent;
