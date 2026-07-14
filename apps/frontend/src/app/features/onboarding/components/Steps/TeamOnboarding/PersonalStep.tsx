import { useImperativeHandle, useState, type Dispatch, type SetStateAction, type Ref } from 'react';
import { Primary, Secondary } from '@/app/ui/primitives/Buttons';
import classNames from 'classnames';
import { IoArrowForward } from 'react-icons/io5';

import FormInput from '@/app/ui/inputs/FormInput/FormInput';
import GoogleSearchDropDown from '@/app/ui/inputs/GoogleSearchDropDown/GoogleSearchDropDown';
import LogoUploader from '@/app/ui/widgets/UploadImage/LogoUploader';
import { GenderOptions, UserProfile } from '@/app/features/users/types/profile';
import { createUserProfile } from '@/app/features/organization/services/profileService';
import Datepicker from '@/app/ui/inputs/Datepicker';
import { validatePhone } from '@/app/lib/validators';
import { formatDateLocal } from '@/app/lib/date';
import { MEDIA_SOURCES } from '@/app/constants/mediaSources';

import './Step.css';
import LabelDropdown from '@/app/ui/inputs/Dropdown/LabelDropdown';

const CURRENT_YEAR = new Date().getFullYear();
import {
  CountryDialCodeOption,
  CountryDialCodeOptions,
  findPhoneData,
  getDigitsOnly,
} from '@/app/features/companions/components/AddCompanion/type';

export type StepHandle = {
  validate: () => boolean;
};

type PersonalStepProps = Readonly<{
  nextStep: () => void;
  formData: UserProfile;
  setFormData: Dispatch<SetStateAction<UserProfile>>;
  orgIdFromQuery: string | null;
  isSaving: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  ref?: Ref<StepHandle>;
}>;

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

const MIN_AGE = 16;

const isValidDob = (dob: string): boolean => {
  const date = new Date(dob);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const minDob = new Date(today.getFullYear() - MIN_AGE, today.getMonth(), today.getDate());
  return date <= minDob;
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
    errors.dateOfBirth = 'Date of birth is required';
  } else if (!isValidDob(details.dateOfBirth)) {
    errors.dateOfBirth = `You must be at least ${MIN_AGE} years old`;
  }

  if (!details?.gender) errors.gender = 'Gender is required';

  if (!selectedCountryCode?.dialCode || !localPhoneNumber) {
    errors.number = 'Phone number is required';
  } else {
    const fullMobile = `${selectedCountryCode.dialCode}${localPhoneNumber}`;
    if (!validatePhone(fullMobile)) {
      errors.number = 'Enter a valid phone number';
    }
  }

  if (!address?.addressLine) errors.address = 'Address is required';
  if (!address?.city) errors.city = 'City is required';
  if (!address?.state) errors.state = 'State / Province is required';
  if (!address?.postalCode) errors.postalCode = 'Postal code is required';

  return errors;
};

