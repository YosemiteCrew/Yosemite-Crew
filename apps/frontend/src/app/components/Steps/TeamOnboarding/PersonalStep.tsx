import React, { useState } from "react";
import { Primary, Secondary } from "../../Buttons";
import classNames from "classnames";

import FormInput from "../../Inputs/FormInput/FormInput";
import Dropdown from "../../Inputs/Dropdown/Dropdown";
import GoogleSearchDropDown from "../../Inputs/GoogleSearchDropDown/GoogleSearchDropDown";
import LogoUploader from "../../UploadImage/LogoUploader";

import "./Step.css";

const GenderTypes = [
  {
    name: "Male",
    key: "male",
  },
  {
    name: "Female",
    key: "female",
  },
  {
    name: "Others",
    key: "others",
  },
];

const PersonalStep = ({ nextStep, formData, setFormData }: any) => {
  const [formDataErrors, setFormDataErrors] = useState<{
    firstName?: string;
    lastName?: string;
    dob?: string;
    country?: string;
    number?: string;
    address?: string;
    area?: string;
    city?: string;
    state?: string;
    postalCode?: string;
  }>({});

  const handleNext = async () => {
    const errors: {
      firstName?: string;
      lastName?: string;
      country?: string;
      number?: string;
      dob?: string;
      address?: string;
      area?: string;
      city?: string;
      state?: string;
      postalCode?: string;
    } = {};
    if (!formData.firstName) errors.firstName = "First name is required";
    if (!formData.lastName) errors.lastName = "Last name is required";
    if (!formData.country) errors.country = "Country is required";
    if (!formData.number) errors.number = "Number is required";
    if (!formData.dob) errors.dob = "DOB is required";
    if (!formData.address) errors.address = "Address is required";
    if (!formData.area) errors.area = "Area is required";
    if (!formData.city) errors.city = "City is required";
    if (!formData.state) errors.state = "State is required";
    if (!formData.postalCode) errors.postalCode = "PostalCode is required";
    setFormDataErrors(errors);
    if (Object.keys(errors).length > 0) {
      return;
    }
    try {
      const payload = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        dob: formData.dob,
        gender: formData.gender ?? null,
        country: formData.country,
        phoneNumber: formData.number,
        addressLine1: formData.address,
        area: formData.area,
        city: formData.city,
        state: formData.state,
        postalCode: formData.postalCode,
        profileImageUrl: formData.profileImageUrl || null,
      };
      console.log(payload)
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
        <div className="team-personal-two">
          <FormInput
            intype="text"
            inname="first name"
            value={formData.firstName}
            inlabel="First name"
            onChange={(e) =>
              setFormData({ ...formData, firstName: e.target.value })
            }
            error={formDataErrors.firstName}
          />
          <FormInput
            intype="text"
            inname="last name"
            value={formData.lastName}
            inlabel="Last name"
            onChange={(e) =>
              setFormData({ ...formData, lastName: e.target.value })
            }
            error={formDataErrors.lastName}
          />
        </div>
        <FormInput
          intype="text"
          inname="dob"
          value={formData.dob}
          inlabel="Date of birth"
          onChange={(e) => setFormData({ ...formData, dob: e.target.value })}
          error={formDataErrors.dob}
        />
        <div className="team-type">
          <div className="team-type-title">Gender</div>
          <div className="team-type-options">
            {GenderTypes.map((type) => (
              <button
                key={type.name}
                className={classNames("team-type-option", {
                  activeGendertype: formData.gender === type.key,
                })}
                onClick={() => setFormData({ ...formData, gender: type.key })}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>
        <div className="team-personal-two">
          <Dropdown
            placeholder="Select country"
            value={formData.country}
            onChange={(e) => setFormData({ ...formData, country: e })}
            error={formDataErrors.country}
            type="country"
          />
          <FormInput
            intype="tel"
            inname="number"
            value={formData.number}
            inlabel="Phone number"
            onChange={(e) =>
              setFormData({ ...formData, number: e.target.value })
            }
            error={formDataErrors.number}
          />
        </div>
      </div>

      <div className="team-seperator"></div>

      <div className="team-address-container">
        <div className="team-title">Residential address</div>
        <div className="team-personal-container">
          <GoogleSearchDropDown
            intype="text"
            inname="address line"
            value={formData.address}
            inlabel="Address line 1"
            onChange={(e) =>
              setFormData({ ...formData, address: e.target.value })
            }
            error={formDataErrors.address}
            setFormData={setFormData}
            onlyAddress={true}
          />
          <div className="team-personal-two">
            <FormInput
              intype="text"
              inname="area"
              value={formData.area}
              inlabel="Area"
              onChange={(e) =>
                setFormData({ ...formData, area: e.target.value })
              }
              error={formDataErrors.area}
            />
            <FormInput
              intype="text"
              inname="state"
              value={formData.state}
              inlabel="State/Province"
              onChange={(e) =>
                setFormData({ ...formData, state: e.target.value })
              }
              error={formDataErrors.state}
            />
          </div>
          <div className="team-personal-two">
            <FormInput
              intype="text"
              inname="city"
              value={formData.city}
              inlabel="City"
              onChange={(e) =>
                setFormData({ ...formData, city: e.target.value })
              }
              error={formDataErrors.city}
            />
            <FormInput
              intype="text"
              inname="postal code"
              value={formData.postalCode}
              inlabel="Postal code"
              onChange={(e) =>
                setFormData({ ...formData, postalCode: e.target.value })
              }
              error={formDataErrors.postalCode}
            />
          </div>
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
