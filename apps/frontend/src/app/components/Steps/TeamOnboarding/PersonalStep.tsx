import React, { useEffect, useState } from "react";
import { Primary, Secondary } from "../../Buttons";
import classNames from "classnames";

import FormInput from "../../Inputs/FormInput/FormInput";
import Dropdown from "../../Inputs/Dropdown/Dropdown";
import GoogleSearchDropDown from "../../Inputs/GoogleSearchDropDown/GoogleSearchDropDown";
import LogoUploader from "../../UploadImage/LogoUploader";
import { GenderOptions, UserProfile } from "@/app/types/profile";
import { createUserProfile } from "@/app/services/profileService";
import Datepicker from "../../Inputs/Datepicker";
import { getCountryCode, validatePhone } from "@/app/utils/validators";

import "./Step.css";
import { formatDateLocal } from "@/app/utils/date";

type PersonalStepProps = {
  nextStep: () => void;
  formData: UserProfile;
  setFormData: React.Dispatch<React.SetStateAction<UserProfile>>;
  orgIdFromQuery: string | null;
};

const PersonalStep = ({
  nextStep,
  formData,
  setFormData,
  orgIdFromQuery,
}: PersonalStepProps) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    dob?: string;
    country?: string;
    number?: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>({});
  const [currentDate, setCurrentDate] = useState<Date>(
    new Date(formData.personalDetails?.dateOfBirth || "2025-10-23")
  );

  useEffect(() => {
    setFormData({
      ...formData,
      personalDetails: {
        ...formData.personalDetails,
        dateOfBirth: formatDateLocal(currentDate),
      },
    });
  }, [currentDate]);

  const handleNext = async () => {
    const errors: {
      dob?: string;
      number?: string;
      gender?: string;
      address?: string;
      country?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    } = {};
    if (!formData.personalDetails?.dateOfBirth)
      errors.dob = "Date of birth is required";
    if (!formData.personalDetails?.phoneNumber)
      errors.number = "Number is required";
    if (!formData.personalDetails?.gender) errors.gender = "Gender is required";
    if (!formData.personalDetails?.address?.country)
      errors.country = "Country is required";
    if (!formData.personalDetails?.address?.addressLine)
      errors.address = "Address is required";
    if (!formData.personalDetails?.address?.city)
      errors.city = "City is required";
    if (!formData.personalDetails?.address?.state)
      errors.state = "State is required";
    if (!formData.personalDetails?.address?.postalCode)
      errors.postalCode = "PostalCode is required";
    const selectedCountry = getCountryCode(
      formData.personalDetails?.address?.country
    );
    if (selectedCountry) {
      const countryCode = selectedCountry.dial_code;
      const fullMobile = countryCode + formData.personalDetails?.phoneNumber;
      if (!validatePhone(fullMobile)) {
        errors.number = "Valid number is required";
      }
    } else {
      errors.number = "Valid number is required";
    }
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      await createUserProfile(formData, orgIdFromQuery);
      nextStep();
    } catch (error: any) {
      console.error("Error creating profile:", error);
    }
  };

  return (
    <div className="team-container">
      <div className="team-title">Personal details</div>

      <LogoUploader
        title="Add profile picture (optional)"
        apiUrl="/api/profile-logo"
        setFormData={setFormData}
      />

      <div className="team-personal-container">
        <Datepicker
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          type="input"
          className="h-12! xl:h-[60px]!"
          containerClassName="w-full"
          placeholder="Date of birth"
        />
        <div className="team-personal-two">
          <Dropdown
            placeholder="Select country"
            value={formData.personalDetails?.address?.country || ""}
            onChange={(e) =>
              setFormData({
                ...formData,
                personalDetails: {
                  ...formData.personalDetails,
                  address: {
                    ...formData.personalDetails?.address,
                    country: e,
                  },
                },
              })
            }
            error={formDataErrors.country}
            type="country"
            dropdownClassName="h-fit! max-h-[200px]!"
            search
          />
          <FormInput
            intype="tel"
            inname="number"
            value={formData.personalDetails?.phoneNumber || ""}
            inlabel="Phone number"
            onChange={(e) =>
              setFormData({
                ...formData,
                personalDetails: {
                  ...formData.personalDetails,
                  phoneNumber: e.target.value,
                },
              })
            }
            error={formDataErrors.number}
          />
        </div>
        <div className="team-type">
          <div className="team-type-title">Gender</div>
          <div className="team-type-options">
            {GenderOptions.map((type) => (
              <button
                key={type}
                className={classNames("team-type-option", {
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
                {type}
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
            value={formData.personalDetails?.address?.addressLine || ""}
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
              value={formData.personalDetails?.address?.city || ""}
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
              value={formData.personalDetails?.address?.state || ""}
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
            value={formData.personalDetails?.address?.postalCode || ""}
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

      <div className="team-buttons">
        <Secondary
          href="/organizations"
          text="Back"
          style={{ width: "160px" }}
        />
        <Primary
          href="#"
          text="Next"
          style={{ width: "160px" }}
          onClick={handleNext}
        />
      </div>
    </div>
  );
};

export default PersonalStep;