function PersonalStep({
  nextStep,
  formData,
  setFormData,
  orgIdFromQuery,
  isSaving,
  setIsSaving,
  ref,
}: PersonalStepProps) {
  const [formDataErrors, setFormDataErrors] = useState<PersonalStepErrors>({});
  const currentDate = formData.personalDetails?.dateOfBirth
    ? new Date(formData.personalDetails.dateOfBirth)
    : null;
  const setCurrentDate: React.Dispatch<React.SetStateAction<Date | null>> = (value) => {
    setFormData((prev) => {
      const prevDate = prev.personalDetails?.dateOfBirth
        ? new Date(prev.personalDetails.dateOfBirth)
        : null;
      const next = typeof value === 'function' ? value(prevDate) : value;
      return {
        ...prev,
        personalDetails: {
          ...prev.personalDetails,
          dateOfBirth: next ? formatDateLocal(next) : '',
        },
      };
    });
  };
  const initialPhoneData = findPhoneData(
    formData.personalDetails?.phoneNumber || '',
    formData.personalDetails?.address?.country
  );
  const [selectedCountryCode, setSelectedCountryCode] = useState<CountryDialCodeOption>(
    initialPhoneData.selectedCode
  );
  const [localPhoneNumber, setLocalPhoneNumber] = useState<string>(initialPhoneData.localNumber);

  useImperativeHandle(ref, () => ({
    validate: () => {
      const errors = buildPersonalErrors(formData, selectedCountryCode, localPhoneNumber);
      setFormDataErrors(errors);
      return Object.keys(errors).length === 0;
    },
  }));

  const handleNext = async () => {
    if (isSaving) return;
    const errors = buildPersonalErrors(formData, selectedCountryCode, localPhoneNumber);
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      setIsSaving(true);
      await createUserProfile(formData, orgIdFromQuery);
      nextStep();
    } catch (error: any) {
      console.error('Error creating profile:', error);
    } finally {
      setIsSaving(false);
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
    <div className="flex w-full flex-col">
      <div className="mx-auto flex w-full max-w-[820px] flex-col gap-6 rounded-[22px] border border-[var(--hairline)] bg-[var(--screen)] px-[30px] py-[28px] shadow-[0_2px_6px_var(--sh05),0_20px_55px_var(--sh10)]">
        <div className="text-[17px] font-bold leading-tight tracking-[-0.34px] text-[var(--ink)]">
          Personal details
        </div>

        {/* Profile picture + Gender in one row */}
        <div className="flex flex-wrap items-start justify-between gap-6">
          <LogoUploader
            title="Add profile picture (optional)"
            apiUrl={`/fhir/v1/user-profile/${orgIdFromQuery}/profile-picture`}
            setImageUrl={(s3Key) => {
              setFormData((prev) => ({
                ...prev,
                personalDetails: {
                  ...prev.personalDetails,
                  profilePictureUrl: MEDIA_SOURCES.organization.fromS3Key(s3Key),
                },
              }));
            }}
          />
          <div className="flex flex-col gap-2">
            <div className="team-type-title">Gender</div>
            <div className="flex items-center gap-3 flex-wrap">
              {GenderOptions.map((type) => (
                <button
                  key={type}
                  type="button"
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
            {formDataErrors.gender && (
              <div className="step-inline-error">{formDataErrors.gender}</div>
            )}
          </div>
        </div>

        {/* DOB + Country code + Phone in one row */}
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-12 md:col-span-4">
            <Datepicker
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              type="input"
              containerClassName="w-full"
              placeholder="Date of birth"
              error={formDataErrors.dateOfBirth}
              minYear={CURRENT_YEAR - 100}
              maxYear={CURRENT_YEAR}
            />
          </div>
          <div className="col-span-5 md:col-span-3">
            <LabelDropdown
              placeholder="Country code"
              onSelect={(option) => handleCountryCodeSelect(option.value)}
              defaultOption={selectedCountryCode.value}
              options={CountryDialCodeOptions}
              hasError={!!formDataErrors.number}
            />
          </div>
          <div className="col-span-7 md:col-span-5">
            <FormInput
              intype="text"
              inname="number"
              value={localPhoneNumber}
              inlabel="Phone number"
              onChange={(e) => handlePhoneChange(e.target.value)}
            />
          </div>
        </div>
        {formDataErrors.number && (
          <div className="step-inline-error -mt-3">{formDataErrors.number}</div>
        )}

        <div className="team-seperator" />

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
                inlabel="State / Province"
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

        <div className="mt-1 flex items-center justify-between gap-3 border-t border-[var(--hairline)] pt-[18px]">
          <Secondary href="/organizations" text="Back" />
          <Primary
            href="#"
            text={isSaving ? 'Saving...' : 'Next'}
            icon={<IoArrowForward aria-hidden="true" />}
            iconPosition="right"
            onClick={handleNext}
            isDisabled={isSaving}
          />
        </div>
      </div>
    </div>
  );
}

export default PersonalStep;
