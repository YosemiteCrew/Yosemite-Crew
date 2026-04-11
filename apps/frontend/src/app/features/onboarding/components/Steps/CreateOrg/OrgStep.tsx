import React, { useEffect, useState } from 'react';
import classNames from 'classnames';
import { useRouter } from 'next/navigation';

import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import LogoUploader from '@/app/ui/widgets/UploadImage/LogoUploader';
import { BusinessTypes } from '@/app/features/organization/types/org';
import { validatePhone } from '@/app/lib/validators';
import { createOrg } from '@/app/features/organization/services/orgService';
import { Organisation } from '@yosemite-crew/types';

import './Step.css';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import {
  CountryDialCodeOption,
  CountryDialCodeOptions,
  findPhoneData,
  getDigitsOnly,
} from '@/app/features/companions/components/AddCompanion/type';
import {
  CompanionTerminologyOption,
  bindPendingCompanionTerminologyToOrg,
  getCompanionTerminologyOptions,
  getCompanionTerminologyForOrg,
  setPendingCompanionTerminology,
} from '@/app/lib/companionTerminology';

type OrgStepProps = {
  nextStep: () => void;
  formData: Organisation;
  setFormData: React.Dispatch<React.SetStateAction<Organisation>>;
};

const OrgStep = ({ nextStep, formData, setFormData }: OrgStepProps) => {
  const router = useRouter();
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    country?: string;
    number?: string;
    taxId?: string;
  }>({});
  const [companionTerminology, setCompanionTerminology] = useState<CompanionTerminologyOption>(
    getCompanionTerminologyForOrg(undefined, formData.type)
  );
  const initialPhoneData = findPhoneData(formData.phoneNo || '', formData.address?.country);
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryDialCodeOption>(
    initialPhoneData.selectedCode
  );
  const [localPhoneNumber, setLocalPhoneNumber] = useState(initialPhoneData.localNumber);

  useEffect(() => {
    setCompanionTerminology(getCompanionTerminologyForOrg(undefined, formData.type));
  }, [formData.type]);

  const handleNext = async () => {
    const errors: {
      name?: string;
      country?: string;
      number?: string;
      taxId?: string;
    } = {};
    if (!formData.name) errors.name = 'Name is required';
    if (!formData.address?.country) errors.country = 'Country is required';
    if (!selectedCountryCode?.dialCode) errors.number = 'Country code is required';
    if (!localPhoneNumber) errors.number = 'Number is required';
    if (!formData.taxId) errors.taxId = 'TaxID is required';
    if (!selectedCountryCode?.dialCode || !localPhoneNumber) {
      errors.number = 'Valid number is required';
    } else {
      const fullMobile = `${selectedCountryCode.dialCode}${localPhoneNumber}`;
      if (!validatePhone(fullMobile)) {
        errors.number = 'Valid number is required';
      }
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      setPendingCompanionTerminology(companionTerminology);
      const orgId = await createOrg(formData);
      bindPendingCompanionTerminologyToOrg(orgId);
      router.replace(`/create-org?orgId=${orgId}`);
      nextStep();
    } catch (error: any) {
      console.error('Error creating organization:', error);
    }
  };

  const handlePhoneChange = (value: string) => {
    const sanitized = getDigitsOnly(value).slice(0, 15);
    setLocalPhoneNumber(sanitized);
    setFormData((prev) => ({
      ...prev,
      phoneNo: sanitized ? `${selectedCountryCode.dialCode}${sanitized}` : '',
    }));
  };

  const handleCountryCodeSelect = (value: string) => {
    const selected = CountryDialCodeOptions.find((option) => option.value === value);
    if (!selected) {
      return;
    }
    setSelectedCountryCode(selected);
    setFormData((prev) => ({
      ...prev,
      phoneNo: localPhoneNumber ? `${selected.dialCode}${localPhoneNumber}` : '',
      address: {
        ...prev.address,
        country: selected.countryName,
      },
    }));
  };

  return (
    <div className="step-container">
      <div className="flex flex-col gap-6">
        <LogoUploader
          title="Add logo (optional)"
          apiUrl="/fhir/v1/organization/logo/presigned-url"
          setImageUrl={(url) => {
            setFormData((prev) => ({ ...prev, imageURL: url }));
          }}
        />

        <div className="step-type">
          <div className="step-type-title">Select your organisation type</div>
          <div className="step-type-options">
            {BusinessTypes.map((type) => (
              <button
                key={type}
                className={classNames('step-type-option', {
                  activetype: formData.type === type,
                })}
                onClick={() => setFormData({ ...formData, type: type })}
              >
                {type.charAt(0) + type.toLowerCase().slice(1)}
              </button>
            ))}
          </div>
          <div className="step-type-desc">
            <span className="step-type-desc-span">Note: </span>This is also tailored for small vet
            practices and clinics
          </div>
        </div>

        <div className="step-inputs">
          <div className="step-two-input">
            <GoogleSearchDropDown
              intype="text"
              inname="name"
              value={formData.name}
              inlabel="Organisation name"
              onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
              error={formDataErrors.name}
              setFormData={setFormData}
            />
            <FormInput
              intype="text"
              inname="website"
              value={formData.website || ''}
              inlabel="Website"
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-5">
              <LabelDropdown
                placeholder="Country code"
                onSelect={(option) => handleCountryCodeSelect(option.value)}
                defaultOption={selectedCountryCode.value}
                options={CountryDialCodeOptions}
                error={formDataErrors.country}
              />
            </div>
            <div className="col-span-7">
              <FormInput
                intype="tel"
                inname="number"
                value={localPhoneNumber}
                inlabel="Phone number"
                onChange={(e) => handlePhoneChange(e.target.value)}
                error={formDataErrors.number}
              />
            </div>
          </div>

          <div className="step-two-input">
            <div data-terminology-lock="true">
              <LabelDropdown
                placeholder="What would you like to call pets?"
                onSelect={(option) =>
                  setCompanionTerminology(option.value as CompanionTerminologyOption)
                }
                defaultOption={companionTerminology}
                options={getCompanionTerminologyOptions()}
              />
            </div>
            <FormInput
              intype="text"
              inname="duns"
              value={formData.DUNSNumber || ''}
              inlabel="DUNS number (optional)"
              onChange={(e) => setFormData({ ...formData, DUNSNumber: e.target.value })}
            />
            <FormInput
              intype="text"
              inname="tax id"
              value={formData.taxId || ''}
              inlabel="Tax ID"
              onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
              error={formDataErrors.taxId}
            />
          </div>
          <div className="step-two-input">
            <FormInput
              intype="number"
              inname="appointment-checkin-buffer-minutes"
              value={String(formData.appointmentCheckInBufferMinutes ?? 5)}
              inlabel="Check-in opens (minutes before appointment)"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  appointmentCheckInBufferMinutes: Number(e.target.value || 0),
                })
              }
            />
            <FormInput
              intype="number"
              inname="appointment-checkin-radius-meters"
              value={String(formData.appointmentCheckInRadiusMeters ?? 200)}
              inlabel="Check-in radius (meters)"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  appointmentCheckInRadiusMeters: Number(e.target.value || 0),
                })
              }
            />
          </div>
        </div>
      </div>

      <div className="step-buttons">
        <Secondary href="/organizations" text="Back" />
        <Primary href="#" text="Next" onClick={handleNext} />
      </div>
    </div>
  );
};

export default OrgStep;
