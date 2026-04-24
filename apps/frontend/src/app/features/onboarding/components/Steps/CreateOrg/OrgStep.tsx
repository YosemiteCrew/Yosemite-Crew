import React, { useEffect, useState } from 'react';
import classNames from 'classnames';

import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import LogoUploader from '@/app/ui/widgets/UploadImage/LogoUploader';
import { BusinessTypes } from '@/app/features/organization/types/org';
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
  getCompanionTerminologyOptions,
  getCompanionTerminologyForOrg,
  setPendingCompanionTerminology,
} from '@/app/lib/companionTerminology';
import { validateOrgBasics } from '@/app/lib/organizationOnboardingValidation';

type OrgStepProps = {
  errors?: {
    name?: string;
    country?: string;
    dunsNumber?: string;
    number?: string;
    taxId?: string;
    website?: string;
  };
  nextStep: () => void;
  formData: Organisation;
  setFormData: React.Dispatch<React.SetStateAction<Organisation>>;
};

const OrgStep = ({ errors, nextStep, formData, setFormData }: OrgStepProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    name?: string;
    country?: string;
    dunsNumber?: string;
    number?: string;
    taxId?: string;
    website?: string;
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

  useEffect(() => {
    if (!errors) {
      return;
    }
    setFormDataErrors(errors);
  }, [errors]);

  const handleNext = () => {
    const { errors, normalizedData } = validateOrgBasics({
      formData,
      localPhoneNumber,
      selectedCountryCode,
    });
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    setFormData(normalizedData);
    setPendingCompanionTerminology(companionTerminology);
    nextStep();
  };

  const handlePhoneChange = (value: string) => {
    const sanitized = getDigitsOnly(value).slice(0, 15);
    setLocalPhoneNumber(sanitized);
    setFormDataErrors((prev) => ({ ...prev, number: undefined }));
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
    setFormDataErrors((prev) => ({ ...prev, country: undefined, number: undefined }));
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
          <div className="step-three-input">
            <GoogleSearchDropDown
              intype="text"
              inname="name"
              value={formData.name}
              inlabel="Organisation name"
              onChange={(e: any) => {
                setFormData({ ...formData, name: e.target.value });
                setFormDataErrors((prev) => ({ ...prev, name: undefined }));
              }}
              error={formDataErrors.name}
              setFormData={setFormData}
            />
            <FormInput
              intype="text"
              inname="website"
              value={formData.website || ''}
              inlabel="Website"
              onChange={(e) => {
                setFormData({ ...formData, website: e.target.value });
                setFormDataErrors((prev) => ({ ...prev, website: undefined }));
              }}
              error={formDataErrors.website}
            />
            <FormInput
              intype="text"
              inname="tax id"
              value={formData.taxId || ''}
              inlabel="Tax ID"
              onChange={(e) => {
                setFormData({ ...formData, taxId: e.target.value });
                setFormDataErrors((prev) => ({ ...prev, taxId: undefined }));
              }}
              error={formDataErrors.taxId}
            />
          </div>
          <div className="step-three-input">
            <div className="step-phone-input__code">
              <LabelDropdown
                placeholder="Country code"
                onSelect={(option) => handleCountryCodeSelect(option.value)}
                defaultOption={selectedCountryCode.value}
                options={CountryDialCodeOptions}
                error={formDataErrors.country}
              />
            </div>
            <FormInput
              intype="tel"
              inname="number"
              value={localPhoneNumber}
              inlabel="Phone number"
              onChange={(e) => handlePhoneChange(e.target.value)}
              error={formDataErrors.number}
            />
            <FormInput
              intype="text"
              inname="duns"
              value={formData.DUNSNumber || ''}
              inlabel="DUNS number (optional)"
              onChange={(e) => {
                setFormData({ ...formData, DUNSNumber: e.target.value });
                setFormDataErrors((prev) => ({ ...prev, dunsNumber: undefined }));
              }}
              error={formDataErrors.dunsNumber}
            />
          </div>
          <div className="step-single-input" data-terminology-lock="true">
            <LabelDropdown
              placeholder="What would you like to call pets?"
              onSelect={(option) =>
                setCompanionTerminology(option.value as CompanionTerminologyOption)
              }
              defaultOption={companionTerminology}
              options={getCompanionTerminologyOptions()}
            />
          </div>
        </div>
      </div>

      <div className="step-buttons">
        <Secondary href="/organizations" text="Back" style={{ width: '160px' }} />
        <Primary href="#" text="Next" style={{ width: '160px' }} onClick={handleNext} />
      </div>
    </div>
  );
};

export default OrgStep;
