import React, { useEffect, useState } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import classNames from 'classnames';

import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import LogoUploader from '@/app/ui/widgets/UploadImage/LogoUploader';
import { GenderOptions, UserProfile } from '@/app/features/users/types/profile';
import { createUserProfile } from '@/app/features/organization/services/profileService';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { validatePhone } from '@/app/lib/validators';
import { formatDateLocal } from '@/app/lib/date';

import './Step.css';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';
import {
  CountryDialCodeOption,
  CountryDialCodeOptions,
  findPhoneData,
  getDigitsOnly,
} from '@/app/features/companions/components/AddCompanion/type';

type PersonalStepProps = {
  nextStep: () => void;
  formData: UserProfile;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  orgIdFromQuery: string | null;
};

type PersonalStepErrors = {
  dob?: string;
  number?: string;
  gender?: string;
  address?: string;
  country?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  dateOfBirth?: string;
};

const buildPersonalErrors = (
  formData: UserProfile,
  selectedCountryCode: CountryDialCodeOption,
  localPhoneNumber: string
): PersonalStepErrors => {
  const errors: PersonalStepErrors = {};
  const details = formData.personalDetails;
  const address = details?.address;

  if (!details?.dateOfBirth) {
    errors.dob = 'Date of birth is required';
    errors.dateOfBirth = 'Date of birth is required';
  }
  if (!selectedCountryCode?.dialCode) errors.number = 'Country code is required';
  if (!localPhoneNumber) errors.number = 'Number is required';
  if (!details?.gender) errors.gender = 'Gender is required';
  if (!address?.country) errors.country = 'Country is required';
  if (!address?.addressLine) errors.address = 'Address is required';
  if (!address?.city) errors.city = 'City is required';
  if (!address?.state) errors.state = 'State is required';
  if (!address?.postalCode) errors.postalCode = 'PostalCode is required';

  if (!selectedCountryCode?.dialCode || !localPhoneNumber) {
    errors.number = 'Valid number is required';
  } else {
    const fullMobile = `${selectedCountryCode.dialCode}${localPhoneNumber}`;
    if (!validatePhone(fullMobile)) {
      errors.number = 'Valid number is required';
    }
  }

  return errors;
};

const PersonalStep = ({ nextStep, formData, setFormData, orgIdFromQuery }: PersonalStepProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    dob?: string;
    country?: string;
    number?: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    dateOfBirth?: string;
  }>({});
  const [currentDate, setCurrentDate] = useState<Date | null>(
    formData.personalDetails?.dateOfBirth ? new Date(formData.personalDetails.dateOfBirth) : null
  );
  const initialPhoneData = findPhoneData(
    formData.personalDetails?.phoneNumber || '',
    formData.personalDetails?.address?.country
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryDialCodeOption>(
    initialPhoneData.selectedCode
  );
  const [localPhoneNumber, setLocalPhoneNumber] = useState<string>(initialPhoneData.localNumber);

  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      personalDetails: {
        ...prev.personalDetails,
        dateOfBirth: currentDate ? formatDateLocal(currentDate) : '',
      },
    }));
  }, [currentDate, setFormData]);

  const handleNext = async () => {
    const errors = buildPersonalErrors(formData, selectedCountryCode, localPhoneNumber);
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createUserProfile(formData, orgIdFromQuery);
    } catch (error: any) {
      console.error('Error creating profile:', error);
    }
  };

  const handlePhoneChange = (value: string) => {
    const sanitized = getDigitsOnly(value).slice(0, 15);
    setLocalPhoneNumber(sanitized);
    setFormData((prev) => ({
      ...prev,
      personalDetails: {
        ...prev.personalDetails,
        phoneNumber: sanitized ? `${selectedCountryCode.dialCode}${sanitized}` : '',
      },
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
      personalDetails: {
        ...prev.personalDetails,
        phoneNumber: localPhoneNumber ? `${selected.dialCode}${localPhoneNumber}` : '',
        address: {
          ...prev.personalDetails?.address,
          country: selected.countryName,
        },
      },
    }));
  };

  return (
    <div className="team-container">
      <div className="flex flex-col gap-6">
        <div className="team-title">Personal details</div>
        <LogoUploader
          title="Add profile picture (optional)"
          apiUrl={`/fhir/v1/user-profile/${orgIdFromQuery}/profile-picture`}
          setImageUrl={(url) => {
            setFormData((prev) => ({
              ...prev,
              personalDetails: {
                ...prev.personalDetails,
                profilePictureUrl: url,
              },
            }));
          }}
        />
        <div className="team-personal-container">
          <Datepicker
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            type="input"
            containerClassName="w-full"
            placeholder="Date of birth"
            error={formDataErrors.dateOfBirth}
          />

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
          <div className="team-type">
            <div className="team-type-title">Gender</div>
            <div className="team-type-options">
              {GenderOptions.map((type) => (
                <button
                  key={type}
                  className={classNames('team-type-option', {
                    activeGendertype: formData.personalDetails?.gender === type,
                  })}
                  onClick={() =>
                    setFormData({
                      ...formData,
                      personalDetails: {
                        ...formData.personalDetails,
                        gender: type,
                      },
                    })
                  }
                >
                  {type.charAt(0) + type.toLowerCase().slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="team-seperator"></div>

        <div className="team-address-container">
          <div className="team-title">Residential address</div>
          <div className="team-personal-container">
            <GoogleSearchDropDown
              intype="text"
              inname="address line"
              value={formData.personalDetails?.address?.addressLine || ''}
              inlabel="Address line 1"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  personalDetails: {
                    ...formData.personalDetails,
                    address: {
                      ...formData.personalDetails?.address,
                      addressLine: e.target.value,
                    },
                  },
                })
              }
              error={formDataErrors.address}
              setFormData={setFormData}
              onlyAddress={true}
            />
            <div className="team-personal-two">
              <FormInput
                intype="text"
                inname="city"
                value={formData.personalDetails?.address?.city || ''}
                inlabel="City"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    personalDetails: {
                      ...formData.personalDetails,
                      address: {
                        ...formData.personalDetails?.address,
                        city: e.target.value,
                      },
                    },
                  })
                }
                error={formDataErrors.city}
              />
              <FormInput
                intype="text"
                inname="state"
                value={formData.personalDetails?.address?.state || ''}
                inlabel="State/Province"
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    personalDetails: {
                      ...formData.personalDetails,
                      address: {
                        ...formData.personalDetails?.address,
                        state: e.target.value,
                      },
                    },
                  })
                }
                error={formDataErrors.state}
              />
            </div>
            <FormInput
              intype="text"
              inname="postal code"
              value={formData.personalDetails?.address?.postalCode || ''}
              inlabel="Postal code"
              onChange={(e) =>
                setFormData({
                  ...formData,
                  personalDetails: {
                    ...formData.personalDetails,
                    address: {
                      ...formData.personalDetails?.address,
                      postalCode: e.target.value,
                    },
                  },
                })
              }
              error={formDataErrors.postalCode}
            />
          </div>
        </div>
      </div>

      <div className="team-buttons">
        <Secondary href="/organizations" text="Back" />
        <Primary href="#" text="Next" onClick={handleNext} />
      </div>
    </div>
  );
};

export default PersonalStep;
